import { useEffect, useState } from "react";
import {
  bootLiveExperience,
  claimSpotlight,
  getLiveState,
  releaseSpotlight,
  requestHighEnergy,
  releaseHighEnergy,
  setLiveMode,
  setScene,
  setSceneManual,
  subscribeLive,
  type LiveMode,
  type SceneId,
} from "@/lib/live-experience";

/**
 * Subscribes to live-engine state changes. Throttled to event-based, NOT
 * per-frame — read CSS vars for hot animation work.
 */
export function useLiveExperience() {
  const [, force] = useState(0);
  useEffect(() => {
    bootLiveExperience();
    return subscribeLive(() => force((n) => (n + 1) & 0xffff));
  }, []);
  return getLiveState();
}

/**
 * Claim the GLOBAL spotlight. Only one element across the entire app may hold
 * it at a time — the headline of the stage. Different from `useDominantMotion`
 * which is per-viewport-zone.
 *
 *   const isSpotlight = useSpotlight("hero-play-cta");
 *   <Button className={isSpotlight ? "spotlight aura-pulse" : ""} />
 */
export function useSpotlight(id: string): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    setGranted(claimSpotlight(id));
    return () => releaseSpotlight(id);
  }, [id]);
  return granted;
}

/**
 * Request a slot in the high-energy animation budget (cap = 2 active).
 * Returns false when budget is exhausted or the system is under stress —
 * caller should render a fallback (opacity-only / static).
 */
export function useHighEnergySlot(id: string): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    setGranted(requestHighEnergy(id));
    return () => releaseHighEnergy(id);
  }, [id]);
  return granted;
}

/**
 * Pin a scene from a route component (e.g. landing → "intro", live room →
 * "drop"). Manual setting wins over AI auto-suggestion for `lockMs`.
 */
export function useScene(scene: SceneId, lockMs = 4000) {
  useEffect(() => {
    setSceneManual(scene, lockMs);
    return () => {
      // Let AI take back over by re-suggesting based on current signals.
      setScene("ambient_idle");
    };
  }, [scene, lockMs]);
}

/**
 * Switch the global LiveMode (default / tiktok / concert / minimal).
 * Mode rebalances the Dynamic Motion Mixer weights and seeds a scene.
 */
export function useLiveMode(mode: LiveMode) {
  useEffect(() => {
    setLiveMode(mode);
    return () => setLiveMode("default");
  }, [mode]);
}
