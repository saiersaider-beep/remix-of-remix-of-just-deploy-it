import { useEffect, useRef } from "react";
import { ensureAnalyser, subscribeAudioElement } from "@/lib/audio-bus";
import { tierFlags, usePerformanceTier } from "@/hooks/use-performance-tier";

interface AudioVisualizerProps {
  active: boolean;
  bars?: number;
  className?: string;
  /** Total CSS height of the visualizer in pixels. */
  height?: number;
}

/**
 * Tiny canvas equalizer fed by the shared Web Audio AnalyserNode.
 * Falls back to a soft animated placeholder when the analyser is unavailable
 * (e.g. before the first user gesture, or in browsers that block it).
 */
export function AudioVisualizer({
  active,
  bars = 24,
  className = "",
  height = 28,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tier = usePerformanceTier();
  const { frameSkip, isLow } = tierFlags(tier);
  const effectiveBars = isLow ? Math.min(bars, 12) : tier === "mid" ? Math.min(bars, 18) : bars;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      ro.disconnect();
      return;
    }

    let analyser = ensureAnalyser();
    const unsub = subscribeAudioElement(() => {
      analyser = ensureAnalyser();
    });

    const dataArray = new Uint8Array(128);
    let phase = 0;
    let skip = 0;

    const draw = () => {
      skip = (skip + 1) % (frameSkip + 1);
      if (skip !== 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const gap = 2 * dpr;
      const barW = Math.max(1, (w - gap * (effectiveBars - 1)) / effectiveBars);

      // Build a gradient that mirrors the brand
      const css = getComputedStyle(document.documentElement);
      const primary = css.getPropertyValue("--primary").trim() || "#7c3aed";
      const glow = css.getPropertyValue("--primary-glow").trim() || "#a78bfa";
      const grad = ctx2d.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, primary);
      grad.addColorStop(1, glow);
      ctx2d.fillStyle = grad;

      let values: number[];
      if (active && analyser) {
        try {
          analyser.getByteFrequencyData(dataArray);
          values = Array.from({ length: effectiveBars }, (_, i) => {
            const idx = Math.floor((i / effectiveBars) * 64) + 2; // skip lowest bins
            return (dataArray[idx] ?? 0) / 255;
          });
        } catch {
          values = fallback(effectiveBars, phase, active);
        }
      } else {
        values = fallback(effectiveBars, phase, active);
      }

      for (let i = 0; i < effectiveBars; i++) {
        const v = values[i] ?? 0;
        const barH = Math.max(2 * dpr, v * h * 0.95);
        const x = i * (barW + gap);
        const y = h - barH;
        const r = Math.min(barW / 2, 2 * dpr);
        // rounded rect
        ctx2d.beginPath();
        ctx2d.moveTo(x + r, y);
        ctx2d.lineTo(x + barW - r, y);
        ctx2d.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx2d.lineTo(x + barW, h);
        ctx2d.lineTo(x, h);
        ctx2d.lineTo(x, y + r);
        ctx2d.quadraticCurveTo(x, y, x + r, y);
        ctx2d.closePath();
        ctx2d.fill();
      }

      phase += active ? 0.12 : 0.04;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      unsub();
    };
  }, [active, effectiveBars, frameSkip]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ height, width: "100%", display: "block" }}
    />
  );
}

function fallback(bars: number, phase: number, active: boolean) {
  const amp = active ? 0.55 : 0.15;
  return Array.from({ length: bars }, (_, i) => {
    const v =
      Math.sin(phase + i * 0.5) * 0.5 +
      Math.sin(phase * 1.3 + i * 0.3) * 0.5;
    return Math.max(0.04, Math.abs(v) * amp + 0.06);
  });
}
