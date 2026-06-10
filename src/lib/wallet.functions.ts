import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHost } from "@tanstack/react-start/server";
import { initCinetPayCheckout } from "@/lib/cinetpay.server";

// Generated types lag the wallet migration; relax for these tables only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAdmin = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;

// ============================================================
// Get wallet summary : balance + last 50 transactions
// ============================================================
export const getWalletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const [balanceRes, txRes] = await Promise.all([
      dbAdmin
        .from("wallet_balances")
        .select("balance_xof, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      dbAdmin
        .from("wallet_transactions")
        .select("id, kind, status, amount_xof, description, reference, created_at, settled_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      balance_xof: balanceRes.data?.balance_xof ?? 0,
      updated_at: balanceRes.data?.updated_at ?? null,
      transactions: txRes.data ?? [],
    };
  });

// ============================================================
// Credit wallet via Flutterwave (returns checkout link)
// ============================================================
export const creditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountXof: number }) =>
    z
      .object({
        amountXof: z.number().int().min(500).max(2_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    // SECURITY: derive host from the verified request — never accept a
    // client-supplied `origin`.
    const host = `https://${getRequestHost()}`;
    // Prefix `wallet-` is required: verifyAndApply routes by prefix.
    const transaction_id = `wallet-${userId.slice(0, 8)}-${Date.now()}`;

    // Pre-record pending transaction (webhook flips it to succeeded)
    await dbAdmin.from("wallet_transactions").insert({
      user_id: userId,
      kind: "credit",
      status: "pending",
      amount_xof: data.amountXof,
      description: "Recharge du wallet",
      reference: transaction_id,
    });

    const { payment_url } = await initCinetPayCheckout({
      amount: data.amountXof,
      description: `Recharge wallet ${data.amountXof} XOF`,
      transaction_id,
      return_url: `${host}/payment/callback?transaction_id=${encodeURIComponent(transaction_id)}`,
      notify_url: `${host}/api/public/cinetpay-webhook`,
      customer_email: email,
    });

    return { link: payment_url, tx_ref: transaction_id };
  });

// ============================================================
// Request a withdrawal (creates pending tx, admin processes)
// ============================================================
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountXof: number; method: string; destination: string }) =>
    z
      .object({
        amountXof: z.number().int().min(1000).max(2_000_000),
        method: z.enum(["mobile_money", "bank_transfer"]),
        destination: z.string().min(4).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: bal } = await dbAdmin
      .from("wallet_balances")
      .select("balance_xof")
      .eq("user_id", userId)
      .maybeSingle();

    const balance = bal?.balance_xof ?? 0;
    if (balance < data.amountXof) {
      throw new Error(`Solde insuffisant (disponible : ${balance} XOF)`);
    }

    const { error } = await dbAdmin.from("wallet_transactions").insert({
      user_id: userId,
      kind: "withdrawal",
      status: "pending",
      amount_xof: data.amountXof,
      description: `Retrait via ${data.method === "mobile_money" ? "Mobile Money" : "virement bancaire"}`,
      reference: data.destination,
      metadata: { method: data.method, destination: data.destination },
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });