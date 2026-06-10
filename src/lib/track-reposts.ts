import { supabase } from "@/integrations/supabase/client";
import { awardPointsForInteraction } from "@/lib/points-client";

export type RepostInfo = {
  count: number;
  isReposted: boolean;
};

export async function getRepostInfo(trackId: string): Promise<RepostInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  const [{ count }, mine] = await Promise.all([
    supabase
      .from("track_reposts")
      .select("id", { count: "exact", head: true })
      .eq("track_id", trackId),
    user
      ? supabase
          .from("track_reposts")
          .select("id")
          .eq("track_id", trackId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: count ?? 0, isReposted: !!mine.data };
}

export async function toggleRepost(trackId: string, caption?: string): Promise<RepostInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Connecte-toi pour reposter");
  const existing = await supabase
    .from("track_reposts")
    .select("id")
    .eq("track_id", trackId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.data) {
    await supabase.from("track_reposts").delete().eq("id", existing.data.id);
  } else {
    await supabase
      .from("track_reposts")
      .insert({ track_id: trackId, user_id: user.id, caption: caption || null });
    awardPointsForInteraction(trackId, "repost");
  }
  return getRepostInfo(trackId);
}

export async function getMyFanTier(artistId: string): Promise<"super" | "true" | "new" | "none"> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "none";
  const { data } = await supabase.rpc("get_user_fan_tier", {
    _user_id: user.id,
    _artist_id: artistId,
  });
  return (data as "super" | "true" | "new" | "none") ?? "none";
}
