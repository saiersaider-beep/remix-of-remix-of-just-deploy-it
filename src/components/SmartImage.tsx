import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SmartImage — perceived-instant image loading.
 *
 * - Keeps an in-memory cache of URLs that have already finished decoding once,
 *   so re-renders (back-nav, re-list, hover, grid re-mounts) show the image
 *   IMMEDIATELY with no flicker / no fade / no skeleton.
 * - Uses native `loading="lazy"` + `decoding="async"` by default for first paint.
 * - Cheap skeleton shimmer only on the FIRST load.
 * - Optional `eager` for above-the-fold / LCP images.
 */
const loaded = new Set<string>();

export function preloadImage(src?: string | null) {
  if (!src || typeof window === "undefined" || loaded.has(src)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  img.onload = () => loaded.add(src);
}

export function preloadImages(urls: Array<string | null | undefined>) {
  if (typeof window === "undefined") return;
  const run = () => urls.forEach(preloadImage);
  // Use requestIdleCallback when available to avoid blocking interactions.
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void) => number)
    | undefined;
  if (ric) ric(run);
  else setTimeout(run, 60);
}

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> & {
  src: string;
  alt: string;
  eager?: boolean;
  /** Class applied to the wrapper (controls aspect/positioning). */
  wrapperClassName?: string;
  /** Skip skeleton shimmer (e.g. for tiny avatars). */
  noPlaceholder?: boolean;
};

export function SmartImage({
  src,
  alt,
  eager,
  className,
  wrapperClassName,
  noPlaceholder,
  onLoad,
  ...rest
}: Props) {
  const cached = loaded.has(src);
  const [isLoaded, setIsLoaded] = useState(cached);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // If the actual <img> is already complete from HTTP cache when it mounts,
  // mark loaded synchronously to skip the placeholder entirely.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      loaded.add(src);
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {!isLoaded && !noPlaceholder && (
        <div
          aria-hidden
          className="absolute inset-0 bg-foreground/[0.06] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.08] before:to-transparent"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        onLoad={(e) => {
          loaded.add(src);
          setIsLoaded(true);
          onLoad?.(e);
        }}
        className={cn(
          "transition-opacity duration-150",
          isLoaded ? "opacity-100" : "opacity-0",
          className,
        )}
        {...rest}
      />
    </div>
  );
}
