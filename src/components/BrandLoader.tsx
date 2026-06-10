import { BrandMark } from "@/components/BrandMark";

interface BrandLoaderProps {
  label?: string;
  fullscreen?: boolean;
  size?: number;
}

/**
 * BrandLoader — TikTok-style loading: the site logo spins inside a
 * gradient conic ring with a pulsing glow halo. Uses the user's custom
 * logo (via BrandMark / useSiteLogo).
 */
export function BrandLoader({
  label = "Chargement…",
  fullscreen = true,
  size = 96,
}: BrandLoaderProps) {
  const ring = size + 20;
  return (
    <div
      className={
        fullscreen
          ? "min-h-screen w-full grid place-items-center bg-background"
          : "w-full grid place-items-center py-12"
      }
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative grid place-items-center"
          style={{ width: ring, height: ring }}
        >
          {/* Pulsing halo */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl opacity-70 animate-brand-pulse"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(var(--primary)/0.9), #ff2d55, #25f4ee, hsl(var(--primary)/0.9))",
            }}
          />
          {/* Spinning gradient ring */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full animate-brand-spin"
            style={{
              background:
                "conic-gradient(from 0deg, #25f4ee, hsl(var(--primary)), #ff2d55, #25f4ee)",
              mask: "radial-gradient(circle, transparent 58%, #000 60%)",
              WebkitMask: "radial-gradient(circle, transparent 58%, #000 60%)",
            }}
          />
          {/* Logo — counter-spins to feel like it's bouncing in beat */}
          <span
            className="relative rounded-full bg-background grid place-items-center shadow-lg animate-brand-bob"
            style={{ width: size, height: size }}
          >
            <BrandMark size={Math.round(size * 0.78)} />
          </span>
        </div>
        {label && (
          <p className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground animate-brand-pulse-text">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
