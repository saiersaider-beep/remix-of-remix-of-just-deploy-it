import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Plan = { name: string; amount: number; durationDays: number | null };

// Montants en unité entière (XOF). Modifie librement.
export const PLANS: Record<string, Plan> = {
  "pro-month": { name: "PRO Starter", amount: 10000, durationDays: 365 },
  "pro-year": { name: "PRO Ambassadeur", amount: 20000, durationDays: 365 },
  "pro-life": { name: "PRO Légende", amount: 30000, durationDays: 365 },
};

export type SettingsRow = {
  api_key: string | null;
  site_id: string | null;
  secret_key: string | null;
  api_url: string;
  currency: string;
  mode: string;
  enabled: boolean;
};

export async function loadSettings(): Promise<SettingsRow> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("api_key, site_id, secret_key, api_url, currency, mode, enabled")
    .eq("provider", "cinetpay")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("CinetPay non configuré");
  if (!data.enabled) throw new Error("Paiements CinetPay désactivés");
  if (!data.api_key || !data.secret_key)
    throw new Error("Clé API (account_key) ou Mot de passe API (account_password) manquant");
  return data as unknown as SettingsRow;
}

/** Derive the API base URL (without trailing path) from settings. */
export function apiBase(settings: SettingsRow): string {
  // strip trailing /payment, /v1/payment, etc. to get the base
  return settings.api_url.replace(/\/+$/, "").replace(/\/v1\/payment$/i, "").replace(/\/v2\/payment$/i, "");
}

/** Authenticate against CinetPay v1 with account_key + account_password and return a bearer token. */
export async function cinetpayLogin(settings: SettingsRow): Promise<string> {
  const url = `${apiBase(settings)}/v1/auth/login`;
  const form = new URLSearchParams();
  form.set("apikey", settings.api_key || "");
  form.set("password", settings.secret_key || "");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json = (await res.json()) as {
    code?: number | string;
    status?: string;
    message?: string;
    data?: { token?: string };
  };
  const token = json?.data?.token;
  if (!res.ok || !token) {
    console.error("CinetPay login failed:", json);
    throw new Error(json?.message || "Échec authentification CinetPay (account_key / password)");
  }
  return token;
}

export async function initCinetPayCheckout(opts: {
  amount: number;
  description: string;
  transaction_id: string;
  return_url: string;
  notify_url: string;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  metadata?: string;
}): Promise<{ payment_url: string; raw: unknown }> {
  const settings = await loadSettings();
  const token = await cinetpayLogin(settings);
  const url = `${apiBase(settings)}/v1/payment`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      currency: settings.currency,
      merchant_transaction_id: opts.transaction_id,
      amount: Math.round(opts.amount),
      lang: "fr",
      designation: opts.description.slice(0, 100),
      client_email: opts.customer_email || "client@vinasound.fun",
      client_first_name: (opts.customer_first_name || "Client").slice(0, 255),
      client_last_name: (opts.customer_last_name || "VinaSound").slice(0, 255),
      ...(opts.customer_phone ? { client_phone_number: opts.customer_phone } : {}),
      success_url: opts.return_url,
      failed_url: opts.return_url,
      notify_url: opts.notify_url,
    }),
  });
  const json = (await res.json()) as {
    code?: number | string;
    status?: string;
    message?: string;
    payment_url?: string;
    payment_token?: string;
    transaction_id?: string;
    merchant_transaction_id?: string;
  };
  const ok = (json.code === 200 || json.code === "200") && !!json.payment_url;
  if (!res.ok || !ok) {
    console.error("CinetPay init failed:", json);
    throw new Error(json.message || "Échec d'initialisation du paiement CinetPay");
  }
  return { payment_url: json.payment_url!, raw: json };
}

export const adminGuard = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux administrateurs");
};

export async function verifyAndApply(transaction_id: string) {
  const settings = await loadSettings();
  const token = await cinetpayLogin(settings);
  const checkUrl = `${apiBase(settings)}/v1/payment/check?merchant_transaction_id=${encodeURIComponent(transaction_id)}`;

  const res = await fetch(checkUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = (await res.json()) as {
    code?: number | string;
    status?: string;
    message?: string;
    details?: { status?: string; code?: number };
    data?: { status?: string };
  };

  // v1: top-level status "OK" + details.status "SUCCESS" — or data.status "SUCCESS"
  const innerStatus = json?.details?.status || json?.data?.status || json?.status;
  const success =
    (json?.code === 200 || json?.code === "200" || json?.status === "OK") &&
    innerStatus === "SUCCESS";

  // ---- Wallet credit ------------------------------------------------------
  if (transaction_id.startsWith("wallet-")) {
    const { data: tx } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, user_id, amount_xof, status")
      .eq("reference", transaction_id)
      .maybeSingle();
    if (tx) {
      if (tx.status === "succeeded")
        return { success: true, kind: "wallet" as const, alreadyApplied: true };
      if (success) {
        const { data: cur } = await supabaseAdmin
          .from("wallet_balances")
          .select("balance_xof")
          .eq("user_id", tx.user_id)
          .maybeSingle();
        const newBal = (cur?.balance_xof ?? 0) + tx.amount_xof;
        await supabaseAdmin.from("wallet_balances").upsert(
          { user_id: tx.user_id, balance_xof: newBal, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ status: "succeeded", settled_at: new Date().toISOString() })
          .eq("id", tx.id);
      } else {
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ status: "failed" })
          .eq("id", tx.id);
      }
      return { success, kind: "wallet" as const };
    }
  }

  // ---- Artist creation fee ------------------------------------------------
  if (transaction_id.startsWith("artistfee-")) {
    const { data: fee } = await supabaseAdmin
      .from("artist_creation_fees")
      .select("id, user_id, amount_xof, status")
      .eq("flw_tx_ref", transaction_id)
      .maybeSingle();
    if (fee) {
      if (fee.status === "paid")
        return { success: true, kind: "artist_fee" as const, alreadyApplied: true };
      if (success) {
        await supabaseAdmin
          .from("artist_creation_fees")
          .update({
            status: "paid",
            method: "cinetpay",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", fee.id);
      } else {
        await supabaseAdmin
          .from("artist_creation_fees")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", fee.id);
      }
      return { success, kind: "artist_fee" as const };
    }
  }

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, plan, status")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  if (sub) {
    if (sub.status === "active") return { success: true, kind: "subscription" as const, alreadyApplied: true };
    if (success) {
      const plan = PLANS[sub.plan];
      const now = new Date();
      const end = plan?.durationDays
        ? new Date(now.getTime() + plan.durationDays * 86400000)
        : null;
      await supabaseAdmin.from("subscriptions").update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end ? end.toISOString() : null,
        raw_response: json,
      }).eq("id", sub.id);

      await supabaseAdmin
        .from("artists")
        .update({ pro_badge: "pro" })
        .eq("user_id", sub.user_id);
    } else {
      await supabaseAdmin.from("subscriptions").update({ status: "failed", raw_response: json }).eq("id", sub.id);
    }
    return { success, kind: "subscription" as const };
  }

  const { data: pur } = await supabaseAdmin
    .from("purchases")
    .select("id, status, track_id, album_id")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  if (pur) {
    if (pur.status === "completed") return { success: true, kind: "purchase" as const, alreadyApplied: true };
    if (success) {
      await supabaseAdmin.from("purchases").update({
        status: "completed",
        paid_at: new Date().toISOString(),
        raw_response: json,
      }).eq("id", pur.id);
      if (pur.track_id) {
        const { data: ownerRow } = await supabaseAdmin
          .from("purchases")
          .select("user_id")
          .eq("id", pur.id)
          .maybeSingle();
        if (ownerRow?.user_id) {
          await supabaseAdmin
            .from("track_access")
            .upsert(
              { user_id: ownerRow.user_id, track_id: pur.track_id, source: "purchase" },
              { onConflict: "user_id,track_id,source", ignoreDuplicates: true },
            );
        }
      }
    } else {
      await supabaseAdmin.from("purchases").update({ status: "failed", raw_response: json }).eq("id", pur.id);
    }
    return { success, kind: "purchase" as const };
  }

  return { success, kind: null };
}