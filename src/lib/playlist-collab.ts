import { supabase } from "@/integrations/supabase/client";

type PlaylistRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
  user_id: string;
};

export type PlaylistRole = "editor" | "viewer";

export type PlaylistDetail = Pick<PlaylistRow, "id" | "slug" | "title" | "description" | "created_at" | "user_id"> & {
  owner_name: string;
  is_owner: boolean;
  my_role: PlaylistRole | "owner" | null;
};

export type PlaylistTrackItem = {
  id: string;
  position: number;
  added_by: string;
  added_by_name: string;
  created_at: string;
  track: {
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
    genre: string | null;
  };
};

export type PlaylistCollaborator = {
  id: string;
  user_id: string;
  role: PlaylistRole;
  invited_by: string | null;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
};

export type PlaylistSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
  user_id: string;
  is_owner: boolean;
  my_role: PlaylistRole | "owner";
  collaborator_count: number;
  track_count: number;
};

export async function getPlaylistBySlug(slug: string): Promise<PlaylistDetail | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: playlist, error } = await supabase
    .from("playlists")
    .select("id,slug,title,description,created_at,user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!playlist) return null;

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", playlist.user_id)
    .maybeSingle();

  let myRole: PlaylistRole | "owner" | null = null;
  if (user) {
    if (user.id === playlist.user_id) {
      myRole = "owner";
    } else {
      const { data: row } = await supabase
        .from("playlist_collaborators")
        .select("role")
        .eq("playlist_id", playlist.id)
        .eq("user_id", user.id)
        .maybeSingle();
      myRole = (row?.role as PlaylistRole | undefined) ?? null;
    }
  }

  return {
    ...playlist,
    owner_name: ownerProfile?.display_name ?? "Unknown",
    is_owner: !!user && user.id === playlist.user_id,
    my_role: myRole,
  };
}

export async function getPlaylistTracks(playlistId: string): Promise<PlaylistTrackItem[]> {
  const { data, error } = await supabase
    .from("playlist_tracks")
    .select("id,position,added_by,created_at,track_id")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const trackIds = Array.from(new Set(data.map((d) => d.track_id))).filter((v): v is string => v !== null);
  const userIds = Array.from(new Set(data.map((d) => d.added_by))).filter((v): v is string => v !== null);

  const [tracksRes, profilesRes] = await Promise.all([
    supabase
      .from("tracks")
      .select("id,title,slug,cover_url,audio_url,duration_seconds,artist_id,pricing_model,price_amount,price_currency,preview_seconds,genre")
      .in("id", trackIds),
    supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds),
  ]);

  const tracks = tracksRes.data ?? [];
  const artistIds = Array.from(new Set(tracks.map((t) => t.artist_id)));
  const { data: artists } = await supabase
    .from("artists")
    .select("id,name,slug")
    .in("id", artistIds);

  const artistMap = new Map((artists ?? []).map((a) => [a.id, a]));
  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  return data
    .map((row) => {
      const t = trackMap.get(row.track_id);
      if (!t) return null;
      const a = artistMap.get(t.artist_id);
      const p = row.added_by ? profileMap.get(row.added_by) : undefined;
      return {
        id: row.id,
        position: row.position,
        added_by: row.added_by,
        added_by_name: p?.display_name ?? "Quelqu'un",
        created_at: row.created_at,
        track: {
          id: t.id,
          title: t.title,
          slug: t.slug,
          cover_url: t.cover_url,
          audio_url: t.audio_url,
          duration_seconds: t.duration_seconds,
          artist_id: t.artist_id,
          artist_name: a?.name ?? "Unknown",
          artist_slug: a?.slug ?? "unknown",
          pricing_model: t.pricing_model,
          price_amount: t.price_amount,
          price_currency: t.price_currency,
          preview_seconds: t.preview_seconds,
          genre: t.genre,
        },
      } as PlaylistTrackItem;
    })
    .filter((v): v is PlaylistTrackItem => v !== null);
}

export async function getPlaylistCollaborators(playlistId: string): Promise<PlaylistCollaborator[]> {
  const { data, error } = await supabase
    .from("playlist_collaborators")
    .select("id,user_id,role,invited_by,created_at")
    .eq("playlist_id", playlistId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const ids = Array.from(new Set(data.map((d) => d.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", ids);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((row) => {
    const p = map.get(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role as PlaylistRole,
      invited_by: row.invited_by,
      created_at: row.created_at,
      display_name: p?.display_name ?? "Utilisateur",
      avatar_url: p?.avatar_url ?? null,
    };
  });
}

export async function searchUsersByName(query: string, excludeIds: string[] = []) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url")
    .ilike("display_name", `%${q}%`)
    .limit(8);
  if (error) throw error;
  return (data ?? []).filter((p) => !excludeIds.includes(p.id));
}

export async function inviteCollaborator(playlistId: string, userId: string, role: PlaylistRole, invitedBy: string) {
  const { error } = await supabase.from("playlist_collaborators").insert({
    playlist_id: playlistId,
    user_id: userId,
    role,
    invited_by: invitedBy,
  });
  if (error) throw error;
}

export async function updateCollaboratorRole(collabId: string, role: PlaylistRole) {
  const { error } = await supabase
    .from("playlist_collaborators")
    .update({ role })
    .eq("id", collabId);
  if (error) throw error;
}

export async function removeCollaborator(collabId: string) {
  const { error } = await supabase.from("playlist_collaborators").delete().eq("id", collabId);
  if (error) throw error;
}

export async function removePlaylistTrack(playlistTrackId: string) {
  const { error } = await supabase.from("playlist_tracks").delete().eq("id", playlistTrackId);
  if (error) throw error;
}

export async function getPlaylistsForUser(userId: string): Promise<PlaylistSummary[]> {
  // Owned + shared via collaborators
  const [ownedRes, sharedRes] = await Promise.all([
    supabase
      .from("playlists")
      .select("id,slug,title,description,created_at,user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("playlist_collaborators")
      .select("role,playlist:playlists(id,slug,title,description,created_at,user_id)")
      .eq("user_id", userId),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (sharedRes.error) throw sharedRes.error;

  const owned: PlaylistSummary[] = (ownedRes.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    created_at: p.created_at,
    user_id: p.user_id,
    is_owner: true,
    my_role: "owner",
    collaborator_count: 0,
    track_count: 0,
  }));

  const shared: PlaylistSummary[] = (sharedRes.data ?? [])
    .map((row: any) => {
      const p = row.playlist;
      if (!p) return null;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        created_at: p.created_at,
        user_id: p.user_id,
        is_owner: false,
        my_role: row.role as PlaylistRole,
        collaborator_count: 0,
        track_count: 0,
      } as PlaylistSummary;
    })
    .filter((v): v is PlaylistSummary => v !== null);

  const all = [...owned, ...shared];
  if (all.length === 0) return all;

  const ids = all.map((p) => p.id);
  const [collabCounts, trackCounts] = await Promise.all([
    supabase.from("playlist_collaborators").select("playlist_id").in("playlist_id", ids),
    supabase.from("playlist_tracks").select("playlist_id").in("playlist_id", ids),
  ]);
  const collabMap = new Map<string, number>();
  (collabCounts.data ?? []).forEach((r: any) => collabMap.set(r.playlist_id, (collabMap.get(r.playlist_id) ?? 0) + 1));
  const trackMap = new Map<string, number>();
  (trackCounts.data ?? []).forEach((r: any) => trackMap.set(r.playlist_id, (trackMap.get(r.playlist_id) ?? 0) + 1));

  return all.map((p) => ({
    ...p,
    collaborator_count: collabMap.get(p.id) ?? 0,
    track_count: trackMap.get(p.id) ?? 0,
  }));
}
