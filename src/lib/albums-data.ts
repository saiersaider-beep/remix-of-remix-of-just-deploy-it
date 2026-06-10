import { supabase } from "@/integrations/supabase/client";

export type AlbumSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  released_at: string;
  plays: number;
  artist_id: string;
  artist_name: string;
  artist_slug: string;
  track_count: number;
};

export async function fetchAlbums(opts: { limit?: number; offset?: number } = {}): Promise<AlbumSummary[]> {
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabase
    .from("albums")
    .select("id,slug,title,description,cover_url,released_at,plays,artist_id,artists(name,slug)")
    .eq("is_published", true)
    .order("released_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: counts } = await supabase
    .from("album_tracks")
    .select("album_id")
    .in("album_id", ids);
  const countMap = new Map<string, number>();
  (counts ?? []).forEach((r: any) => countMap.set(r.album_id, (countMap.get(r.album_id) ?? 0) + 1));

  return rows.map((a) => {
    const ar = Array.isArray(a.artists) ? a.artists[0] : a.artists;
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description,
      cover_url: a.cover_url,
      released_at: a.released_at,
      plays: a.plays ?? 0,
      artist_id: a.artist_id,
      artist_name: ar?.name ?? "Artiste inconnu",
      artist_slug: ar?.slug ?? "",
      track_count: countMap.get(a.id) ?? 0,
    } as AlbumSummary;
  });
}

export async function fetchAlbumBySlug(slug: string) {
  const { data, error } = await supabase
    .from("albums")
    .select("id,slug,title,description,cover_url,released_at,plays,artist_id,artists(name,slug,avatar_url,verified)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ar = Array.isArray((data as any).artists) ? (data as any).artists[0] : (data as any).artists;

  const { data: rows } = await supabase
    .from("album_tracks")
    .select("position,track_id,tracks(id,title,slug,duration_seconds,cover_url,audio_url,artist_id,pricing_model,price_amount,price_currency,preview_seconds,genre,plays)")
    .eq("album_id", data.id)
    .order("position", { ascending: true });

  const tracks = (rows ?? []).map((r: any) => {
    const t = Array.isArray(r.tracks) ? r.tracks[0] : r.tracks;
    return t ? { position: r.position, ...t } : null;
  }).filter(Boolean);

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: (data as any).description,
    cover_url: (data as any).cover_url,
    released_at: (data as any).released_at,
    plays: (data as any).plays ?? 0,
    artist_id: data.artist_id,
    artist_name: ar?.name ?? "Artiste inconnu",
    artist_slug: ar?.slug ?? "",
    artist_avatar: ar?.avatar_url ?? null,
    artist_verified: !!ar?.verified,
    tracks,
  };
}

export async function fetchPublicPlaylists(opts: { limit?: number } = {}) {
  const limit = opts.limit ?? 24;
  const { data, error } = await supabase
    .from("playlists")
    .select("id,slug,title,description,created_at,user_id")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const ids = rows.map((r) => r.id);

  const [profilesRes, trackCounts] = await Promise.all([
    supabase.from("profiles").select("id,display_name").in("id", ownerIds),
    supabase.from("playlist_tracks").select("playlist_id").in("playlist_id", ids),
  ]);
  const profMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const tcMap = new Map<string, number>();
  (trackCounts.data ?? []).forEach((r: any) => tcMap.set(r.playlist_id, (tcMap.get(r.playlist_id) ?? 0) + 1));

  return rows.map((p) => ({
    ...p,
    owner_name: profMap.get(p.user_id)?.display_name ?? "Utilisateur",
    track_count: tcMap.get(p.id) ?? 0,
  }));
}

export async function fetchGenreCounts(): Promise<{ genre: string; count: number }[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("genre")
    .eq("is_published", true)
    .not("genre", "is", null);
  if (error) throw error;
  const map = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const g = (r.genre ?? "").trim();
    if (!g) return;
    map.set(g, (map.get(g) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchTracksByGenre(genre: string, limit = 50) {
  const { data, error } = await supabase
    .from("tracks")
    .select("id,artist_id,title,slug,cover_url,audio_url,duration_seconds,genre,plays,pricing_model,price_amount,price_currency,preview_seconds,artists(name,slug)")
    .eq("is_published", true)
    .ilike("genre", genre)
    .order("plays", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((t: any) => {
    const a = Array.isArray(t.artists) ? t.artists[0] : t.artists;
    return { ...t, artist_name: a?.name ?? "Inconnu", artist_slug: a?.slug ?? "" };
  });
}
