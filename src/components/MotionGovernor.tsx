import { useEffect } from "react";
import { bootMotionEngine } from "@/lib/motion-engine";
import { bootLiveExperience } from "@/lib/live-experience";

/**
 * MotionGovernor — mounts once near the root and boots:
 *   1. The Motion Engine (focus lock, perf tier, CSS var publication).
 *   2. The LiveExperience Engine (scenes, mixer, adaptive AI, FPS watchdog).
 *
 * Renders nothing. Components react via `var(--motion-level)`,
 * `var(--scene-intensity)`, `[data-scene]`, etc., or via the hooks in
 * `use-motion-level.tsx` / `use-live-experience.tsx`.
 */
export function MotionGovernor() {
  useEffect(() => {
    bootMotionEngine();
    bootLiveExperience();
  }, []);
  return null;
}
