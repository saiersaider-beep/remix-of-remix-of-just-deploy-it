/**
 * Client-side image compression for cover art / avatars.
 * Resizes to fit within maxDimension and re-encodes to WebP.
 * Designed for mobile users on slow connections (Lomé / mobile data).
 */
export interface CompressOptions {
  maxDimension?: number; // longest side in px
  quality?: number; // 0..1
  mimeType?: "image/webp" | "image/jpeg";
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const maxDimension = opts.maxDimension ?? 1200;
  const quality = opts.quality ?? 0.85;
  const mimeType = opts.mimeType ?? "image/webp";

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob || blob.size >= file.size) return file;

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}