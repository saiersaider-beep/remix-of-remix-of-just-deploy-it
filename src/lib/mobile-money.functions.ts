import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PurposeSchema = z.enum([
  "pro-basic",
  "pro-premium",
  "pro-vip",
  "track",
  "album",
  "wallet",
]);

/** Public — récupère les paramètres MM (numéros et tarifs). */
export const getMobileMoneySettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("mm_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Paramètres Mobile Money introuvables");
    return data as {
      flooz_number: string;
      yas_number: string;
      plan_basic_xof: number;
      plan_premium_xof: number;
      plan_vip_xof: number;
      plan_basic_days: number;
      plan_premium_days: number;
      plan_vip_days: number;
    };
  });

/** Authentifié — soumet un paiement Mobile Money. */
export const submitMobileMoneyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purpose: PurposeSchema,
        target_id: z.string().uuid().optional().nullable(),
        amount_xof: z.number().int().positive().max(10_000_000).optional(),
        operator: z.enum(["flooz", "yas"]),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(20),
        transaction_ref: z.string().trim().max(120).optional().nullable(),
        screenshot_url: z.string().trim().max(500).optional().nullable(),
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
    if (sErr || !settings) throw new Error("Paramètres Mobile Money indisponibles");

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
      data.operator === "flooz" ? settings.flooz_number : settings.yas_number;

    const { data: row, error } = await supabaseAdmin
      .from("mm_payments")
      .insert({
        user_id: context.userId,
        purpose: data.purpose,
        target_id: data.target_id ?? null,
        amount_xof: amount,
        operator: data.operator,
        merchant_number,
        full_name: data.full_name,
        phone: data.phone,
        transaction_ref: data.transaction_ref ?? null,
        screenshot_url: data.screenshot_url ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, amount_xof: amount, merchant_number };
  });

/** Admin — liste les paiements MM. */
export const listMobileMoneyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");
    let q = supabaseAdmin
      .from("mm_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // enrich with emails
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const map: Record<string, string> = {};
    for (const id of userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) map[id] = u.user.email;
    }
    return (rows ?? []).map((r) => ({ ...r, email: map[r.user_id] ?? null }));
  });

export const approveMobileMoneyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");
    const { error } = await supabaseAdmin.rpc("mm_approve_payment", { _payment_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectMobileMoneyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");
    const { error } = await supabaseAdmin.rpc("mm_reject_payment", {
      _payment_id: data.id,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Authentifié — liste mes paiements MM. */
export const listMyMobileMoneyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("mm_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin — met à jour les paramètres MM (numéros, prix). */
export const updateMobileMoneySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        flooz_number: z.string().trim().min(3).max(20),
        yas_number: z.string().trim().min(3).max(20),
        plan_basic_xof: z.number().int().positive().max(10_000_000),
        plan_premium_xof: z.number().int().positive().max(10_000_000),
        plan_vip_xof: z.number().int().positive().max(10_000_000),
        plan_basic_days: z.number().int().positive().max(3650),
        plan_premium_days: z.number().int().positive().max(3650),
        plan_vip_days: z.number().int().positive().max(3650),
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
    const { error } = await supabaseAdmin.from("mm_settings").update(data).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
