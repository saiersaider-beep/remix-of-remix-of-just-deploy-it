import { useEffect, useState } from "react";
import {
  bootMotionEngine,
  claimDominant,
  currentMotionLevel,
  getMotionState,
  releaseDominant,
  subscribeMotion,
} from "@/lib/motion-engine";

/**
 * Subscribes the component to the global motion level (0..1) and returns its
 * current value. The engine is booted lazily on first mount.
 *
 * Prefer reading `var(--motion-level)` in CSS for purely visual work — only
 * use this hook when you need the numeric value inside JS (e.g. to compute
 * inline styles in a hot render path).
 */
export function useMotionLevel(): number {
  const [level, setLevel] = useState(() => currentMotionLevel());
  useEffect(() => {
    bootMotionEngine();
    let raf = 0;
    const loop = () => {
      setLevel(currentMotionLevel());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return level;
}

/**
 * Claim the dominant reactive role for a viewport zone. Only one claimant
 * wins per zone; losers should render in their passive (opacity-only) form.
 *
 * Usage:
 *   const isDominant = useDominantMotion("hero", "play-button");
 *   <PlayButton intensity={isDominant ? "aura-pulse" : "soft"} />
 */
export function useDominantMotion(zone: string, id: string): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    const ok = claimDominant(zone, id);
    setGranted(ok);
    return () => releaseDominant(zone, id);
  }, [zone, id]);
  return granted;
}

/** Snapshot of the engine state — useful for debug overlays / settings UI. */
export function useMotionState() {
  const [, force] = useState(0);
  useEffect(() => subscribeMotion(() => force((n) => n + 1)), []);
  return getMotionState();
}
