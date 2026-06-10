import { useEffect, useRef, useState } from "react";
import { usePlayerStore, currentTrack } from "@/stores/player";
import { useAudioPulse } from "@/hooks/use-audio-pulse";
import { useAudioBands } from "@/hooks/use-audio-bands";

/**
 * Cinematic reactive ambient backdrop.
 *
 * - Extracts a dominant colour palette from the currently playing track cover.
 * - Renders a fixed, full-viewport mesh of slow-floating coloured blobs.
 * - Cross-fades smoothly when the track changes (no harsh swap).
 *
 * Keep this mounted once in the root layout. It is purely decorative —
 * `pointer-events-none` so it never intercepts UI.
 */
type Palette = { a: string; b: string; c: string };

const DEFAULT_PALETTE: Palette = {
  a: "rgba(249, 143, 29, 0.18)",  // primary glow — warm amber
  b: "rgba(194, 65, 12, 0.12)",   // burnt orange
  c: "rgba(255, 213, 170, 0.16)", // soft peach
};

const paletteCache = new Map<string, Palette>();

export function AmbientBackdrop() {
  const track = usePlayerStore(currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const [current, setCurrent] = useState<Palette>(DEFAULT_PALETTE);
  const [previous, setPrevious] = useState<Palette | null>(null);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = track?.cover_url;
    if (!url) {
      transitionTo(DEFAULT_PALETTE);
      return;
    }
    const cached = paletteCache.get(url);
    if (cached) {
      transitionTo(cached);
      return;
    }
    extractPalette(url)
      .then((p) => {
        if (cancelled) return;
        paletteCache.set(url, p);
        transitionTo(p);
      })
      .catch(() => {
        if (!cancelled) transitionTo(DEFAULT_PALETTE);
      });

    function transitionTo(next: Palette) {
      setPrevious(current);
      setCurrent(next);
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => setPrevious(null), 1400);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.cover_url]);

  const pulse = useAudioPulse(isPlaying);
  const { bass, mid } = useAudioBands(isPlaying);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {previous && (
        <BlobLayer palette={previous} active={false} fading pulse={0} bass={0} mid={0} />
      )}
      <BlobLayer palette={current} active={isPlaying} pulse={pulse} bass={bass} mid={mid} />
      {/* Deep cinematic breathing core — always alive, even when idle.
          Subtle bass swell on the central halo. */}
      <div
        aria-hidden
        className="absolute inset-0 animate-breathe-slow will-change-transform"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${current.a} 0%, transparent 55%)`,
          mixBlendMode: "screen",
          filter: "blur(40px)",
          transform: `scale(${1 + bass * 0.05})`,
          transition: "transform 220ms var(--ease-breath)",
        }}
      />
      {/* Slow drifting conic accent — opacity reacts to mids (vocals/leads). */}
      <span
        aria-hidden
        className="absolute rounded-full blur-[160px] will-change-transform"
        style={{
          top: "30%",
          left: "40%",
          width: "45vw",
          height: "45vw",
          background: `conic-gradient(from 0deg, ${current.a}, ${current.b}, ${current.c}, ${current.a})`,
          opacity: 0.32 + pulse * 0.15 + mid * 0.12,
          animation: `ambient-drift-d ${36 - pulse * 8}s ease-in-out infinite`,
          mixBlendMode: "screen",
          transition: "opacity 180ms linear",
        }}
      />
      {/* Ultra-subtle noise grain — organic premium texture (Linear/Arc vibe) */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: "160px 160px",
        }}
      />
      {/* Featherlight vignette — never darkens the light theme */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(15, 23, 42, 0.06) 100%)",
        }}
      />
    </div>
  );
}

function BlobLayer({
  palette,
  active,
  fading = false,
  pulse = 0,
  bass = 0,
  mid = 0,
}: {
  palette: Palette;
  active: boolean;
  fading?: boolean;
  pulse?: number;
  bass?: number;
  mid?: number;
}) {
  const speed = active ? 1 : 0.55;
  // Subtle audio-reactive scale + opacity (capped to stay cinematic, no jitter).
  // Bass = global swell, mid = secondary brightness lift.
  const reactiveScale = 1 + pulse * 0.04 + bass * 0.02;
  const reactiveOpacity = fading ? 0 : 0.7 + pulse * 0.10 + mid * 0.06;
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: reactiveOpacity,
        transform: `scale(${reactiveScale})`,
        transition: "opacity 1400ms var(--ease-cinema), transform 600ms var(--ease-breath)",
      }}
    >
      <span
        className="absolute rounded-full blur-[120px] will-change-transform"
        style={{
          top: "-10%",
          left: "-5%",
          width: "55vw",
          height: "55vw",
          background: palette.a,
          animation: `ambient-drift-a ${24 / speed}s ease-in-out infinite`,
        }}
      />
      <span
        className="absolute rounded-full blur-[120px] will-change-transform"
        style={{
          top: "20%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          background: palette.b,
          animation: `ambient-drift-b ${32 / speed}s ease-in-out infinite`,
        }}
      />
      <span
        className="absolute rounded-full blur-[140px] will-change-transform"
        style={{
          bottom: "-15%",
          left: "20%",
          width: "60vw",
          height: "60vw",
          background: palette.c,
          animation: `ambient-drift-c ${40 / speed}s ease-in-out infinite`,
        }}
      />
    </div>
  );
}

/**
 * Extract a small palette from an image URL using a downscaled canvas.
 * Returns three rgba strings derived from dominant hues, tuned for use as
 * background glow (low alpha, never fully opaque).
 */
async function extractPalette(url: string): Promise<Palette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket pixels by coarse hue, keep top 3 buckets.
        const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          // skip near-black / near-white
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 25 || min > 235) continue;
          const key = Math.round(r / 32) * 1024 + Math.round(g / 32) * 32 + Math.round(b / 32);
          const cur = buckets.get(key);
          if (cur) {
            cur.r += r; cur.g += g; cur.b += b; cur.n += 1;
          } else {
            buckets.set(key, { r, g, b, n: 1 });
          }
        }
        const top = [...buckets.values()]
          .sort((x, y) => y.n - x.n)
          .slice(0, 3)
          .map((c) => ({
            r: Math.round(c.r / c.n),
            g: Math.round(c.g / c.n),
            b: Math.round(c.b / c.n),
          }));
        while (top.length < 3) top.push({ r: 124, g: 58, b: 237 });
        const toRgba = (c: { r: number; g: number; b: number }, a: number) =>
          `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
        resolve({
          a: toRgba(top[0], 0.22),
          b: toRgba(top[1], 0.16),
          c: toRgba(top[2], 0.12),
        });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}
