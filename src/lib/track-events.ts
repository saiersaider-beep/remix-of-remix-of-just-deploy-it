import { supabase } from "@/integrations/supabase/client";

/**
 * Record a track event (play / like / unlike) for analytics.
 * Fire-and-forget — never blocks UI. Trigger updates tracks counters automatically.
 */
export async function recordTrackEvent(
  trackId: string,
  artistId: string,
  eventType: "play" | "like" | "unlike",
) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("track_events").insert({
    track_id: trackId,
    artist_id: artistId,
    user_id: user?.id ?? null,
    event_type: eventType,
  });
}