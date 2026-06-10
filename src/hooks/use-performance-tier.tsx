import { useEffect, useState } from "react";

export type PerformanceTier = "low" | "mid" | "high";

type NavigatorWithMemory = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

function detectTier(): PerformanceTier {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "high";
  const nav = navigator as NavigatorWithMemory;

  // Honor user intent first
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (reducedMotion) return "low";
  if (nav.connection?.saveData) return "low";

  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const slowNet = nav.connection?.effectiveType === "2g" || nav.connection?.effectiveType === "slow-2g";

  if (cores <= 2 || memory <= 1 || slowNet) return "low";
  if (cores <= 4 || memory <= 4 || nav.connection?.effectiveType === "3g") return "mid";
  return "high";
}

/**
 * Detect device performance tier so heavy components (waveforms, particle
 * overlays, canvas visualizers, WebRTC) can degrade gracefully on low-end
 * mobiles, on slow networks, or when the user prefers reduced motion.
 *
 * Returns "high" during SSR so the first paint is consistent.
 */
export function usePerformanceTier(): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("high");

  useEffect(() => {
    setTier(detectTier());
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const handler = () => setTier(detectTier());
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return tier;
}

/** Quick boolean helpers for tier-gated render decisions. */
export function tierFlags(tier: PerformanceTier) {
  return {
    isLow: tier === "low",
    isMid: tier === "mid",
    isHigh: tier === "high",
    /** Frame skip count for rAF loops (0 = no skip, 1 = every other frame). */
    frameSkip: tier === "low" ? 2 : tier === "mid" ? 1 : 0,
    /** Hard cap on simultaneous decorative particles. */
    particleCap: tier === "low" ? 6 : tier === "mid" ? 14 : 28,
    /** Whether to render heavy canvas visualizers at all. */
    enableHeavyVisuals: tier !== "low",
  };
}