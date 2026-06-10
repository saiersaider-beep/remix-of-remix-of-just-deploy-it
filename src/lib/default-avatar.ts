import defaultImg from "@/assets/avatars/default.jpg";

/**
 * Single shared default avatar used everywhere when a user hasn't uploaded one.
 * Seed is accepted for backwards compatibility but ignored.
 */
export function defaultAvatar(_seed?: string | null): string {
  return defaultImg;
}

/** Returns the URL if set and looks valid, otherwise the default avatar. */
export function avatarOrDefault(url: string | null | undefined, _seed?: string | null): string {
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  if (!cleanUrl || cleanUrl === "null" || cleanUrl === "undefined") return defaultImg;
  // Only allow well-formed asset URLs; anything else falls back to the default.
  if (!/^(https?:\/\/|blob:|data:|\/)/i.test(cleanUrl)) return defaultImg;
  return cleanUrl;
}
