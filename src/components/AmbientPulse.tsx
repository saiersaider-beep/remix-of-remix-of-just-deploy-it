import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/player";
import { useAudioBands } from "@/hooks/use-audio-bands";
import { currentMotionLevel } from "@/lib/motion-engine";
import { pushAudioBands } from "@/lib/live-experience";

/**
 * AmbientPulse — global "living" layer.
 *
 * - Publishes audio bands as CSS vars on :root (--bass, --mid, --high, --kick,
 *   --energy) so any element can opt into reactivity with `var(--bass)` etc.
 *   without needing its own React subscription.
 * - Renders an ultra-thin reactive line at the very top of the viewport and a
 *   matching one at the very bottom — a discreet "this app is alive" signal
 *   inspired by Apple Music / Spotify Now Playing.
 * - When silent, both lines breathe gently (powered by the hook's ambient
 *   sine fallback) so the UI is never frozen.
 *
 * Purely decorative — pointer-events-none, fixed, very low opacity.
 */
export function AmbientPulse() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const bands = useAudioBands(true);
  const rafRef = useRef<number | null>(null);
  const pending = useRef(bands);
  pending.current = bands;

  // Throttle CSS-var writes to once per animation frame to keep the main
  // thread cool. The hook itself already sets state every frame; we mirror
  // those into the document root so unrelated components can react via CSS.
  useEffect(() => {
    const root = document.documentElement;
    const loop = () => {
      const b = pending.current;
      // Feed raw bands to the LiveExperience mixer (audio dimension of the
      // motion mixer + AI scene auto-suggestion).
      pushAudioBands({ overall: b.overall, kick: b.kick });
      // Multiply published bands by the global motion level so EVERY consumer
      // of var(--bass)/--kick/etc. is governed centrally (focus lock, perf
      // tier, scenes, engagement). No component needs to opt in.
      const m = currentMotionLevel();
      root.style.setProperty("--bass", (b.bass * m).toFixed(3));
      root.style.setProperty("--mid", (b.mid * m).toFixed(3));
      root.style.setProperty("--high", (b.high * m).toFixed(3));
      root.style.setProperty("--kick", (b.kick * m).toFixed(3));
      root.style.setProperty("--energy", (b.overall * m).toFixed(3));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      root.style.removeProperty("--bass");
      root.style.removeProperty("--mid");
      root.style.removeProperty("--high");
      root.style.removeProperty("--kick");
      root.style.removeProperty("--energy");
    };
  }, []);

  // Intensities used by the decorative lines. Multiplied by the live motion
  // level so the top hairline calms down during focus lock / low-perf mode.
  const m = currentMotionLevel();
  const lineOpacity = 0.18 + (bands.overall * 0.55 + bands.kick * 0.25) * m;
  const lineScale = 1 + (bands.bass * 0.4 + bands.kick * 0.25) * m;
  const glowSize = 12 + (bands.bass * 28 + bands.kick * 18) * m;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60]"
      style={{ height: 2 }}
    >
      <div
        className="absolute inset-0 origin-center"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--primary) 70%, transparent) 20%, color-mix(in oklab, var(--brand-blue, var(--accent)) 70%, transparent) 55%, color-mix(in oklab, var(--primary) 70%, transparent) 80%, transparent 100%)",
          opacity: Math.min(0.85, lineOpacity),
          transform: `scaleY(${lineScale})`,
          filter: `drop-shadow(0 0 ${glowSize}px color-mix(in oklab, var(--primary) ${
            30 + bands.bass * 40
          }%, transparent))`,
          transition: "opacity 90ms linear, transform 90ms linear, filter 120ms linear",
          willChange: "opacity, transform, filter",
        }}
      />
      {isPlaying && (
        <div
          className="absolute inset-0 animate-[wave-sheen_3.2s_linear_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary-glow, var(--primary)) 80%, transparent), transparent)",
            opacity: 0.55,
            mixBlendMode: "screen",
          }}
        />
      )}
    </div>
  );
}
