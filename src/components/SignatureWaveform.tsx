import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * SignatureWaveform — the VinaSound "logo animé".
 *
 * Goals:
 *  - Instantly identifiable: a custom envelope (NOT a uniform sine) gives the
 *    silhouette a recognisable crest-and-shoulders shape.
 *  - Distinctive rhythm: bar widths cycle through 3 classes (thin/medium/thick)
 *    so the waveform reads as a "signature", not a generic equaliser.
 *  - Alive but controlled: a single travelling highlight bar acts as the
 *    heartbeat; audio reactivity stays bounded.
 *  - Consistent everywhere: one component, one gradient token, used across
 *    LiveRoom, mini-player, track cards, etc.
 *  - Accessible: respects prefers-reduced-motion.
 *
 * Visual signature recipe:
 *   1. Envelope = primary crest (centre) + secondary shoulder (~30%) +
 *      micro-ripples — asymmetric.
 *   2. Variable bar widths in a 1-2-3-1 repeat for a sculpted skyline.
 *   3. Linear gradient bg from `--accent-sunset` → `--primary` → `--primary-glow`.
 *   4. A bright "cursor" bar travels left → right every ~4s.
 */

type Bands = { bass: number; kick: number; mid: number };

export type SignatureWaveformProps = {
  /** Optional live audio bands. When omitted, the component idles in a
   * breathing animation. Values expected in [0, 1]. */
  bands?: Bands;
  /** Whether to animate. Falsy renders a frozen silhouette (for hover-quiet
   * states or screenshot tests). */
  animated?: boolean;
  /** Visual size preset. */
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  /** Number of bars. Defaults follow size. More bars = smoother silhouette
   * but more DOM cost. */
  bars?: number;
  /** Show the travelling highlight cursor. Default true. */
  cursor?: boolean;
  /** Optional className for the outer container. */
  className?: string;
  /** Optional aria-label. Defaults to "Audio waveform". */
  ariaLabel?: string;
};

const SIZE_HEIGHT: Record<NonNullable<SignatureWaveformProps["size"]>, number> = {
  xs: 18,
  sm: 28,
  md: 44,
  lg: 72,
  hero: 110,
};

const SIZE_BARS: Record<NonNullable<SignatureWaveformProps["size"]>, number> = {
  xs: 22,
  sm: 32,
  md: 44,
  lg: 56,
  hero: 72,
};

// Width class cycle — drives the recognisable "sculpted skyline".
const WIDTHS = [2, 3, 4, 3]; // px

/**
 * Signature envelope: NOT a pure sin.
 *  - main crest centred at ~52% with sharp falloff
 *  - secondary shoulder at ~22% (asymmetric)
 *  - micro-ripples for texture
 *  - hard min floor so the line never collapses
 */
function envelope(i: number, count: number) {
  const x = i / Math.max(1, count - 1); // 0..1
  const crest = Math.exp(-Math.pow((x - 0.52) / 0.22, 2)); // gaussian centre
  const shoulder = Math.exp(-Math.pow((x - 0.22) / 0.12, 2)) * 0.55;
  const tail = Math.exp(-Math.pow((x - 0.82) / 0.14, 2)) * 0.35;
  const ripple =
    Math.sin(x * Math.PI * 7) * 0.06 + Math.sin(x * Math.PI * 13 + 1.3) * 0.04;
  const v = crest + shoulder + tail + ripple;
  return Math.max(0.18, Math.min(1, v));
}

export function SignatureWaveform({
  bands,
  animated = true,
  size = "md",
  bars,
  cursor = true,
  className = "",
  ariaLabel = "Audio waveform",
}: SignatureWaveformProps) {
  const id = useId();
  const height = SIZE_HEIGHT[size];
  const count = bars ?? SIZE_BARS[size];

  // Cache the static envelope shape — recomputing per render is wasteful and
  // would also re-trigger CSS transitions every frame.
  const profile = useMemo(
    () => Array.from({ length: count }, (_, i) => envelope(i, count)),
    [count],
  );

  // Single RAF-driven idle pulse — avoids per-bar animation listeners.
  const [phase, setPhase] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!animated || reduced) return;
    let raf = 0;
    let start = 0;
    const loop = (t: number) => {
      if (!start) start = t;
      // 4s travelling cursor period, slow idle breathing
      setPhase(((t - start) / 4000) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animated, reduced]);

  // Audio-reactive multiplier — bounded so motion stays "controlled".
  const reactive = bands
    ? Math.min(1.35, 0.78 + bands.bass * 0.32 + bands.kick * 0.22 + bands.mid * 0.12)
    : 0.85;

  // Idle breathing — gentle ±8% when no bands provided.
  const breath = bands ? 1 : 0.92 + Math.sin(phase * Math.PI * 2) * 0.08;
  const intensity = reactive * breath;

  return (
    <div
      className={`signature-waveform ${className}`}
      role="img"
      aria-label={ariaLabel}
      style={{ height, ["--sw-h" as string]: `${height}px` }}
    >
      <div className="signature-waveform__inner" aria-hidden>
        {profile.map((p, i) => {
          const w = WIDTHS[i % WIDTHS.length];
          // Each bar adds a tiny phase offset so the cursor "lights up" sequentially
          const cursorPos = (i + 0.5) / count;
          const cursorDist = Math.abs(cursorPos - phase);
          const cursorBoost =
            cursor && animated && !reduced
              ? Math.max(0, 1 - cursorDist * 6) // bright within ~16% of cursor
              : 0;
          const h = Math.max(2, p * intensity * height * 0.95);
          return (
            <span
              key={`${id}-${i}`}
              className="signature-waveform__bar"
              style={{
                width: w,
                height: h,
                opacity: 0.82 + cursorBoost * 0.18,
                transform: `scaleY(${1 + cursorBoost * 0.12})`,
                filter: cursorBoost > 0.4 ? "brightness(1.35)" : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setR(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return r;
}

/* Re-export the raw envelope so other components can render a matching
 * silhouette (e.g. a static SVG version on a card). */
export const signatureEnvelope = envelope;
