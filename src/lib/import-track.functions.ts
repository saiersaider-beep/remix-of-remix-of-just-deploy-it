import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AUDIO_CT = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/flac", "audio/x-flac", "audio/mp4", "audio/m4a",
  "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac",
];
const EXT_BY_CT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/flac": "flac", "audio/x-flac": "flac",
  "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a",
  "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac",
};
const MAX_BYTES = 100 * 1024 * 1024;

function extFromUrl(u: string) {
  try {
    const path = new URL(u).pathname.toLowerCase();
    const m = path.match(/\.([a-z0-9]{2,5})(?:$|\?)/);
    return m ? m[1] : "";
  } catch { return ""; }
}

export const importAudioFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { url } = data;
    const host = new URL(url).hostname.replace(/^www\./, "");

    if (/youtube\.com|youtu\.be|soundcloud\.com/.test(host)) {
      throw new Error(
        "YouTube and SoundCloud links require an external converter. " +
        "Paste a direct audio URL (.mp3, .wav, .m4a, .ogg, .flac) or use Upload instead.",
      );
    }

    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch (e: any) {
      throw new Error(`Could not fetch URL: ${e?.message ?? "network error"}`);
    }
    if (!res.ok) throw new Error(`Source returned HTTP ${res.status}`);

    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) throw new Error("File too large (max 100 MB).");

    const isAudioCT = AUDIO_CT.includes(ct);
    const urlExt = extFromUrl(url);
    if (!isAudioCT && !["mp3","wav","flac","m4a","ogg","aac","webm"].includes(urlExt)) {
      throw new Error(`URL does not point to a supported audio file (got ${ct || "unknown"}).`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("File too large (max 100 MB).");
    if (buf.byteLength < 1024) throw new Error("Audio file looks empty.");

    const ext = EXT_BY_CT[ct] || urlExt || "mp3";
    const userId = context.userId;
    const path = `${userId}/import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("audio")
      .upload(path, buf, {
        contentType: ct || `audio/${ext === "mp3" ? "mpeg" : ext}`,
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    const publicUrl = supabaseAdmin.storage.from("audio").getPublicUrl(path).data.publicUrl;
    return { publicUrl, sizeBytes: buf.byteLength, contentType: ct };
  });
