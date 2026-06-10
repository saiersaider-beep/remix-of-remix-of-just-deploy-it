import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initCinetPayCheckout } from "@/lib/cinetpay.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAdmin = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;

export const ARTIST_FEE_XOF = 3000;

/**
 * Returns whether the current user has paid the artist creation fee.
 */
export const getArtistFeeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await dbAdmin
      .from("artist_creation_fees")
      .select("status, method, amount_xof, paid_at, flw_payment_link")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      hasPaid: data?.status === "paid",
      amountXof: ARTIST_FEE_XOF,
      pendingLink: data?.status === "pending" ? data.flw_payment_link ?? null : null,
    };
  });

/**
 * Create (or reuse) a Flutterwave checkout link for the 3000 XOF artist fee.
 */
export const createArtistFeePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // Already paid?
    const { data: existing } = await dbAdmin
      .from("artist_creation_fees")
      .select("id, status, flw_payment_link, flw_tx_ref, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.status === "paid") {
      return { alreadyPaid: true, link: null as string | null, tx_ref: null as string | null };
    }

    // Reuse pending link < 30 min old
    if (
      existing?.status === "pending" &&
      existing.flw_payment_link &&
      existing.flw_tx_ref &&
      new Date(existing.created_at).getTime() > Date.now() - 30 * 60 * 1000
    ) {
      return { alreadyPaid: false, link: existing.flw_payment_link, tx_ref: existing.flw_tx_ref };
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    const host = `https://${getRequestHost()}`;
    // Prefix `artistfee-` is required: verifyAndApply routes by prefix.
    const transaction_id = `artistfee-${userId.slice(0, 8)}-${Date.now()}`;

    const { payment_url } = await initCinetPayCheckout({
      amount: ARTIST_FEE_XOF,
      description: `Frais création profil artiste (${ARTIST_FEE_XOF} XOF)`,
      transaction_id,
      return_url: `${host}/payment/callback?transaction_id=${encodeURIComponent(transaction_id)}`,
      notify_url: `${host}/api/public/cinetpay-webhook`,
      customer_email: email,
    });

    await dbAdmin
      .from("artist_creation_fees")
      .upsert(
        {
          user_id: userId,
          status: "pending",
          amount_xof: ARTIST_FEE_XOF,
          method: "cinetpay",
          flw_tx_ref: transaction_id,
          flw_payment_link: payment_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    return { alreadyPaid: false, link: payment_url, tx_ref: transaction_id };
  });

/**
 * Pay the artist fee from the user's wallet balance (atomic via RPC).
 */
export const payArtistFeeWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await dbAdmin.rpc("pay_artist_fee_with_wallet", {
      _user_id: userId,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_WALLET")) {
        throw new Error("Solde du wallet insuffisant. Recharge-le ou paie par CinetPay.");
      }
      if (error.message?.includes("ALREADY_PAID")) {
        return { alreadyPaid: true };
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      alreadyPaid: false,
      newBalanceXof: row?.new_balance_xof ?? 0,
      amountXof: row?.amount_xof ?? ARTIST_FEE_XOF,
    };
  });
