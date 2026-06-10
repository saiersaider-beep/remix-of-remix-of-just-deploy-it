import { supabase } from "@/integrations/supabase/client";

export const AUDIO_MIME = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/aac"];
export const AUDIO_EXT = ["mp3", "wav", "flac", "m4a", "ogg", "aac", "webm"];
export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB

export function fileExt(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function validateAudio(file: File): string | null {
  const ext = fileExt(file.name);
  if (!AUDIO_EXT.includes(ext) && !AUDIO_MIME.includes(file.type)) {
    return `Unsupported audio format. Use: ${AUDIO_EXT.join(", ").toUpperCase()}.`;
  }
  if (file.size > MAX_AUDIO_BYTES) return `Audio file too large. Max ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB.`;
  if (file.size < 1024) return "Audio file looks empty.";
  return null;
}

export function validateImage(file: File): string | null {
  const ext = fileExt(file.name);
  if (!IMAGE_EXT.includes(ext) && !IMAGE_MIME.includes(file.type)) {
    return `Unsupported image format. Use: ${IMAGE_EXT.join(", ").toUpperCase()}.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `Image too large. Max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`;
  return null;
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "x";
}

export async function ensureUniqueSlug(table: "tracks" | "albums" | "playlists", base: string): Promise<string> {
  const baseSlug = slugify(base);
  let candidate = baseSlug;
  for (let i = 0; i < 25; i++) {
    const { data } = await supabase.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${baseSlug}-${i + 2}`;
  }
  // last resort — guaranteed unique
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function getMyArtist(userId: string) {
  const { data } = await supabase
    .from("artists")
    .select("id, slug, name, bio, avatar_url, cover_url, verified, monthly_listeners")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Upload to a Supabase storage bucket with real upload progress via XHR.
 * Returns { path, publicUrl }.
 */
export async function uploadWithProgress(
  bucket: "audio" | "covers",
  userId: string,
  file: File,
  prefix = "",
  onProgress?: (pct: number) => void,
): Promise<{ path: string; publicUrl: string }> {
  const ext = fileExt(file.name) || "bin";
  const path = `${userId}/${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
      else { try { reject(new Error(JSON.parse(xhr.responseText).message || `Upload failed (${xhr.status})`)); } catch { reject(new Error(`Upload failed (${xhr.status})`)); } }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

/** Legacy wrapper (no progress) used elsewhere. */
export async function uploadToBucket(
  bucket: "audio" | "covers",
  userId: string,
  file: File,
  prefix = "",
) {
  const { publicUrl } = await uploadWithProgress(bucket, userId, file, prefix);
  return publicUrl;
}

/** Extract `bucket`-relative path from a public URL stored in DB. */
export function pathFromPublicUrl(bucket: string, publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(publicUrl.slice(i + marker.length));
}

export async function removeStorageObjects(bucket: "audio" | "covers", urls: (string | null)[]) {
  const paths = urls.map((u) => pathFromPublicUrl(bucket, u)).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}

export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Math.round(a.duration || 0));
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });
}

export function fmtDuration(s: number) {
  const m = Math.floor((s || 0) / 60);
  const r = (s || 0) % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function fmtNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return (n ?? 0).toString();
}
