import defaultCoverImg from "@/assets/default-cover.webp";

/** Shared default cover used everywhere when no cover_url is set. */
export function defaultCover(): string {
  return defaultCoverImg;
}

export function coverOrDefault(url: string | null | undefined): string {
  const clean = typeof url === "string" ? url.trim() : "";
  if (!clean || clean === "null" || clean === "undefined") return defaultCoverImg;
  if (!/^(https?:\/\/|blob:|data:|\/)/i.test(clean)) return defaultCoverImg;
  return clean;
}

/** Fixed pochette cover for track pages — NOT user-changeable. */
export const TRACK_POCHETTE_COVER = defaultCoverImg;
