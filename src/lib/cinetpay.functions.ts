import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, loadSettings, adminGuard, verifyAndApply, initCinetPayCheckout } from "@/lib/cinetpay.server";

export const getCinetPaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.userId);
    const { data, error } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .eq("provider", "cinetpay")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: data };
  });

export const updateCinetPaySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      api_key: z.string().trim().min(1, "La Clé API est requise.").max(200),
      site_id: z.string().trim().max(60).optional().nullable(),
      secret_key: z.string().trim().min(1, "Le Mot de passe API est requis.").max(200),
      api_url: z.string().url("L'URL de l'API doit être une URL valide.").max(300),
      currency: z.string().trim().min(3).max(5),
      mode: z.enum(["test", "prod"]),
      enabled: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("payment_settings")
      .select("id")
      .eq("provider", "cinetpay")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("payment_settings")
        .update({
          api_key: data.api_key || null,
          site_id: data.site_id || null,
          secret_key: data.secret_key || null,
          api_url: data.api_url,
          currency: data.currency,
          mode: data.mode,
          enabled: data.enabled,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("payment_settings").insert({
        provider: "cinetpay",
        ...data,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const PurposeSchema = z.enum(["pro-month", "pro-year", "pro-life", "track", "album"]);

export const initCinetPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      purpose: PurposeSchema,
      target_id: z.string().uuid().optional(),
      origin: z.string().url().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const settings = await loadSettings();
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

    const host = data.origin ?? `https://${getRequestHost()}`;
    const purposePrefix = data.purpose.startsWith("pro-")
      ? "pro"
      : data.purpose === "track"
        ? "track"
        : "album";
    const transaction_id = `${purposePrefix}-${userId.slice(0, 8)}-${Date.now()}`;
    const return_url = `${host}/payment/callback?transaction_id=${encodeURIComponent(transaction_id)}`;
    const notify_url = `${host}/api/public/cinetpay-webhook`;

    if (data.purpose.startsWith("pro-")) {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan: data.purpose,
        status: "pending",
        amount,
        currency: settings.currency,
        provider: "cinetpay",
        transaction_id,
      });
    } else {
      await supabaseAdmin.from("purchases").insert({
        user_id: userId,
        track_id: data.purpose === "track" ? data.target_id : null,
        album_id: data.purpose === "album" ? data.target_id : null,
        amount,
        currency: settings.currency,
        status: "pending",
        provider: "cinetpay",
        transaction_id,
      });
    }

    // Fetch user email for the CinetPay payload
    const { data: udata } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = udata?.user?.email ?? undefined;
    const meta = (udata?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const firstName =
      (meta.first_name as string) ||
      (meta.given_name as string) ||
      (typeof meta.name === "string" ? (meta.name as string).split(" ")[0] : undefined);
    const lastName =
      (meta.last_name as string) ||
      (meta.family_name as string) ||
      (typeof meta.name === "string" ? (meta.name as string).split(" ").slice(1).join(" ") : undefined);

    const { payment_url, raw: json } = await initCinetPayCheckout({
      amount,
      description,
      transaction_id,
      return_url,
      notify_url,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
    });

    const table = data.purpose.startsWith("pro-") ? "subscriptions" : "purchases";
    await supabaseAdmin.from(table).update({ payment_url, raw_response: json as never }).eq("transaction_id", transaction_id);

    return { payment_url, transaction_id };
  });

export const verifyCinetPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ transaction_id: z.string().min(1).max(200) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const result = await verifyAndApply(data.transaction_id);
    return { ...result, userId: context.userId };
  });