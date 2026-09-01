import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PLANS,
  GENIUSPAY_PROVIDER,
  GENIUSPAY_DEFAULT_API_URL,
  adminGuard,
  verifyAndApply,
  initGeniusPayCheckout,
  PAID_STATUSES,
  gpLog,
  recordGeniusPayTransaction,
  updateGeniusPayTransaction,
} from "@/lib/geniuspay.server";

export const getGeniusPaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.userId);
    const { data, error } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { settings: null };

    // Les secrets ne quittent jamais le serveur : on n'expose que leur présence.
    return {
      settings: {
        api_key: data.api_key ?? "",
        api_url: data.api_url,
        currency: data.currency,
        mode: data.mode,
        enabled: data.enabled,
        has_secret_key: !!data.secret_key,
        has_webhook_secret: !!data.site_id,
        updated_at: data.updated_at as string,
      },
    };
  });

export const updateGeniusPaySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        api_key: z.string().trim().min(1, "La clé publique (X-API-Key) est requise.").max(200),
        // Laisser vide = conserver la valeur déjà enregistrée.
        secret_key: z.string().trim().max(200).optional().nullable(),
        site_id: z.string().trim().max(200).optional().nullable(), // secret webhook whsec_...
        api_url: z.string().url("L'URL de l'API doit être une URL valide.").max(300),
        currency: z.string().trim().min(3).max(5),
        mode: z.enum(["test", "prod"]),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("payment_settings")
      .select("id, secret_key, site_id")
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const secret_key = data.secret_key || existing?.secret_key || null;
    if (!secret_key) throw new Error("La clé secrète (X-API-Secret) est requise.");

    const payload = {
      api_key: data.api_key || null,
      site_id: data.site_id || existing?.site_id || null,
      secret_key,
      api_url: data.api_url || GENIUSPAY_DEFAULT_API_URL,
      currency: data.currency,
      mode: data.mode,
      enabled: data.enabled,
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("payment_settings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("payment_settings")
        .insert({ provider: GENIUSPAY_PROVIDER, ...payload });
      if (error) throw new Error(error.message);
    }
    gpLog("settings_saved", { mode: data.mode, enabled: data.enabled, currency: data.currency });
    return { ok: true };
  });


/** Test de connexion : appelle /account avec les clés enregistrées. */
export const testGeniusPayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.userId);
    const { data } = await supabaseAdmin
      .from("payment_settings")
      .select("api_key, secret_key, api_url")
      .eq("provider", GENIUSPAY_PROVIDER)
      .limit(1)
      .maybeSingle();
    if (!data?.api_key || !data?.secret_key) throw new Error("Clés API manquantes.");
    const base = (data.api_url || GENIUSPAY_DEFAULT_API_URL).replace(/\/+$/, "");
    const res = await fetch(`${base}/account`, {
      headers: {
        "X-API-Key": data.api_key,
        "X-API-Secret": data.secret_key,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { business_name?: string; email?: string; status?: string; environment?: string };
      message?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.success === false) {
      throw new Error(json.error?.message || json.message || "Connexion refusée par GeniusPay");
    }
    return { account: json.data ?? null };
  });

const PurposeSchema = z.enum([
  "pro-basic",
  "pro-premium",
  "pro-vip",
  "pro-month",
  "pro-year",
  "pro-life",
  "track",
  "album",
  "wallet",
]);

export const initGeniusPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purpose: PurposeSchema,
        target_id: z.string().uuid().optional(),
        // Uniquement pour la recharge du portefeuille.
        amount_xof: z.number().int().min(500).max(2_000_000).optional(),
        phone: z.string().trim().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    let amount = 0;
    let description = "";
    let artistId: string | null = null;
    if (data.purpose.startsWith("pro-")) {
      const plan = PLANS[data.purpose];
      if (!plan) throw new Error("Plan inconnu");
      amount = plan.amount;
      description = `VinaSound ${plan.name}`;
    } else if (data.purpose === "wallet") {
      if (!data.amount_xof) throw new Error("Montant requis");
      amount = data.amount_xof;
      description = `Recharge wallet ${amount} XOF`;
    } else if (data.purpose === "track") {
      if (!data.target_id) throw new Error("ID de la piste requis");
      const { data: t } = await supabaseAdmin
        .from("tracks")
        .select("price_amount, title, artist_id")
        .eq("id", data.target_id)
        .maybeSingle();
      if (!t || !t.price_amount) throw new Error("Piste non payante");
      amount = t.price_amount;
      artistId = t.artist_id ?? null;
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

    const host = `https://${getRequestHost()}`;
    const purposePrefix = data.purpose.startsWith("pro-")
      ? "pro"
      : data.purpose === "track"
        ? "track"
        : data.purpose === "wallet"
          ? "wallet"
          : "album";
    const transaction_id = `${purposePrefix}-${userId.slice(0, 8)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    // Les abonnements PRO reviennent sur la page de confirmation dédiée
    // (abonnement actif + lien de désabonnement).
    const returnPath = data.purpose.startsWith("pro-")
      ? "/subscription/confirmation"
      : "/payment/callback";
    const return_url = `${host}${returnPath}?transaction_id=${encodeURIComponent(transaction_id)}`;
    const notify_url = `${host}/api/public/geniuspay-webhook`;

    const isSub = data.purpose.startsWith("pro-");
    const isWallet = data.purpose === "wallet";

    // Journal unifié : chaque transaction GeniusPay est tracée en base.
    await recordGeniusPayTransaction({
      user_id: userId,
      purpose: data.purpose,
      target_id: data.target_id ?? null,
      transaction_id,
      amount,
      description,
    });

    if (isSub) {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan: data.purpose,
        status: "pending",
        amount,
        currency: "XOF",
        provider: GENIUSPAY_PROVIDER,
        transaction_id,
      });
    } else if (isWallet) {
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: userId,
        kind: "credit",
        status: "pending",
        amount_xof: amount,
        description: "Recharge du wallet",
        reference: transaction_id,
      });
    } else {
      await supabaseAdmin.from("purchases").insert({
        user_id: userId,
        track_id: data.purpose === "track" ? data.target_id : null,
        album_id: data.purpose === "album" ? data.target_id : null,
        artist_id: artistId,
        amount,
        currency: "XOF",
        status: "pending",
        provider: GENIUSPAY_PROVIDER,
        transaction_id,
      });
    }


    const { data: udata } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = udata?.user?.email ?? undefined;
    const meta = (udata?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const firstName = (meta.first_name as string) || (meta.given_name as string) || undefined;
    const lastName = (meta.last_name as string) || (meta.family_name as string) || undefined;

    const { payment_url, reference, raw } = await initGeniusPayCheckout({
      amount,
      description,
      transaction_id,
      return_url,
      notify_url,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_phone: data.phone || undefined,
      metadata: { user_id: userId, purpose: data.purpose },
    });

    if (isWallet) {
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ flw_tx_ref: reference })
        .eq("reference", transaction_id);
    } else {
      const table = isSub ? "subscriptions" : "purchases";
      await supabaseAdmin
        .from(table)
        .update({ payment_url, flw_tx_id: reference, flw_tx_ref: reference, raw_response: raw as never })
        .eq("transaction_id", transaction_id);
    }

    await updateGeniusPayTransaction(transaction_id, { reference, payment_url });


    return { payment_url, transaction_id, reference };

  });

export const verifyGeniusPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transaction_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await verifyAndApply(data.transaction_id);
    return { ...result, userId: context.userId };
  });

/**
 * Admin : liste des achats payés via GeniusPay (référence MTX, statut, piste).
 */
export const listGeniusPayPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "succeeded", "completed", "failed"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);

    let q = supabaseAdmin
      .from("purchases")
      .select(
        "id, user_id, track_id, album_id, amount, currency, status, transaction_id, flw_tx_id, paid_at, created_at",
      )
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    const trackIds = [...new Set(list.map((r) => r.track_id).filter(Boolean))] as string[];
    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];

    const [tracksRes, accessRes, profilesRes] = await Promise.all([
      trackIds.length
        ? supabaseAdmin.from("tracks").select("id, title, slug").in("id", trackIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
      trackIds.length
        ? supabaseAdmin
            .from("track_access")
            .select("user_id, track_id")
            .in("track_id", trackIds)
        : Promise.resolve({ data: [] as { user_id: string; track_id: string }[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    ]);

    const tracks = new Map((tracksRes.data ?? []).map((t) => [t.id, t]));
    const access = new Set((accessRes.data ?? []).map((a) => `${a.user_id}:${a.track_id}`));
    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));

    return {
      purchases: list.map((r) => ({
        id: r.id,
        reference: r.flw_tx_id ?? null,
        transactionId: r.transaction_id ?? null,
        status: r.status,
        amount: r.amount ?? 0,
        currency: r.currency ?? "XOF",
        createdAt: r.created_at,
        paidAt: r.paid_at,
        buyer: profiles.get(r.user_id) ?? r.user_id.slice(0, 8),
        trackTitle: r.track_id ? (tracks.get(r.track_id)?.title ?? "—") : "Album",
        trackSlug: r.track_id ? (tracks.get(r.track_id)?.slug ?? null) : null,
        unlocked: r.track_id ? access.has(`${r.user_id}:${r.track_id}`) : false,
      })),
    };
  });

/**
 * Vérifie une transaction puis renvoie de quoi afficher la page de confirmation.
 */
export const getPurchaseConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transaction_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    // Lecture seule : la page /purchase/success n'applique jamais un paiement.
    // Seule la vérification serveur (webhook / réconciliation) débloque une piste.
    const { data: pur } = await supabaseAdmin
      .from("purchases")
      .select("user_id, track_id, amount, currency, status, flw_tx_id, flw_tx_ref")
      .eq("transaction_id", data.transaction_id)
      .maybeSingle();

    if (!pur || pur.user_id !== context.userId) {
      return {
        state: "not_found" as const,
        reference: null,
        track: null,
        amount: 0,
        currency: "XOF",
      };
    }

    const paid = PAID_STATUSES.includes(pur.status);
    let unlocked = false;
    let track: { title: string; slug: string } | null = null;

    if (pur.track_id) {
      const [{ data: t }, { data: acc }] = await Promise.all([
        supabaseAdmin
          .from("tracks")
          .select("title, slug")
          .eq("id", pur.track_id)
          .maybeSingle(),
        supabaseAdmin
          .from("track_access")
          .select("id")
          .eq("user_id", pur.user_id)
          .eq("track_id", pur.track_id)
          .maybeSingle(),
      ]);
      track = t ? { title: t.title, slug: t.slug } : null;
      unlocked = !!acc;
    }

    return {
      state: paid ? ("paid" as const) : pur.status === "failed" ? ("failed" as const) : ("pending" as const),
      unlocked,
      reference: pur.flw_tx_ref ?? pur.flw_tx_id ?? null,
      track,
      amount: pur.amount ?? 0,
      currency: pur.currency ?? "XOF",
    };
  });

/**
 * Réconciliation serveur : interroge GeniusPay pour la transaction de
 * l'utilisateur courant et applique le résultat (idempotent).
 * Utilisée si le webhook n'est pas encore arrivé.
 */
export const reconcileGeniusPayPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transaction_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: pur } = await supabaseAdmin
      .from("purchases")
      .select("user_id")
      .eq("transaction_id", data.transaction_id)
      .maybeSingle();
    if (!pur || pur.user_id !== context.userId) return { success: false };
    const result = await verifyAndApply(data.transaction_id);
    return { success: !!result.success };
  });


/**
 * Admin : toutes les transactions GeniusPay (achats, abonnements PRO,
 * recharges wallet, frais artiste) avec statut, montant, date et,
 * pour les achats de piste, l'état du déblocage.
 */
export const listGeniusPayTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["all", "purchase", "subscription", "wallet", "artist_fee"]).default("all"),
        status: z.enum(["all", "pending", "paid", "failed"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);

    // Source de vérité : le journal geniuspay_transactions, alimenté à la
    // création du paiement puis mis à jour à chaque vérification.
    let q = supabaseAdmin
      .from("geniuspay_transactions")
      .select(
        "id, user_id, purpose, target_id, transaction_id, reference, amount, currency, status, description, provider_status, settled_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") {
      q = q.eq("status", data.status === "paid" ? "succeeded" : data.status);
    }

    const { data: rowsRaw, error } = await q;
    if (error) throw new Error(error.message);

    const kindOf = (purpose: string): "purchase" | "subscription" | "wallet" | "artist_fee" =>
      purpose.startsWith("pro-")
        ? "subscription"
        : purpose === "wallet"
          ? "wallet"
          : purpose === "artist_fee"
            ? "artist_fee"
            : "purchase";

    const all = (rowsRaw ?? []).filter((r) =>
      data.kind === "all" ? true : kindOf(r.purpose) === data.kind,
    );

    const trackIds = [
      ...new Set(all.filter((r) => r.purpose === "track" && r.target_id).map((r) => r.target_id!)),
    ];
    const userIds = [...new Set(all.map((r) => r.user_id))];

    const [tracksRes, accessRes, profilesRes] = await Promise.all([
      trackIds.length
        ? supabaseAdmin.from("tracks").select("id, title, slug").in("id", trackIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
      trackIds.length
        ? supabaseAdmin.from("track_access").select("user_id, track_id").in("track_id", trackIds)
        : Promise.resolve({ data: [] as { user_id: string; track_id: string }[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    ]);

    const tracks = new Map((tracksRes.data ?? []).map((t) => [t.id, t]));
    const access = new Set((accessRes.data ?? []).map((a) => `${a.user_id}:${a.track_id}`));
    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));

    const label = (r: (typeof all)[number]) => {
      if (r.purpose === "track" && r.target_id)
        return `Piste : ${tracks.get(r.target_id)?.title ?? r.description ?? "—"}`;
      if (r.purpose.startsWith("pro-")) return `Abonnement ${r.purpose}`;
      if (r.purpose === "wallet") return "Recharge wallet";
      if (r.purpose === "artist_fee") return "Frais création artiste";
      return r.description ?? "Achat";
    };

    return {
      transactions: all.map((r) => ({
        id: r.id,
        kind: kindOf(r.purpose),
        label: label(r),
        reference: r.reference,
        transactionId: r.transaction_id,
        status: r.status === "succeeded" ? "paid" : r.status,
        providerStatus: r.provider_status,
        amount: r.amount ?? 0,
        currency: r.currency ?? "XOF",
        date: r.settled_at ?? r.created_at,
        userId: r.user_id,
        buyer: profiles.get(r.user_id) ?? r.user_id.slice(0, 8),
        trackSlug:
          r.purpose === "track" && r.target_id ? (tracks.get(r.target_id)?.slug ?? null) : null,
        unlocked:
          r.purpose === "track" && r.target_id
            ? access.has(`${r.user_id}:${r.target_id}`)
            : null,
      })),
    };
  });

/**
 * Admin : paiements PRO (abonnements) via GeniusPay, avec leur propre statut
 * et l'état du déblocage PRO (badge artiste + période active).
 */
export const listGeniusPayProPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        plan: z.enum(["all", "pro-month", "pro-year", "pro-life"]).default("all"),
        status: z.enum(["all", "pending", "paid", "failed"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);

    let q = supabaseAdmin
      .from("subscriptions")
      .select(
        "id, user_id, plan, amount, currency, status, transaction_id, flw_tx_id, flw_tx_ref, current_period_start, current_period_end, cancelled_at, created_at",
      )
      .eq("provider", GENIUSPAY_PROVIDER)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.plan !== "all") q = q.eq("plan", data.plan);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const subs = rows ?? [];

    const userIds = [...new Set(subs.map((s) => s.user_id))];
    const [profRes, artistRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      userIds.length
        ? supabaseAdmin.from("artists").select("user_id, slug, pro_badge").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; slug: string; pro_badge: string }[] }),
    ]);
    const profiles = new Map((profRes.data ?? []).map((p) => [p.id, p.display_name]));
    const artists = new Map((artistRes.data ?? []).map((a) => [a.user_id, a]));

    const now = Date.now();
    const payments = subs.map((s) => {
      const artist = artists.get(s.user_id);
      const periodActive = s.current_period_end ? +new Date(s.current_period_end) > now : false;
      const paid = PAID_STATUSES.includes(s.status) || s.status === "active";
      return {
        id: s.id,
        plan: s.plan,
        planLabel: PLANS[s.plan as keyof typeof PLANS]?.name ?? s.plan,
        reference: s.flw_tx_id ?? s.flw_tx_ref,
        transactionId: s.transaction_id,
        status: s.status,
        amount: s.amount ?? 0,
        currency: s.currency ?? "XOF",
        userId: s.user_id,
        buyer: profiles.get(s.user_id) ?? s.user_id.slice(0, 8),
        artistSlug: artist?.slug ?? null,
        proBadge: artist?.pro_badge ?? null,
        periodStart: s.current_period_start,
        periodEnd: s.current_period_end,
        cancelledAt: s.cancelled_at,
        unlocked: paid && (artist?.pro_badge === "pro" || periodActive),
        date: s.created_at,
      };
    });

    const bucket = (s: string) =>
      PAID_STATUSES.includes(s) || s === "active" ? "paid" : s === "failed" ? "failed" : "pending";
    const filtered =
      data.status === "all" ? payments : payments.filter((p) => bucket(p.status) === data.status);

    return { payments: filtered };
  });

/**
 * Abonnement PRO de l'utilisateur courant (le plus récent actif),
 * pour la page de confirmation après retour de GeniusPay.
 */
export const getMyProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "id, plan, status, amount, currency, current_period_start, current_period_end, cancelled_at, created_at",
      )
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { subscription: null };
    return {
      subscription: {
        id: data.id,
        plan: data.plan,
        planName: PLANS[data.plan]?.name ?? data.plan,
        status: data.status,
        amount: data.amount ?? 0,
        currency: data.currency ?? "XOF",
        periodStart: data.current_period_start,
        periodEnd: data.current_period_end,
        cancelledAt: data.cancelled_at,
      },
    };
  });

/** Désabonnement : l'abonnement PRO est annulé et le badge PRO retiré. */
export const cancelMyProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: updated, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active")
      .select("id");
    if (error) throw new Error(error.message);

    // Plus aucun abonnement actif : on retire le badge PRO.
    const { data: stillActive } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!stillActive) {
      await supabaseAdmin.from("artists").update({ pro_badge: "none" }).eq("user_id", userId);
    }
    gpLog("subscription_cancelled", { user_id: userId, count: updated?.length ?? 0 });
    return { cancelled: updated?.length ?? 0 };
  });
