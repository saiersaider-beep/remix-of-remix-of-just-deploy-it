import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PLANS,
  GENIUSPAY_PROVIDER,
  GENIUSPAY_DEFAULT_API_URL,
  adminGuard,
  verifyAndApply,
  initGeniusPayCheckout,
} from "@/lib/geniuspay.server";

export const getGeniusPaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.userId);
    const { data, error } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: data };
  });

export const updateGeniusPaySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        api_key: z.string().trim().min(1, "La clé publique (X-API-Key) est requise.").max(200),
        secret_key: z.string().trim().min(1, "La clé secrète (X-API-Secret) est requise.").max(200),
        site_id: z.string().trim().max(200).optional().nullable(), // secret webhook whsec_...
        api_url: z.string().url("L'URL de l'API doit être une URL valide.").max(300),
        currency: z.string().trim().min(3).max(5),
        mode: z.enum(["test", "prod"]),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("payment_settings")
      .select("id")
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const payload = {
      api_key: data.api_key || null,
      site_id: data.site_id || null,
      secret_key: data.secret_key || null,
      api_url: data.api_url || GENIUSPAY_DEFAULT_API_URL,
      currency: data.currency,
      mode: data.mode,
      enabled: data.enabled,
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("payment_settings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("payment_settings")
        .insert({ provider: GENIUSPAY_PROVIDER, ...payload });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Test de connexion : appelle /account avec les clés enregistrées. */
export const testGeniusPayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.userId);
    const { data } = await supabaseAdmin
      .from("payment_settings")
      .select("api_key, secret_key, api_url")
      .eq("provider", GENIUSPAY_PROVIDER)
      .limit(1)
      .maybeSingle();
    if (!data?.api_key || !data?.secret_key) throw new Error("Clés API manquantes.");
    const base = (data.api_url || GENIUSPAY_DEFAULT_API_URL).replace(/\/+$/, "");
    const res = await fetch(`${base}/account`, {
      headers: {
        "X-API-Key": data.api_key,
        "X-API-Secret": data.secret_key,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { business_name?: string; email?: string; status?: string; environment?: string };
      message?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.success === false) {
      throw new Error(json.error?.message || json.message || "Connexion refusée par GeniusPay");
    }
    return { account: json.data ?? null };
  });

const PurposeSchema = z.enum(["pro-month", "pro-year", "pro-life", "track", "album"]);

export const initGeniusPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purpose: PurposeSchema,
        target_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    let amount = 0;
    let description = "";
    if (data.purpose.startsWith("pro-")) {
      const plan = PLANS[data.purpose];
      if (!plan) throw new Error("Plan inconnu");
      amount = plan.amount;
      description = `VinaSound ${plan.name}`;
    } else if (data.purpose === "track") {
      if (!data.target_id) throw new Error("ID de la piste requis");
      const { data: t } = await supabaseAdmin
        .from("tracks")
        .select("price_amount, title")
        .eq("id", data.target_id)
        .maybeSingle();
      if (!t || !t.price_amount) throw new Error("Piste non payante");
      amount = t.price_amount;
      description = `Achat: ${t.title}`;
    } else if (data.purpose === "album") {
      if (!data.target_id) throw new Error("ID de l'album requis");
      const { data: a } = await supabaseAdmin
        .from("albums")
        .select("title")
        .eq("id", data.target_id)
        .maybeSingle();
      if (!a) throw new Error("Album introuvable");
      amount = 5000;
      description = `Achat album: ${a.title}`;
    }
    if (amount <= 0) throw new Error("Montant invalide");

    const host = `https://${getRequestHost()}`;
    const purposePrefix = data.purpose.startsWith("pro-")
      ? "pro"
      : data.purpose === "track"
        ? "track"
        : "album";
    const transaction_id = `${purposePrefix}-${userId.slice(0, 8)}-${Date.now()}`;
    const return_url = `${host}/payment/callback?transaction_id=${encodeURIComponent(transaction_id)}`;
    const notify_url = `${host}/api/public/geniuspay-webhook`;

    const isSub = data.purpose.startsWith("pro-");
    if (isSub) {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan: data.purpose,
        status: "pending",
        amount,
        currency: "XOF",
        provider: GENIUSPAY_PROVIDER,
        transaction_id,
      });
    } else {
      await supabaseAdmin.from("purchases").insert({
        user_id: userId,
        track_id: data.purpose === "track" ? data.target_id : null,
        album_id: data.purpose === "album" ? data.target_id : null,
        amount,
        currency: "XOF",
        status: "pending",
        provider: GENIUSPAY_PROVIDER,
        transaction_id,
      });
    }

    const { data: udata } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = udata?.user?.email ?? undefined;
    const meta = (udata?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const firstName = (meta.first_name as string) || (meta.given_name as string) || undefined;
    const lastName = (meta.last_name as string) || (meta.family_name as string) || undefined;

    const { payment_url, reference, raw } = await initGeniusPayCheckout({
      amount,
      description,
      transaction_id,
      return_url,
      notify_url,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
      metadata: { user_id: userId, purpose: data.purpose },
    });

    const table = isSub ? "subscriptions" : "purchases";
    await supabaseAdmin
      .from(table)
      .update({ payment_url, flw_tx_id: reference, raw_response: raw as never })
      .eq("transaction_id", transaction_id);

    return { payment_url, transaction_id, reference };
  });

export const verifyGeniusPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transaction_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await verifyAndApply(data.transaction_id);
    return { ...result, userId: context.userId };
  });
