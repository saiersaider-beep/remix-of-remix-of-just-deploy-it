import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAdmin = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;

function genRef() {
  // short readable ref, e.g. GS-7K2P9X
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `GS-${s}`;
}

async function isAdmin(userId: string) {
  const { data } = await dbAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ============================================================
// USER: create a mobile-money top-up request (TMoney / Flooz)
// ============================================================
export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountXof: number; operator: "tmoney" | "flooz"; phone: string }) =>
    z
      .object({
        amountXof: z.number().int().min(500).max(2_000_000),
        operator: z.enum(["tmoney", "flooz"]),
        phone: z.string().min(8).max(20).regex(/^[+0-9 ]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const reference_code = genRef();

    const { data: row, error } = await dbAdmin
      .from("wallet_topup_requests")
      .insert({
        user_id: userId,
        amount_xof: data.amountXof,
        operator: data.operator,
        phone: data.phone.trim(),
        reference_code,
      })
      .select("id, reference_code, amount_xof, operator, phone, status, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

// ============================================================
// USER: list my own top-up requests
// ============================================================
export const listMyTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await dbAdmin
      .from("wallet_topup_requests")
      .select("id, amount_xof, operator, phone, reference_code, status, rejection_reason, created_at, processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================
// ADMIN: list pending top-ups (with user info)
// ============================================================
export const listPendingTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Accès admin requis");

    const { data, error } = await dbAdmin
      .from("wallet_topup_requests")
      .select("id, user_id, amount_xof, operator, phone, reference_code, status, rejection_reason, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    let profiles: Record<string, { display_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await dbAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name }]));
    }
    return (data ?? []).map((r) => ({ ...r, display_name: profiles[r.user_id]?.display_name ?? null }));
  });

// ============================================================
// ADMIN: approve a top-up (calls RPC -> credits wallet + points)
// ============================================================
export const approveTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;
    // Call via authenticated client so RPC sees auth.uid() for admin check
    const { error } = await supabase.rpc("approve_wallet_topup", { _request_id: data.requestId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ADMIN: reject a top-up
// ============================================================
export const rejectTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string; reason: string }) =>
    z.object({ requestId: z.string().uuid(), reason: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;
    const { error } = await supabase.rpc("reject_wallet_topup", {
      _request_id: data.requestId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ADMIN ONLY: dev credit (test wallet top-up).
// HARDENED: requires admin role. Without this check, any authenticated user
// could credit themselves up to 1 000 000 XOF per call (financial loss).
// The optional targetUserId is also gated: only admins may credit another
// user's wallet, otherwise the call is forced onto the caller.
// ============================================================
export const devCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountXof: number; targetUserId?: string }) =>
    z
      .object({
        amountXof: z.number().int().min(100).max(1_000_000),
        targetUserId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!(await isAdmin(userId))) {
      // Generic message — do not leak the role-check mechanism.
      throw new Error("Accès admin requis");
    }
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;
    const target = data.targetUserId ?? userId;
    const { error } = await supabase.rpc("dev_credit_wallet", {
      _user_id: target,
      _amount_xof: data.amountXof,
      _note: "Crédit de test (admin)",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Check whether the current user is admin (for UI gating)
// ============================================================
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { isAdmin: await isAdmin(context.userId) };
  });
