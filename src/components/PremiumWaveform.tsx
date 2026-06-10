import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { subscribeAudioElement, ensureAnalyser } from "@/lib/audio-bus";
import { usePlayerStore } from "@/stores/player";
import { useAudioPulse } from "@/hooks/use-audio-pulse";
import { tierFlags, usePerformanceTier } from "@/hooks/use-performance-tier";
import { formatTime } from "@/lib/player";

interface PremiumWaveformProps {
  /** Audio URL the waveform should decode for peaks. */
  url?: string | null;
  /** Whether the current player is on this exact track. */
  isCurrent: boolean;
  /** Whether the player is actively playing this track right now. */
  isPlaying: boolean;
  /** Total height in px. */
  height?: number;
}

/**
 * Premium, Spotify-grade waveform.
 * - Real peaks via WaveSurfer.js with high-contrast colors.
 * - Frame-perfect progress: RAF interpolation between store ticks.
 * - Precise hover scrub: vertical cursor + floating time bubble.
 * - Breathing glow synced to live audio energy.
 * - Organic moving sheen across bars while playing.
 */
export function PremiumWaveform({
  url,
  isCurrent,
  isPlaying,
  height = 88,
}: PremiumWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ x: number; pct: number } | null>(null);
  const [smoothPct, setSmoothPct] = useState(0);

  const playerPosition = usePlayerStore((s) => s.position);
  const playerDuration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const tier = usePerformanceTier();
  const { isLow, frameSkip } = tierFlags(tier);
  // Disable audio-pulse work on low-end devices.
  const pulse = useAudioPulse(!isLow && isCurrent && isPlaying);

  // Create wavesurfer once.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary").trim() || "#7c3aed";
    const glow = css.getPropertyValue("--primary-glow").trim() || "#a78bfa";
    const accent = css.getPropertyValue("--accent-cyan").trim() || "#22d3ee";

    const makeGradient = (stops: Array<[number, string]>) => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return stops[0][1];
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      stops.forEach(([o, c]) => grad.addColorStop(o, c));
      return grad;
    };

    // Unplayed bars: dark, high-contrast against cream/glass backgrounds.
    const waveGrad = makeGradient([
      [0, "rgba(18, 14, 36, 0.95)"],
      [0.5, "rgba(38, 30, 70, 0.85)"],
      [1, "rgba(18, 14, 36, 0.95)"],
    ]);
    // Played bars: vivid saturated gradient for instant readability.
    const progressGrad = makeGradient([
      [0, glow],
      [0.5, primary],
      [1, accent],
    ]);

    const ws = WaveSurfer.create({
      container: el,
      height,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      cursorWidth: 0,
      waveColor: waveGrad as unknown as string,
      progressColor: progressGrad as unknown as string,
      normalize: true,
      interact: false,
      media: undefined,
    });


    wsRef.current = ws;
    ws.on("ready", () => setReady(true));

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load audio URL for peaks.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (!url) {
      setReady(false);
      try { ws.empty(); } catch { /* ignore */ }
      return;
    }
    setReady(false);
    ws.load(url).catch(() => { /* CORS/network — UI still works */ });
    ensureAnalyser();
  }, [url]);

  // Frame-perfect interpolation between store ticks (~250ms) for fluid progress.
  useEffect(() => {
    let raf = 0;
    let lastStoreTs = performance.now();
    let lastPos = playerPosition;
    let skip = 0;
    const tick = () => {
      skip = (skip + 1) % (frameSkip + 1);
      if (skip !== 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const state = usePlayerStore.getState();
      if (state.position !== lastPos) {
        lastPos = state.position;
        lastStoreTs = performance.now();
      }
      const elapsed = state.isPlaying && isCurrent ? (performance.now() - lastStoreTs) / 1000 : 0;
      const eff = Math.min(state.duration, lastPos + elapsed);
      const ratio = state.duration > 0 && isCurrent
        ? Math.min(1, Math.max(0, eff / state.duration))
        : 0;
      setSmoothPct(ratio * 100);
      const ws = wsRef.current;
      if (ws && ready) {
        const wsDur = ws.getDuration();
        if (Number.isFinite(wsDur) && wsDur > 0) {
          try { ws.setTime(ratio * wsDur); } catch { /* ignore */ }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerPosition, isCurrent, ready, frameSkip]);

  useEffect(() => subscribeAudioElement(() => {}), []);

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    setHover({ x, pct: (x / r.width) * 100 });
  };
  const onClickSeek = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el || playerDuration <= 0) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seek(ratio * playerDuration);
  };

  const liveGlow = 0.35 + pulse * 0.65;

  return (
    <div
      ref={wrapRef}
      className="relative group select-none cursor-pointer"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={onClickSeek}
    >
      {/* Faint mirror baseline for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/15" />

      <div
        ref={containerRef}
        className="relative w-full transition-opacity"
        style={{
          height,
          opacity: ready ? 1 : 0.55,
          maskImage:
            "linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)",
        }}
      />

      {/* Breathing live glow synced to audio energy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-8 h-16 blur-3xl"
        style={{
          opacity: isCurrent && isPlaying ? liveGlow : 0,
          background:
            "radial-gradient(50% 100% at 25% 50%, color-mix(in oklab, var(--primary) 70%, transparent), transparent 70%), radial-gradient(50% 100% at 75% 50%, color-mix(in oklab, var(--accent-cyan) 55%, transparent), transparent 70%), radial-gradient(40% 100% at 50% 50%, color-mix(in oklab, var(--primary-glow) 50%, transparent), transparent 70%)",
          transform: `scaleY(${1 + pulse * 0.4})`,
          transition: "transform 120ms linear, opacity 240ms ease-out",
        }}
      />

      {/* Live progress cursor — frame-perfect & glowing */}
      {isCurrent && playerDuration > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-[2px] rounded-full"
          style={{
            left: `calc(${smoothPct}% - 1px)`,
            background:
              "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95), transparent)",
            boxShadow: `0 0 ${10 + pulse * 18}px ${2 + pulse * 4}px color-mix(in oklab, var(--primary-glow) ${50 + Math.round(pulse * 40)}%, transparent)`,
            transition: "box-shadow 120ms linear",
          }}
        />
      )}

      {/* Moving sheen across bars while playing */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500 ${
          isCurrent && isPlaying ? "opacity-60" : "opacity-0"
        }`}
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)",
        }}
      >
        <div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          style={{ animation: "wave-sheen 5.5s linear infinite" }}
        />
      </div>

      {/* Precise hover scrub: vertical cursor + time bubble */}
      {hover && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/70 shadow-[0_0_12px_2px_rgba(255,255,255,0.35)]"
            style={{ left: hover.x }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 px-2 py-1 rounded-md text-[11px] font-medium tabular-nums bg-black/80 text-white backdrop-blur ring-1 ring-white/10 shadow-lg whitespace-nowrap"
            style={{ left: hover.x, transform: "translateX(-50%)" }}
          >
            {formatTime((hover.pct / 100) * playerDuration)}
          </div>
        </>
      )}

      {/* Loading shimmer while decoding peaks */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.4s_linear_infinite]" />
        </div>
      )}
    </div>
  );
}