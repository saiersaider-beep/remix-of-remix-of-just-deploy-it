import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";

const PurposeSchema = z.enum([
  "pro-basic",
  "pro-premium",
  "pro-vip",
  "track",
  "album",
  "wallet",
]);

/** Public — indique si PayGate est activé (sans exposer la clé). */
export const getPaygateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("mm_settings")
    .select("paygate_enabled, paygate_api_key")
    .eq("id", true)
    .maybeSingle();
  return {
    enabled: Boolean(data?.paygate_enabled && data?.paygate_api_key),
  };
});

/** Authentifié — initie un paiement automatique PayGate (push USSD). */
export const initPaygatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purpose: PurposeSchema,
        target_id: z.string().uuid().optional().nullable(),
        amount_xof: z.number().int().positive().max(10_000_000).optional(),
        network: z.enum(["FLOOZ", "TMONEY"]),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(20),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings, error: sErr } = await supabaseAdmin
      .from("mm_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (sErr || !settings) throw new Error("Paramètres indisponibles");
    if (!settings.paygate_enabled || !settings.paygate_api_key) {
      throw new Error("Paiement automatique désactivé");
    }

    // Compute amount
    let amount = data.amount_xof ?? 0;
    if (data.purpose === "pro-basic") amount = settings.plan_basic_xof;
    if (data.purpose === "pro-premium") amount = settings.plan_premium_xof;
    if (data.purpose === "pro-vip") amount = settings.plan_vip_xof;
    if (data.purpose === "track") {
      if (!data.target_id) throw new Error("ID de la piste requis");
      const { data: t } = await supabaseAdmin
        .from("tracks")
        .select("price_amount")
        .eq("id", data.target_id)
        .maybeSingle();
      if (!t?.price_amount) throw new Error("Piste non payante");
      amount = t.price_amount;
    }
    if (amount <= 0) throw new Error("Montant invalide");

    const merchant_number =
      data.network === "FLOOZ" ? settings.flooz_number : settings.yas_number;
    const operator = data.network === "FLOOZ" ? "flooz" : "yas";

    // Create local payment row (provider=paygate, pending)
    const { data: row, error: insErr } = await supabaseAdmin
      .from("mm_payments")
      .insert({
        user_id: context.userId,
        purpose: data.purpose,
        target_id: data.target_id ?? null,
        amount_xof: amount,
        operator,
        merchant_number,
        full_name: data.full_name,
        phone: data.phone,
        provider: "paygate",
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Création échouée");

    const identifier = `mm-${row.id}`;
    await supabaseAdmin
      .from("mm_payments")
      .update({ identifier })
      .eq("id", row.id);

    // Call PayGate Global API (Méthode 1 — push direct)
    const payload = {
      auth_token: settings.paygate_api_key,
      phone_number: data.phone.replace(/\D/g, ""),
      amount,
      description: `VinaSound — ${data.purpose}`,
      identifier,
      network: data.network,
    };

    let status = -1;
    let tx_reference: string | null = null;
    try {
      const res = await fetch("https://paygateglobal.com/api/v1/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        tx_reference?: string;
        status?: number;
      };
      status = json.status ?? -1;
      tx_reference = json.tx_reference ?? null;
    } catch {
      throw new Error("PayGate injoignable");
    }

    if (status !== 0) {
      const messages: Record<number, string> = {
        2: "Clé API PayGate invalide",
        4: "Paramètres invalides",
        6: "Transaction en doublon",
      };
      throw new Error(messages[status] ?? "Échec PayGate");
    }

    if (tx_reference) {
      await supabaseAdmin
        .from("mm_payments")
        .update({ tx_reference })
        .eq("id", row.id);
    }

    // Try to surface callback URL (informational)
    let callback_url: string | null = null;
    try {
      callback_url = `https://${getRequestHost()}/api/public/paygate-callback`;
    } catch {
      callback_url = null;
    }

    return {
      ok: true,
      payment_id: row.id,
      identifier,
      tx_reference,
      amount_xof: amount,
      callback_url,
    };
  });

/** Authentifié — interroge l'état d'un paiement PayGate. */
export const checkPaygateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ payment_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("mm_payments")
      .select("*")
      .eq("id", data.payment_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Paiement introuvable");
    if (row.status === "approved") return { status: "approved" as const };
    if (row.status === "rejected") return { status: "rejected" as const };

    // Poll PayGate
    const { data: settings } = await supabaseAdmin
      .from("mm_settings")
      .select("paygate_api_key")
      .eq("id", true)
      .maybeSingle();
    if (!settings?.paygate_api_key || !row.identifier) {
      return { status: "pending" as const };
    }
    try {
      const res = await fetch("https://paygateglobal.com/api/v2/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: settings.paygate_api_key,
          identifier: row.identifier,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: number;
        tx_reference?: string;
        payment_reference?: string;
        payment_method?: string;
      };
      if (json.status === 0) {
        await supabaseAdmin.rpc("mm_apply_paygate_callback", {
          _identifier: row.identifier,
          _tx_reference: json.tx_reference ?? row.tx_reference ?? row.identifier,
          _payment_reference: json.payment_reference ?? "",
          _amount: row.amount_xof,
          _phone: row.phone,
          _payment_method: json.payment_method ?? row.operator.toUpperCase(),
        });
        return { status: "approved" as const };
      }
      if (json.status === 4 || json.status === 6) {
        await supabaseAdmin
          .from("mm_payments")
          .update({ status: "rejected", admin_notes: "PayGate: expiré/annulé" })
          .eq("id", row.id);
        return { status: "rejected" as const };
      }
    } catch {
      // ignore, stay pending
    }
    return { status: "pending" as const };
  });

/** Admin — met à jour la configuration PayGate. */
export const updatePaygateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        paygate_api_key: z.string().trim().max(200),
        paygate_enabled: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");
    const { error } = await supabaseAdmin
      .from("mm_settings")
      .update(data)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin — lit la configuration PayGate (clé incluse). */
export const getPaygateAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");
    const { data } = await supabaseAdmin
      .from("mm_settings")
      .select("paygate_api_key, paygate_enabled")
      .eq("id", true)
      .maybeSingle();
    return {
      paygate_api_key: data?.paygate_api_key ?? "",
      paygate_enabled: Boolean(data?.paygate_enabled),
    };
  });
