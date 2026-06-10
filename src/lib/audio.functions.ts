import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Très court TTL : empêche le partage d'URL et oblige une rotation côté player. */
/** TTL court : URLs jetables, partage impossible. */
const FULL_TTL_SECONDS = 600; // 10 min — couvre la plupart des morceaux
const PREVIEW_TTL_SECONDS = 90; // preview de quelques secondes seulement

/**
 * Returns a short-lived signed URL for a track's audio file.
 *
 * Modes :
 *  - "full"    : exige un accès complet (gratuit, owner, achat, abo PRO)
 *  - "preview" : autorisé pour tous (sert le fichier complet, mais le client
 *                doit couper à `preview_seconds`). URL signée 60s, donc tout
 *                bypass DevTools devient inutilisable très vite.
 *
 * Chaque appel est journalisé dans `audio_access_logs`.
 */
export const getSignedAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string; mode?: "full" | "preview" }) =>
    z
      .object({
        trackId: z.string().uuid(),
        mode: z.enum(["full", "preview"]).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const requestedMode = data.mode ?? "full";

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const log = async (
      mode: "full" | "preview" | "denied",
      trackId: string,
      artistId: string | null,
      reason?: string,
    ) => {
      try {
        await supabaseAdmin.from("audio_access_logs").insert({
          user_id: userId,
          track_id: trackId,
          artist_id: artistId,
          mode,
          reason: reason ?? null,
          ip,
          user_agent: userAgent,
        });
      } catch {
        // Logging never blocks playback.
      }
    };

    const { data: track, error: trackErr } = await supabaseAdmin
      .from("tracks")
      .select("id, audio_url, pricing_model, artist_id, preview_seconds")
      .eq("id", data.trackId)
      .maybeSingle();
    if (trackErr) throw trackErr;
    if (!track) {
      await log("denied", data.trackId, null, "track_not_found");
      throw new Error("Piste introuvable.");
    }

    // Server-side access check.
    const { data: hasAccess, error: accErr } = await supabaseAdmin.rpc(
      "user_has_track_access",
      { _user_id: userId, _track_id: track.id },
    );
    if (accErr) throw accErr;

    let mode: "full" | "preview" = "full";
    if (!hasAccess) {
      if (requestedMode === "preview" && track.pricing_model === "paid") {
        mode = "preview";
      } else {
        await log("denied", track.id, track.artist_id, "no_access");
        throw new Error("Accès refusé : achète cette chanson pour l'écouter.");
      }
    }

    const url = track.audio_url;
    if (!url) throw new Error("Cette piste n'a pas de fichier audio.");

    let bucket = "audio";
    let path = url;
    if (/^https?:\/\//i.test(url)) {
      const m = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/);
      if (m) {
        bucket = m[1];
        path = m[2];
      } else {
        await log(mode, track.id, track.artist_id, "external_url");
        return {
          url,
          mode,
          expiresIn: (mode === "preview" ? PREVIEW_TTL_SECONDS : FULL_TTL_SECONDS),
          previewSeconds: track.preview_seconds ?? null,
        };
      }
    } else {
      const [maybeBucket, ...rest] = url.split("/");
      if (rest.length > 0) {
        bucket = maybeBucket;
        path = rest.join("/");
      }
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, (mode === "preview" ? PREVIEW_TTL_SECONDS : FULL_TTL_SECONDS));
    if (signErr || !signed?.signedUrl) {
      throw signErr ?? new Error("Impossible de générer l'URL signée.");
    }

    await log(mode, track.id, track.artist_id);

    return {
      url: signed.signedUrl,
      mode,
      expiresIn: (mode === "preview" ? PREVIEW_TTL_SECONDS : FULL_TTL_SECONDS),
      previewSeconds: track.preview_seconds ?? null,
    };
  });
