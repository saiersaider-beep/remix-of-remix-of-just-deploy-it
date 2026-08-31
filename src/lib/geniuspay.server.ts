import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Plan = { name: string; amount: number; durationDays: number | null };

// Montants en unité entière (XOF).
export const PLANS: Record<string, Plan> = {
  "pro-month": { name: "PRO Starter", amount: 10000, durationDays: 365 },
  "pro-year": { name: "PRO Ambassadeur", amount: 20000, durationDays: 365 },
  "pro-life": { name: "PRO Légende", amount: 30000, durationDays: 365 },
};

export const GENIUSPAY_PROVIDER = "geniuspay";
export const GENIUSPAY_DEFAULT_API_URL = "https://geniuspay.ci/api/v1/merchant";

export type SettingsRow = {
  api_key: string | null; // pk_sandbox_... / pk_live_...
  site_id: string | null; // secret webhook whsec_...
  secret_key: string | null; // sk_sandbox_... / sk_live_...
  api_url: string;
  currency: string;
  mode: string;
  enabled: boolean;
};

export async function loadSettings(): Promise<SettingsRow> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("api_key, site_id, secret_key, api_url, currency, mode, enabled")
    .eq("provider", GENIUSPAY_PROVIDER)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("GeniusPay non configuré");
  if (!data.enabled) throw new Error("Paiements GeniusPay désactivés");
  if (!data.api_key || !data.secret_key)
    throw new Error("Clé publique (X-API-Key) ou clé secrète (X-API-Secret) manquante");
  return data as unknown as SettingsRow;
}

/** Base URL de l'API marchand, sans slash final. */
export function apiBase(settings: SettingsRow): string {
  return (settings.api_url || GENIUSPAY_DEFAULT_API_URL).replace(/\/+$/, "");
}

function gpHeaders(settings: SettingsRow): Record<string, string> {
  return {
    "X-API-Key": settings.api_key || "",
    "X-API-Secret": settings.secret_key || "",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

type GpPayment = {
  id?: number;
  reference?: string;
  status?: string;
  amount?: number;
  checkout_url?: string;
  payment_url?: string;
  metadata?: Record<string, unknown>;
};

type GpResponse = {
  success?: boolean;
  data?: GpPayment;
  message?: string;
  error?: { code?: string; message?: string };
};

/** Crée une transaction GeniusPay et retourne l'URL de checkout hébergée. */
export async function initGeniusPayCheckout(opts: {
  amount: number;
  description: string;
  transaction_id: string;
  return_url: string;
  notify_url?: string;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ payment_url: string; reference: string; raw: unknown }> {
  const settings = await loadSettings();
  const name = [opts.customer_first_name, opts.customer_last_name].filter(Boolean).join(" ").trim();

  const res = await fetch(`${apiBase(settings)}/payments`, {
    method: "POST",
    headers: gpHeaders(settings),
    body: JSON.stringify({
      amount: Math.round(opts.amount),
      currency: settings.currency || "XOF",
      description: opts.description.slice(0, 500),
      customer: {
        ...(name ? { name } : {}),
        ...(opts.customer_email ? { email: opts.customer_email } : {}),
        ...(opts.customer_phone ? { phone: opts.customer_phone } : {}),
        country: "TG",
      },
      success_url: opts.return_url,
      error_url: opts.return_url,
      metadata: { transaction_id: opts.transaction_id, ...(opts.metadata ?? {}) },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as GpResponse;
  const payment_url = json.data?.checkout_url || json.data?.payment_url;
  const reference = json.data?.reference;

  if (!res.ok || json.success === false || !payment_url || !reference) {
    console.error("GeniusPay init failed:", json);
    throw new Error(
      json.error?.message || json.message || "Échec d'initialisation du paiement GeniusPay",
    );
  }
  return { payment_url, reference, raw: json };
}

/** Récupère le statut d'une transaction GeniusPay via sa référence (MTX-...). */
export async function fetchGeniusPayPayment(reference: string): Promise<{
  success: boolean;
  status: string | null;
  raw: unknown;
}> {
  const settings = await loadSettings();
  const res = await fetch(`${apiBase(settings)}/payments/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: gpHeaders(settings),
  });
  const json = (await res.json().catch(() => ({}))) as GpResponse;
  const status = json.data?.status ?? null;
  return { success: res.ok && json.success !== false && status === "completed", status, raw: json };
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

/**
 * Vérifie le paiement auprès de GeniusPay puis applique l'effet métier
 * (wallet, frais artiste, abonnement PRO, achat de piste).
 * `transaction_id` = notre identifiant interne (préfixé wallet-/artistfee-/track-/pro-…).
 */
export async function verifyAndApply(transaction_id: string) {
  const check = async (gpRef: string | null | undefined) => {
    if (!gpRef) return { success: false, status: null, raw: null as unknown };
    return fetchGeniusPayPayment(gpRef);
  };

  // ---- Wallet credit ------------------------------------------------------
  if (transaction_id.startsWith("wallet-")) {
    const { data: tx } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, user_id, amount_xof, status, flw_tx_ref")
      .eq("reference", transaction_id)
      .maybeSingle();
    if (tx) {
      if (tx.status === "succeeded")
        return { success: true, kind: "wallet" as const, alreadyApplied: true };
      const { success } = await check(tx.flw_tx_ref);
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
      }
      return { success, kind: "wallet" as const };
    }
  }

  // ---- Artist creation fee ------------------------------------------------
  if (transaction_id.startsWith("artistfee-")) {
    const { data: fee } = await supabaseAdmin
      .from("artist_creation_fees")
      .select("id, user_id, amount_xof, status, flw_tx_id")
      .eq("flw_tx_ref", transaction_id)
      .maybeSingle();
    if (fee) {
      if (fee.status === "paid")
        return { success: true, kind: "artist_fee" as const, alreadyApplied: true };
      const { success } = await check(fee.flw_tx_id);
      if (success) {
        await supabaseAdmin
          .from("artist_creation_fees")
          .update({
            status: "paid",
            method: GENIUSPAY_PROVIDER,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", fee.id);
      }
      return { success, kind: "artist_fee" as const };
    }
  }

  // ---- Abonnement PRO -----------------------------------------------------
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, plan, status, flw_tx_id")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  if (sub) {
    if (sub.status === "active")
      return { success: true, kind: "subscription" as const, alreadyApplied: true };
    const { success, raw } = await check(sub.flw_tx_id);
    if (success) {
      const plan = PLANS[sub.plan];
      const now = new Date();
      const end = plan?.durationDays
        ? new Date(now.getTime() + plan.durationDays * 86400000)
        : null;
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: end ? end.toISOString() : null,
          raw_response: raw as never,
        })
        .eq("id", sub.id);

      await supabaseAdmin.from("artists").update({ pro_badge: "pro" }).eq("user_id", sub.user_id);
    }
    return { success, kind: "subscription" as const };
  }

  // ---- Achat de piste / album --------------------------------------------
  const { data: pur } = await supabaseAdmin
    .from("purchases")
    .select("id, user_id, status, track_id, album_id, flw_tx_id")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  if (pur) {
    if (pur.status === "completed" || pur.status === "succeeded")
      return { success: true, kind: "purchase" as const, alreadyApplied: true };
    const { success, raw } = await check(pur.flw_tx_id);
    if (success) {
      await supabaseAdmin
        .from("purchases")
        .update({
          status: "completed",
          paid_at: new Date().toISOString(),
          raw_response: raw as never,
        })
        .eq("id", pur.id);
      if (pur.track_id && pur.user_id) {
        await supabaseAdmin.from("track_access").upsert(
          { user_id: pur.user_id, track_id: pur.track_id, source: "purchase" },
          { onConflict: "user_id,track_id,source", ignoreDuplicates: true },
        );
      }
    }
    return { success, kind: "purchase" as const };
  }

  return { success: false, kind: null };
}
