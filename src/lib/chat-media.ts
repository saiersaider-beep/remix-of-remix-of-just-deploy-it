import { supabase } from "@/integrations/supabase/client";

const MAX_IMG_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12MB

/** Uploads an image to the chat-media bucket under the user's folder and returns its storage path. */
export async function uploadChatImage(file: File, userId: string): Promise<string> {
  if (!ALLOWED_IMG.includes(file.type)) {
    throw new Error("Format non supporté. Utilise JPG, PNG, WebP ou GIF.");
  }
  if (file.size > MAX_IMG_BYTES) {
    throw new Error("Image trop lourde (max 8 Mo).");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
  return pub.publicUrl;
}

/** Uploads a voice note (audio Blob) to chat-media and returns its storage path. */
export async function uploadChatAudio(blob: Blob, userId: string): Promise<string> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error("Message vocal trop volumineux (max 12 Mo).");
  }
  const mime = blob.type || "audio/webm";
  const ext = mime.includes("mp4") ? "m4a"
    : mime.includes("ogg") ? "ogg"
    : mime.includes("mpeg") ? "mp3"
    : "webm";
  const path = `${userId}/voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, blob, {
    contentType: mime,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Resolves a stored chat-media value (new storage path OR legacy full public URL)
 * into a temporary signed URL the current user can download.
 */
export async function getChatMediaSignedUrl(pathOrUrl: string, expiresInSec = 3600): Promise<string | null> {
  if (!pathOrUrl) return null;
  let path = pathOrUrl;
  const marker = "/chat-media/";
  const idx = pathOrUrl.indexOf(marker);
  if (idx !== -1) path = pathOrUrl.slice(idx + marker.length);
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
