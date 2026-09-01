import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  GENIUSPAY_DEFAULT_API_URL as GP_DEFAULT_API_URL,
  GENIUSPAY_PROVIDER as GP_PROVIDER,
} from "@/lib/geniuspay-config";

export type Plan = { name: string; amount: number; durationDays: number | null };

// Montants en unité entière (XOF).
export const PLANS: Record<string, Plan> = {
  // Plans affichés sur /go-pro
  "pro-basic": { name: "PRO Basic", amount: 1000, durationDays: 30 },
  "pro-premium": { name: "PRO Premium", amount: 3000, durationDays: 30 },
  "pro-vip": { name: "PRO VIP", amount: 5000, durationDays: 30 },
  // Anciens identifiants conservés pour les abonnements déjà en base
  "pro-month": { name: "PRO Starter", amount: 10000, durationDays: 365 },
  "pro-year": { name: "PRO Ambassadeur", amount: 20000, durationDays: 365 },
  "pro-life": { name: "PRO Légende", amount: 30000, durationDays: 365 },
};

// Ré-exportés depuis la config partagée : une seule définition dans le projet.
export const GENIUSPAY_PROVIDER = GP_PROVIDER;
export const GENIUSPAY_DEFAULT_API_URL = GP_DEFAULT_API_URL;


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

/** Statuts considérés comme définitivement payés côté VinaSound. */
export const PAID_STATUSES = ["paid", "completed", "succeeded"];

/** Log serveur structuré, sans jamais exposer les clés/secrets. */
export function gpLog(event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (/key|secret|token|authorization/i.test(k)) continue;
    safe[k] = typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v;
  }
  console.log(`[geniuspay] ${event}`, JSON.stringify(safe));
}

export function gpError(event: string, err: unknown, fields: Record<string, unknown> = {}) {
  const message = err instanceof Error ? err.message : String(err);
  gpLog(`ERROR ${event}`, { ...fields, message: message.replace(/(pk|sk|whsec)_[A-Za-z0-9_-]+/g, "[redacted]") });
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
      // Pas de pays imposé : GeniusPay détecte le pays et propose
      // les moyens de paiement disponibles sur sa page de checkout.
      customer: {
        ...(name ? { name } : {}),
        ...(opts.customer_email ? { email: opts.customer_email } : {}),
        ...(opts.customer_phone ? { phone: opts.customer_phone } : {}),
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
    gpError("init_checkout", json.error?.message || json.message || "réponse invalide", {
      transaction_id: opts.transaction_id,
      http_status: res.status,
      amount: opts.amount,
    });
    throw new Error(
      json.error?.message || json.message || "Échec d'initialisation du paiement GeniusPay",
    );
  }
  gpLog("init_checkout_ok", {
    transaction_id: opts.transaction_id,
    reference,
    amount: opts.amount,
    currency: settings.currency || "XOF",
    mode: settings.mode,
  });
  return { payment_url, reference, raw: json };
}

/** Récupère le statut d'une transaction GeniusPay via sa référence (MTX-...). */
export async function fetchGeniusPayPayment(reference: string): Promise<{
  success: boolean;
  status: string | null;
  amount: number | null;
  raw: unknown;
}> {
  const settings = await loadSettings();
  const res = await fetch(`${apiBase(settings)}/payments/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: gpHeaders(settings),
  });
  const json = (await res.json().catch(() => ({}))) as GpResponse;
  const status = json.data?.status ?? null;
  const success = res.ok && json.success !== false && status === "completed";
  gpLog("fetch_payment", { reference, http_status: res.status, status, success });
  return { success, status, amount: json.data?.amount ?? null, raw: json };
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

/** Journal unifié : enregistre chaque transaction GeniusPay créée. */
export async function recordGeniusPayTransaction(row: {
  user_id: string;
  purpose: string;
  target_id?: string | null;
  transaction_id: string;
  amount: number;
  currency?: string;
  description?: string | null;
}) {
  const { error } = await supabaseAdmin.from("geniuspay_transactions").insert({
    user_id: row.user_id,
    purpose: row.purpose,
    target_id: row.target_id ?? null,
    transaction_id: row.transaction_id,
    amount: row.amount,
    currency: row.currency ?? "XOF",
    status: "pending",
    description: row.description ?? null,
  });
  if (error) gpError("ledger_insert", error.message, { transaction_id: row.transaction_id });
}

/** Journal unifié : met à jour le statut d'une transaction GeniusPay. */
export async function updateGeniusPayTransaction(
  transaction_id: string,
  patch: {
    status?: "pending" | "succeeded" | "failed";
    reference?: string | null;
    payment_url?: string | null;
    provider_status?: string | null;
    raw?: unknown;
  },
) {
  const payload: Record<string, unknown> = {};
  if (patch.status) {
    payload["status"] = patch.status;
    if (patch.status === "succeeded") payload["settled_at"] = new Date().toISOString();
  }
  if (patch.reference !== undefined) payload["reference"] = patch.reference;
  if (patch.payment_url !== undefined) payload["payment_url"] = patch.payment_url;
  if (patch.provider_status !== undefined) payload["provider_status"] = patch.provider_status;
  if (patch.raw !== undefined) payload["raw"] = patch.raw as never;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabaseAdmin
    .from("geniuspay_transactions")
    .update(payload as never)
    .eq("transaction_id", transaction_id);
  if (error) gpError("ledger_update", error.message, { transaction_id });
}

/**
 * Vérifie le paiement auprès de GeniusPay puis applique l'effet métier
 * (wallet, frais artiste, abonnement PRO, achat de piste).
 * `transaction_id` = notre identifiant interne (préfixé wallet-/artistfee-/track-/pro-…).
 */
export async function verifyAndApply(transaction_id: string) {
  const result = await applyVerifiedPayment(transaction_id);
  // Le journal passe à « réussie » dès que l'effet métier est appliqué ;
  // les échecs définitifs sont marqués dans les branches concernées.
  if (result.success) await updateGeniusPayTransaction(transaction_id, { status: "succeeded" });

  return result;
}

async function applyVerifiedPayment(transaction_id: string) {

  const check = async (gpRef: string | null | undefined) => {
    if (!gpRef)
      return { success: false, status: null, amount: null, raw: null as unknown };
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
    .select("id, user_id, status, track_id, album_id, amount, currency, flw_tx_id, flw_tx_ref")
    .eq("transaction_id", transaction_id)
    .maybeSingle();

  if (pur) {
    if (PAID_STATUSES.includes(pur.status)) {
      gpLog("purchase_already_applied", { transaction_id, purchase_id: pur.id });
      return { success: true, kind: "purchase" as const, alreadyApplied: true };
    }

    const reference = pur.flw_tx_id ?? pur.flw_tx_ref;
    const { success, status, amount, raw } = await check(reference);

    if (!success) {
      if (status && status !== "pending" && status !== "processing") {
        await supabaseAdmin
          .from("purchases")
          .update({ status: "failed", raw_response: raw as never })
          .eq("id", pur.id)
          .eq("status", "pending");
        await updateGeniusPayTransaction(transaction_id, {
          status: "failed",
          provider_status: status,
        });
      }
      gpLog("purchase_not_confirmed", { transaction_id, reference, status });

      return { success: false, kind: "purchase" as const };
    }

    // Contrôle du montant : on refuse un paiement inférieur au prix attendu.
    if (typeof amount === "number" && pur.amount && amount < pur.amount) {
      gpError("purchase_amount_mismatch", "montant insuffisant", {
        transaction_id,
        reference,
        expected: pur.amount,
        received: amount,
      });
      return { success: false, kind: "purchase" as const };
    }

    // Idempotence : la mise à jour conditionnelle ne passe qu'une seule fois.
    const { data: updated } = await supabaseAdmin
      .from("purchases")
      .update({
        status: "succeeded",
        paid_at: new Date().toISOString(),
        flw_tx_ref: reference,
        raw_response: {
          provider: GENIUSPAY_PROVIDER,
          reference,
          status,
          amount,
          verified_at: new Date().toISOString(),
        } as never,
      })
      .eq("id", pur.id)
      .in("status", ["pending", "failed"])
      .select("id");

    if (!updated || updated.length === 0) {
      gpLog("purchase_concurrent_apply_skipped", { transaction_id, purchase_id: pur.id });
      return { success: true, kind: "purchase" as const, alreadyApplied: true };
    }

    if (pur.track_id && pur.user_id) {
      await supabaseAdmin.from("track_access").upsert(
        { user_id: pur.user_id, track_id: pur.track_id, source: "purchase" },
        { onConflict: "user_id,track_id,source", ignoreDuplicates: true },
      );
    }
    gpLog("purchase_applied", {
      transaction_id,
      reference,
      purchase_id: pur.id,
      track_id: pur.track_id,
      amount: pur.amount,
      currency: pur.currency,
    });
    return { success: true, kind: "purchase" as const };
  }


  return { success: false, kind: null };
}
