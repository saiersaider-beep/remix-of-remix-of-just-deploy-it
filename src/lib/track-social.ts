import { supabase } from "@/integrations/supabase/client";
import { recordTrackEvent } from "@/lib/track-events";
import { awardPointsForInteraction } from "@/lib/points-client";

type TrackRow = {
  id: string;
  artist_id: string;
  title: string;
  slug: string;
  description: string | null;
  lyrics: string | null;
  genre: string | null;
  audio_url: string;
  cover_url: string | null;
  duration_seconds: number;
  plays: number;
  likes: number;
  released_at: string | null;
  created_at: string;
  pricing_model: string;
  price_amount: number;
  price_currency: string;
  preview_seconds: number;
};
type TrackCommentRow = {
  id: string;
  track_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
};
type PlaylistRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
};

export type TrackDetailData = Pick<
  TrackRow,
  | "id"
  | "artist_id"
  | "title"
  | "slug"
  | "description"
  | "lyrics"
  | "genre"
  | "audio_url"
  | "cover_url"
  | "duration_seconds"
  | "plays"
  | "likes"
  | "released_at"
  | "created_at"
  | "pricing_model"
  | "price_amount"
  | "price_currency"
  | "preview_seconds"
> & {
  artist_name: string;
  artist_slug: string;
  artist_avatar: string | null;
  is_liked: boolean;
  comments_count: number;
  is_owner: boolean;
};

export type TrackComment = Pick<TrackCommentRow, "id" | "track_id" | "user_id" | "author_name" | "content" | "created_at"> & {
  parent_comment_id: string | null;
  pinned: boolean;
  likes_count: number;
  is_liked: boolean;
  avatar_url: string | null;
  image_url: string | null;
};

export type UserPlaylist = Pick<PlaylistRow, "id" | "slug" | "title" | "description" | "created_at">;

export async function getTrackBySlug(slug: string): Promise<TrackDetailData | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: track, error } = await supabase
    .from("tracks")
    .select("id,artist_id,title,slug,description,lyrics,genre,audio_url,cover_url,duration_seconds,plays,likes,released_at,created_at,pricing_model,price_amount,price_currency,preview_seconds")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!track) return null;

  const [{ data: artist }, likeRes, commentsRes] = await Promise.all([
    supabase
      .from("artists")
      .select("name,slug,user_id,avatar_url")
      .eq("id", track.artist_id)
      .maybeSingle(),
    user
      ? supabase
          .from("track_likes")
          .select("id")
          .eq("track_id", track.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("track_comments")
      .select("id", { count: "exact", head: true })
      .eq("track_id", track.id),
  ]);

  return {
    ...track,
    artist_name: artist?.name ?? "Unknown Artist",
    artist_slug: artist?.slug ?? "unknown-artist",
    artist_avatar: artist?.avatar_url ?? null,
    is_liked: !!likeRes.data,
    comments_count: commentsRes.count ?? 0,
    is_owner: !!user && !!artist && artist.user_id === user.id,
  };
}

export async function updateTrackLyrics(trackId: string, lyrics: string | null) {
  const { error } = await supabase
    .from("tracks")
    .update({ lyrics })
    .eq("id", trackId);
  if (error) throw error;
}

export async function getTrackComments(trackId: string): Promise<TrackComment[]> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase
    .from("track_comments")
    .select("id,track_id,user_id,author_name,content,created_at,parent_comment_id,pinned,image_url")
    .eq("track_id", trackId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const comments = rows ?? [];
  if (comments.length === 0) return [];

  const ids = comments.map((c) => c.id);
  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));

  const [likesRes, myLikesRes, profilesRes] = await Promise.all([
    supabase.from("track_comment_likes").select("comment_id").in("comment_id", ids),
    user
      ? supabase.from("track_comment_likes").select("comment_id").in("comment_id", ids).eq("user_id", user.id)
      : Promise.resolve({ data: [] as { comment_id: string }[], error: null }),
    supabase.from("profiles").select("id,avatar_url").in("id", userIds),
  ]);

  const counts = new Map<string, number>();
  (likesRes.data ?? []).forEach((r: any) => counts.set(r.comment_id, (counts.get(r.comment_id) ?? 0) + 1));
  const liked = new Set((myLikesRes.data ?? []).map((r: any) => r.comment_id));
  const avatars = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.avatar_url as string | null]));

  return comments.map((c: any) => ({
    id: c.id,
    track_id: c.track_id,
    user_id: c.user_id,
    author_name: c.author_name,
    content: c.content ?? "",
    created_at: c.created_at,
    parent_comment_id: c.parent_comment_id ?? null,
    pinned: !!c.pinned,
    likes_count: counts.get(c.id) ?? 0,
    is_liked: liked.has(c.id),
    avatar_url: avatars.get(c.user_id) ?? null,
    image_url: c.image_url ?? null,
  }));
}


export async function toggleTrackLike(track: Pick<TrackDetailData, "id" | "artist_id" | "is_liked">, userId: string) {
  if (track.is_liked) {
    const { error } = await supabase
      .from("track_likes")
      .delete()
      .eq("track_id", track.id)
      .eq("user_id", userId);

    if (error) throw error;
    await recordTrackEvent(track.id, track.artist_id, "unlike");
    return { is_liked: false };
  }

  const { error } = await supabase.from("track_likes").insert({
    track_id: track.id,
    user_id: userId,
  });

  if (error) throw error;
  await recordTrackEvent(track.id, track.artist_id, "like");
  awardPointsForInteraction(track.id, "like");
  return { is_liked: true };
}

export async function createTrackComment(
  trackId: string,
  userId: string,
  authorName: string,
  content: string,
  parentCommentId?: string | null,
  imageUrl?: string | null,
) {
  const { data, error } = await supabase
    .from("track_comments")
    .insert({
      track_id: trackId,
      user_id: userId,
      author_name: authorName,
      content: content || null,
      parent_comment_id: parentCommentId ?? null,
      image_url: imageUrl ?? null,
    })
    .select("id,track_id,user_id,author_name,content,created_at,parent_comment_id,pinned,image_url")
    .single();

  if (error) throw error;
  awardPointsForInteraction(trackId, "comment");
  return data;
}


export async function deleteTrackComment(commentId: string, userId: string) {
  const { error } = await supabase
    .from("track_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function toggleCommentLike(commentId: string, userId: string, isLiked: boolean) {
  if (isLiked) {
    const { error } = await supabase
      .from("track_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) throw error;
    return { is_liked: false };
  }
  const { error } = await supabase
    .from("track_comment_likes")
    .insert({ comment_id: commentId, user_id: userId });
  if (error) throw error;
  return { is_liked: true };
}

export async function setCommentPinned(commentId: string, pinned: boolean) {
  const { error } = await supabase
    .from("track_comments")
    .update({ pinned })
    .eq("id", commentId);
  if (error) throw error;
}

export async function getMyFavouriteTracks(userId: string) {
  const { data: likes, error: likesError } = await supabase
    .from("track_likes")
    .select("track_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (likesError) throw likesError;
  if (!likes || likes.length === 0) return [];

  const trackIds = likes.map((like) => like.track_id);
  const { data: tracks, error: tracksError } = await supabase
    .from("tracks")
    .select("id,artist_id,title,slug,duration_seconds,likes,plays,cover_url")
    .in("id", trackIds);

  if (tracksError) throw tracksError;

  const artistIds = Array.from(new Set((tracks ?? []).map((track) => track.artist_id)));
  const { data: artists, error: artistsError } = await supabase
    .from("artists")
    .select("id,name,slug")
    .in("id", artistIds);

  if (artistsError) throw artistsError;

  const artistMap = new Map((artists ?? []).map((artist) => [artist.id, artist]));
  const trackMap = new Map((tracks ?? []).map((track) => [track.id, track]));

  return likes
    .map((like) => {
      const track = trackMap.get(like.track_id);
      if (!track) return null;
      const artist = artistMap.get(track.artist_id);
      return {
        id: track.id,
        title: track.title,
        slug: track.slug,
        duration_seconds: track.duration_seconds,
        likes: track.likes,
        plays: track.plays,
        cover_url: track.cover_url,
        artist_name: artist?.name ?? "Unknown Artist",
        liked_at: like.created_at,
      };
    })
    .filter((value): value is {
      id: string;
      title: string;
      slug: string;
      duration_seconds: number;
      likes: number;
      plays: number;
      cover_url: string | null;
      artist_name: string;
      liked_at: string;
    } => value !== null);
}

export async function getMyPlaylists(userId: string): Promise<UserPlaylist[]> {
  const [ownedRes, sharedRes] = await Promise.all([
    supabase
      .from("playlists")
      .select("id,slug,title,description,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("playlist_collaborators")
      .select("playlist:playlists(id,slug,title,description,created_at)")
      .eq("user_id", userId)
      .eq("role", "editor"),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (sharedRes.error) throw sharedRes.error;

  const owned = ownedRes.data ?? [];
  const shared = (sharedRes.data ?? [])
    .map((row: any) => row.playlist)
    .filter((p: any): p is UserPlaylist => !!p);

  const map = new Map<string, UserPlaylist>();
  [...owned, ...shared].forEach((p) => map.set(p.id, p as UserPlaylist));
  return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createPlaylist(userId: string, title: string, description?: string) {
  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "playlist";

  const { data, error } = await supabase
    .from("playlists")
    .insert({
      user_id: userId,
      title,
      description: description?.trim() ? description.trim() : null,
      slug: `${slugBase}-${Date.now().toString(36)}`,
    })
    .select("id,slug,title,description,created_at")
    .single();

  if (error) throw error;
  return data as UserPlaylist;
}

export async function addTrackToPlaylist(playlistId: string, trackId: string, userId: string) {
  const { count } = await supabase
    .from("playlist_tracks")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId);

  const { error } = await supabase
    .from("playlist_tracks")
    .insert({
      playlist_id: playlistId,
      track_id: trackId,
      added_by: userId,
      position: count ?? 0,
    });

  if (error) throw error;
}
