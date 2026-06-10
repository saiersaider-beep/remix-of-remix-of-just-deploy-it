import { supabase } from "@/integrations/supabase/client";

export interface PlayerTrack {
  id: string;
  artist_id: string;
  title: string;
  slug: string;
  audio_url: string;
  cover_url: string | null;
  artist_name: string;
  artist_slug: string;
  duration_seconds?: number | null;
  genre?: string | null;
  pricing_model?: "free" | "paid" | string;
  price_amount?: number;
  price_currency?: string;
  preview_seconds?: number;
}

export const PAID_PREVIEW_SECONDS = 10;

export interface ResolvedAudio {
  url: string;
  mode: "full" | "preview";
  expiresIn: number;
  previewSeconds: number | null;
}

function isPublicStorageUrl(u: string | null | undefined): boolean {
  return !!u && /\/storage\/v1\/object\/public\//.test(u);
}

export async function resolveAudioUrl(
  track: PlayerTrack,
  opts: { mode?: "full" | "preview" } = {},
): Promise<ResolvedAudio> {
  // Fast path: free tracks served from a public bucket can play directly.
  // Avoids a server roundtrip that would otherwise leave the UI stuck on
  // "buffering" if auth/server-fn timing hiccups.
  if (
    track.pricing_model !== "paid" &&
    isPublicStorageUrl(track.audio_url)
  ) {
    return {
      url: track.audio_url,
      mode: "full",
      expiresIn: 3600,
      previewSeconds: track.preview_seconds ?? null,
    };
  }

  try {
    const { getSignedAudioUrl } = await import("@/lib/audio.functions");
    const res = await getSignedAudioUrl({
      data: { trackId: track.id, mode: opts.mode },
    });
    if (!res?.url) throw new Error("Audio introuvable.");
    return {
      url: res.url,
      mode: (res.mode as "full" | "preview") ?? "full",
      expiresIn: typeof res.expiresIn === "number" ? res.expiresIn : 60,
      previewSeconds:
        typeof res.previewSeconds === "number" ? res.previewSeconds : null,
    };
  } catch (err) {
    // Last-resort fallback: if the server fn fails but the file lives in a
    // public bucket, play it directly. The 10s preview cap for paid tracks
    // is still enforced client-side in PlayerProvider's timeupdate handler.
    if (isPublicStorageUrl(track.audio_url)) {
      return {
        url: track.audio_url,
        mode: opts.mode === "preview" ? "preview" : "full",
        expiresIn: 3600,
        previewSeconds: track.preview_seconds ?? null,
      };
    }
    throw err;
  }
}

/** Returns true if the current user has paid/free/owner access to this track. */
export async function checkTrackAccess(trackId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Owner bypass — the artist who uploaded the track always has access to it,
  // even when it's a paid track. Without this an artist gets a paywall when
  // previewing or DJing their own catalog.
  try {
    const { data: t } = await supabase
      .from("tracks")
      .select("artist:artists!inner(user_id)")
      .eq("id", trackId)
      .maybeSingle();
    const ownerId = (t as { artist?: { user_id?: string } } | null)?.artist?.user_id;
    if (ownerId && ownerId === user.id) return true;
  } catch {
    /* fall through to RPC */
  }

  const { data, error } = await supabase.rpc("user_has_track_access", {
    _user_id: user.id,
    _track_id: trackId,
  });
  if (error) {
    console.warn("checkTrackAccess error", error);
    return false;
  }
  return !!data;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPrice(amount: number, currency = "XOF") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
