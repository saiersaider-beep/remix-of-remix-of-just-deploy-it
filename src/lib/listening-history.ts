import { supabase } from "@/integrations/supabase/client";

/**
 * Append a play to the user's listening history. Fire-and-forget.
 * Skipped silently if user is not signed in.
 */
export async function recordListening(trackId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("listening_history").insert({ user_id: user.id, track_id: trackId });
}

export type RecentTrack = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number;
  artist_id: string;
  artist_name: string;
  artist_slug: string;
  pricing_model: string;
  price_amount: number;
  price_currency: string;
  preview_seconds: number;
  played_at: string;
};

/**
 * Fetch the most recent unique tracks the user listened to.
 */
export async function fetchRecentlyPlayed(limit = 30): Promise<RecentTrack[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id, played_at")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .limit(limit * 4); // overfetch to dedupe
  if (error) throw error;
  const seen = new Set<string>();
  const unique: { track_id: string; played_at: string }[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.track_id)) continue;
    seen.add(row.track_id);
    unique.push(row);
    if (unique.length >= limit) break;
  }
  if (unique.length === 0) return [];

  const ids = unique.map((u) => u.track_id);
  const { data: tracks } = await supabase
    .from("tracks")
    .select("id,title,slug,cover_url,audio_url,duration_seconds,artist_id,pricing_model,price_amount,price_currency,preview_seconds,artists(name,slug)")
    .in("id", ids);
  const tmap = new Map((tracks ?? []).map((t: any) => [t.id, t]));

  return unique
    .map((u) => {
      const t: any = tmap.get(u.track_id);
      if (!t) return null;
      const a = Array.isArray(t.artists) ? t.artists[0] : t.artists;
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        cover_url: t.cover_url,
        audio_url: t.audio_url,
        duration_seconds: t.duration_seconds,
        artist_id: t.artist_id,
        artist_name: a?.name ?? "Inconnu",
        artist_slug: a?.slug ?? "",
        pricing_model: t.pricing_model,
        price_amount: t.price_amount,
        price_currency: t.price_currency,
        preview_seconds: t.preview_seconds,
        played_at: u.played_at,
      } as RecentTrack;
    })
    .filter((x): x is RecentTrack => !!x);
}
