import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initCinetPayCheckout } from "@/lib/cinetpay.server";

const dbAdmin = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;

/**
 * Returns purchase / access info for a track, scoped to the current user.
 * Used by the track detail page to render Buy / Already Owned / counters.
 */
export const getTrackPurchaseInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;

    const { data: track, error: tErr } = await supabase
      .from("tracks")
      .select("id, artist_id, pricing_model, price_amount, price_currency")
      .eq("id", data.trackId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!track) throw new Error("Piste introuvable.");

    const [{ data: artist }, { data: access }, countRes] = await Promise.all([
      supabase
        .from("artists")
        .select("user_id")
        .eq("id", track.artist_id)
        .maybeSingle(),
      supabase
        .from("track_access")
        .select("id, source")
        .eq("user_id", userId)
        .eq("track_id", data.trackId)
        .maybeSingle(),
      dbAdmin.rpc("get_track_purchase_count", { _track_id: data.trackId }),
    ]);

    const isOwner = !!artist && artist.user_id === userId;
    const isFree = track.pricing_model === "free";
    const hasAccess = isOwner || isFree || !!access;

    return {
      hasAccess,
      isOwner,
      isFree,
      isPaid: track.pricing_model === "paid",
      hasPurchased: !!access && access.source === "purchase",
      purchaseCount: countRes.data ?? 0,
      priceAmount: track.price_amount ?? 0,
      priceCurrency: track.price_currency ?? "XOF",
    };
  });

/**
 * Creates a Flutterwave checkout link for a paid track purchase.
 * Idempotent:
 *  - if the user already owns the track, returns alreadyOwned + no link
 *  - if a pending purchase < 30 min old exists, reuses its link
 */
export const createTrackPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = context.supabase as unknown as SupabaseClient<any, "public", any>;

    const { data: track, error: trackErr } = await supabase
      .from("tracks")
      .select("id, title, artist_id, pricing_model, price_amount, price_currency")
      .eq("id", data.trackId)
      .maybeSingle();
    if (trackErr) throw trackErr;
    if (!track) throw new Error("Piste introuvable.");
    if (track.pricing_model !== "paid" || !track.price_amount || track.price_amount <= 0) {
      throw new Error("Cette piste n'est pas en vente.");
    }

    // Anti double-achat : si l'utilisateur a déjà accès, on ne crée pas de paiement.
    const { data: access } = await supabaseAdmin
      .from("track_access")
      .select("id")
      .eq("user_id", userId)
      .eq("track_id", track.id)
      .maybeSingle();
    if (access) {
      return { link: null as string | null, tx_ref: null as string | null, alreadyOwned: true };
    }

    // Vérif aussi côté artiste — un artiste n'a pas à racheter sa propre piste.
    const { data: artist } = await supabaseAdmin
      .from("artists")
      .select("user_id")
      .eq("id", track.artist_id)
      .maybeSingle();
    if (artist?.user_id === userId) {
      return { link: null, tx_ref: null, alreadyOwned: true };
    }

    // Réutiliser un lien de paiement en attente récent (< 30 min).
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: pending } = await supabaseAdmin
      .from("purchases")
      .select("id, transaction_id, payment_url, created_at")
      .eq("user_id", userId)
      .eq("track_id", track.id)
      .eq("status", "pending")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending?.payment_url && pending.transaction_id) {
      return { link: pending.payment_url, tx_ref: pending.transaction_id, alreadyOwned: false };
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    const host = `https://${getRequestHost()}`;
    const transaction_id = `track-${userId.slice(0, 8)}-${Date.now()}`;

    const { payment_url } = await initCinetPayCheckout({
      amount: track.price_amount,
      description: `Achat: ${track.title}`,
      transaction_id,
      return_url: `${host}/payment/callback?transaction_id=${encodeURIComponent(transaction_id)}`,
      notify_url: `${host}/api/public/cinetpay-webhook`,
      customer_email: email,
    });

    await supabaseAdmin.from("purchases").insert({
      user_id: userId,
      track_id: track.id,
      artist_id: track.artist_id,
      amount: track.price_amount,
      currency: track.price_currency || "XOF",
      status: "pending",
      provider: "cinetpay",
      transaction_id,
      payment_url,
    });

    return { link: payment_url, tx_ref: transaction_id, alreadyOwned: false };
  });

/**
 * Admin-only: accorde l'accès à une piste sans paiement.
 * Utile en phase de tests, avant la configuration du PSP.
 */
export const adminGrantTrackAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: track } = await supabaseAdmin
      .from("tracks")
      .select("id, artist_id")
      .eq("id", data.trackId)
      .maybeSingle();
    if (!track) throw new Error("Piste introuvable.");

    await supabaseAdmin
      .from("track_access")
      .upsert(
        {
          user_id: userId,
          track_id: track.id,
          source: "admin_grant",
        },
        { onConflict: "user_id,track_id" }
      );

    return { ok: true };
  });
