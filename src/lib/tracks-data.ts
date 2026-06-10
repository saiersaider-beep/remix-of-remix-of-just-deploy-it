import { supabase } from "@/integrations/supabase/client";
import type { PlayerTrack } from "@/lib/player";

export type RealTrack = PlayerTrack & {
  plays: number;
  likes: number;
  released_at: string | null;
  description?: string | null;
  artist_avatar?: string | null;
  artist_verified?: boolean;
};

const TRACK_SELECT =
  "id,artist_id,title,slug,description,audio_url,cover_url,duration_seconds,genre,plays,likes,released_at,pricing_model,price_amount,price_currency,preview_seconds,artists(name,slug,avatar_url,verified)";

function mapRow(t: any): RealTrack {
  const raw = t.artists;
  const a = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  return {
    id: t.id,
    artist_id: t.artist_id,
    title: t.title,
    slug: t.slug,
    audio_url: t.audio_url,
    cover_url: t.cover_url,
    duration_seconds: t.duration_seconds,
    genre: t.genre,
    pricing_model: t.pricing_model,
    price_amount: t.price_amount,
    price_currency: t.price_currency,
    preview_seconds: t.preview_seconds,
    description: t.description ?? null,
    artist_name: a?.name ?? "Artiste inconnu",
    artist_slug: a?.slug ?? "",
    artist_avatar: a?.avatar_url ?? null,
    artist_verified: !!a?.verified,
    plays: t.plays ?? 0,
    likes: t.likes ?? 0,
    released_at: t.released_at,
  };
}

export type TrackListOpts = {
  limit?: number;
  order?: "newest" | "popular" | "trending";
  genre?: string | null;
  pricing?: "all" | "free" | "paid";
};

export async function fetchTracks(opts: TrackListOpts = {}): Promise<RealTrack[]> {
  let q = supabase.from("tracks").select(TRACK_SELECT).eq("is_published", true);
  if (opts.genre) q = q.ilike("genre", `%${opts.genre}%`);
  if (opts.pricing && opts.pricing !== "all") q = q.eq("pricing_model", opts.pricing);
  if (opts.order === "popular") q = q.order("plays", { ascending: false });
  else if (opts.order === "trending")
    q = q.order("likes", { ascending: false }).order("plays", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  q = q.limit(opts.limit ?? 30);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function fetchTopArtists(limit = 14) {
  const { data, error } = await supabase
    .from("artists")
    .select("id,name,slug,avatar_url,verified,monthly_listeners")
    .order("monthly_listeners", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrendingTracks(days = 7, limit = 5): Promise<RealTrack[]> {
  const { data: rows, error } = await supabase.rpc("fetch_trending_tracks", {
    _days: days,
    _limit: limit,
  });
  if (error) throw error;
  const trending = (rows ?? []) as Array<{ track_id: string; recent_plays: number }>;
  if (trending.length === 0) return [];
  const ids = trending.map((r) => r.track_id);
  const { data, error: tErr } = await supabase
    .from("tracks")
    .select(TRACK_SELECT)
    .in("id", ids)
    .eq("is_published", true);
  if (tErr) throw tErr;
  const byId = new Map((data ?? []).map((t: any) => [t.id, mapRow(t)]));
  const playsById = new Map(trending.map((r) => [r.track_id, Number(r.recent_plays)]));
  return ids
    .map((id) => {
      const t = byId.get(id);
      if (!t) return null;
      // Override `plays` with the recent window count for display
      return { ...t, plays: playsById.get(id) ?? 0 } as RealTrack;
    })
    .filter((x): x is RealTrack => !!x);
}

export async function fetchMyPurchasedTracks(userId: string): Promise<RealTrack[]> {
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("track_id, paid_at, created_at")
    .eq("user_id", userId)
    .eq("status", "paid")
    .not("track_id", "is", null)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  const ids = Array.from(new Set((purchases ?? []).map((p) => p.track_id).filter(Boolean) as string[]));
  if (ids.length === 0) return [];
  const { data, error: tErr } = await supabase
    .from("tracks")
    .select(TRACK_SELECT)
    .in("id", ids);
  if (tErr) throw tErr;
  return (data ?? []).map(mapRow);
}

export async function fetchMyAccessIds(): Promise<Set<string>> {
  // Returns the IDs of tracks the current user has paid access to.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data, error } = await supabase
    .from("track_access")
    .select("track_id")
    .eq("user_id", user.id);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.track_id));
}

export async function fetchPurchaseCount(trackId: string): Promise<number> {
  const { count, error } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("track_id", trackId)
    .eq("status", "paid");
  if (error) return 0;
  return count ?? 0;
}

export async function fetchArtistSales(artistId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id,amount,currency,artist_revenue,status,paid_at,created_at,track_id,album_id,user_id")
    .eq("artist_id", artistId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export function formatPrice(amount: number, currency = "XOF") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatPlays(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
