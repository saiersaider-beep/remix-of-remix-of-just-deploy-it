import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

type BillingSubscription = {
  id: string;
  plan: string;
  status: string;
  amount: number | null;
  currency: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  flw_tx_ref: string | null;
  created_at: string;
  updated_at: string | null;
};

type BillingPurchase = {
  id: string;
  amount: number | null;
  currency: string | null;
  status: string;
  flw_tx_ref: string | null;
  paid_at: string | null;
  created_at: string;
  track_id: string | null;
  album_id: string | null;
};

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;

    const [subsRes, purchasesRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id, plan, status, amount, currency, current_period_start, current_period_end, cancelled_at, flw_tx_ref, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("id, amount, currency, status, flw_tx_ref, paid_at, created_at, track_id, album_id")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      subscriptions: (subsRes.data ?? []) as BillingSubscription[],
      purchases: (purchasesRes.data ?? []) as BillingPurchase[],
      error: subsRes.error?.message ?? purchasesRes.error?.message ?? null,
    };
  });
