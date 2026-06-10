import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAdmin = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;

// Generous earning rates (per user choice)
export const POINT_EARN = {
  like: 5,
  comment: 10,
  repost: 20,
  full_listen: 10,
} as const;

// Spend
export const MINUTE_PASS_COST = 55;          // 1 minute extra preview
export const POINTS_TO_XOF_RATIO = 20;        // 20 pts = 100 XOF
export const POINTS_TO_XOF_VALUE = 100;

// ============================================================
// Award points for a single interaction — idempotent per (user, track, kind)
// Used by existing client flows (like/comment/repost) that perform the insert
// themselves via RLS and then call this fire-and-forget to earn points.
// ============================================================
export const awardInteractionPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string; kind: "like" | "comment" | "repost" }) =>
    z
      .object({
        trackId: z.string().uuid(),
        kind: z.enum(["like", "comment", "repost"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const kindKey = `earn_${data.kind}` as const;
    const points = POINT_EARN[data.kind];

    const { count } = await dbAdmin
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("song_id", data.trackId)
      .eq("kind", kindKey);

    if (count && count > 0) return { awarded: 0 };

    const { error } = await dbAdmin.rpc("award_points", {
      _user_id: userId,
      _kind: kindKey,
      _points: points,
      _song_id: data.trackId,
      _ref: null,
    });
    if (error) throw new Error(error.message);
    return { awarded: points };
  });


// ============================================================
// Solde + 50 dernières transactions points
// ============================================================
export const getPointsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [balRes, txRes] = await Promise.all([
      dbAdmin.from("user_points").select("points, updated_at").eq("user_id", userId).maybeSingle(),
      dbAdmin
        .from("point_transactions")
        .select("id, kind, points, song_id, reference, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      points: balRes.data?.points ?? 0,
      updated_at: balRes.data?.updated_at ?? null,
      transactions: txRes.data ?? [],
    };
  });

// ============================================================
// Like a track (idempotent — only first like earns points)
// ============================================================
export const toggleLikeTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const existing = await dbAdmin
      .from("track_likes")
      .select("track_id")
      .eq("track_id", data.trackId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.data) {
      await dbAdmin.from("track_likes").delete().eq("track_id", data.trackId).eq("user_id", userId);
      return { liked: false, awarded: 0 };
    }
    // Check if user has ever liked this track before (don't re-award)
    const { count } = await dbAdmin
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("song_id", data.trackId)
      .eq("kind", "earn_like");

    const { error } = await dbAdmin
      .from("track_likes")
      .insert({ track_id: data.trackId, user_id: userId });
    if (error) throw new Error(error.message);

    let awarded = 0;
    if (!count || count === 0) {
      await dbAdmin.rpc("award_points", {
        _user_id: userId,
        _kind: "earn_like",
        _points: POINT_EARN.like,
        _song_id: data.trackId,
        _ref: null,
      });
      awarded = POINT_EARN.like;
    }
    return { liked: true, awarded };
  });

// ============================================================
// Comment a track (earn 10 pts, max once per track)
// ============================================================
export const commentTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string; body: string }) =>
    z.object({ trackId: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await dbAdmin
      .from("track_comments")
      .insert({ track_id: data.trackId, user_id: userId, body: data.body });
    if (error) throw new Error(error.message);

    const { count } = await dbAdmin
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("song_id", data.trackId)
      .eq("kind", "earn_comment");

    let awarded = 0;
    if (!count || count === 0) {
      await dbAdmin.rpc("award_points", {
        _user_id: userId,
        _kind: "earn_comment",
        _points: POINT_EARN.comment,
        _song_id: data.trackId,
        _ref: null,
      });
      awarded = POINT_EARN.comment;
    }
    return { ok: true, awarded };
  });

// ============================================================
// Repost / share (earn 20 pts, max once per track)
// ============================================================
export const repostTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string; caption?: string }) =>
    z.object({ trackId: z.string().uuid(), caption: z.string().max(280).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await dbAdmin
      .from("track_reposts")
      .insert({ track_id: data.trackId, user_id: userId, caption: data.caption ?? null });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);

    const { count } = await dbAdmin
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("song_id", data.trackId)
      .eq("kind", "earn_repost");

    let awarded = 0;
    if (!count || count === 0) {
      await dbAdmin.rpc("award_points", {
        _user_id: userId,
        _kind: "earn_repost",
        _points: POINT_EARN.repost,
        _song_id: data.trackId,
        _ref: null,
      });
      awarded = POINT_EARN.repost;
    }
    return { ok: true, awarded };
  });

// ============================================================
// Reward a full listen (≥80% of duration) — max once per track per day
// ============================================================
export const rewardFullListen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await dbAdmin
      .from("point_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("song_id", data.trackId)
      .eq("kind", "earn_full_listen")
      .gte("created_at", since);
    if (count && count > 0) return { awarded: 0 };

    await dbAdmin.rpc("award_points", {
      _user_id: userId,
      _kind: "earn_full_listen",
      _points: POINT_EARN.full_listen,
      _song_id: data.trackId,
      _ref: null,
    });
    return { awarded: POINT_EARN.full_listen };
  });

// ============================================================
// Spend 55 pts to unlock 1 minute of a paid track
// ============================================================
export const buyMinutePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: res, error } = await dbAdmin.rpc("spend_points_minute", {
      _user_id: userId,
      _track_id: data.trackId,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_POINTS"))
        throw new Error(`Solde insuffisant — il te faut ${MINUTE_PASS_COST} points`);
      throw new Error(error.message);
    }
    const row = Array.isArray(res) ? res[0] : res;
    return {
      ok: true,
      newBalance: Number(row?.new_balance ?? 0),
      pointsUsed: Number(row?.points_used ?? MINUTE_PASS_COST),
    };
  });

// ============================================================
// Convert points → wallet (20 pts = 100 XOF)
// ============================================================
export const convertPointsToWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { points: number }) =>
    z.object({ points: z.number().int().min(20).max(1_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: res, error } = await dbAdmin.rpc("convert_points_to_wallet", {
      _user_id: userId,
      _points: data.points,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_POINTS"))
        throw new Error("Solde de points insuffisant");
      throw new Error(error.message);
    }
    const row = Array.isArray(res) ? res[0] : res;
    return {
      ok: true,
      newPoints: Number(row?.new_points ?? 0),
      newBalanceXof: Number(row?.new_balance_xof ?? 0),
      creditedXof: Number(row?.credited_xof ?? 0),
    };
  });

// ============================================================
// Buy track via wallet (already has enough balance)
// ============================================================
export const buyTrackWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) =>
    z.object({ trackId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: res, error } = await dbAdmin.rpc("buy_track_with_wallet", {
      _user_id: userId,
      _track_id: data.trackId,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_WALLET"))
        throw new Error("Solde wallet insuffisant");
      throw new Error(error.message);
    }
    const row = Array.isArray(res) ? res[0] : res;
    return {
      ok: true,
      newBalanceXof: Number(row?.new_balance_xof ?? 0),
      amountXof: Number(row?.amount_xof ?? 0),
    };
  });
