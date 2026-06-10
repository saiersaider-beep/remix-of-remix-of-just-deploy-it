/**
 * Motion Engine — governance layer for "alive UI" intensity.
 *
 * Goals (addressing the "trop vivante" risk):
 *   1. Motion Level System — single CSS var `--motion-level` (0..1) that every
 *      reactive component multiplies its intensity by. Lets us ship a Focus
 *      mode, Live mode, and Performance mode without touching components.
 *   2. Focus Lock — auto-dampen when the user is typing in a form, reading
 *      (no scroll for a while), or actively scrolling a long page. This is
 *      what Apple Music / Spotify do silently.
 *   3. Dominant slot registry — only ONE element per viewport zone may claim
 *      the "dominant" reactive role at a time. Other claimants fall back to
 *      passive (opacity-only) animation.
 *   4. Performance tier — coarse hint surfaced as `--motion-perf` (0..1).
 *
 * Everything is published as CSS variables on :root so non-React DOM (or
 * Tailwind utility classes) can react via `calc(var(--bass) * var(--motion-level))`
 * without prop drilling.
 */

type Listener = () => void;

type Mode = "auto" | "focus" | "live" | "performance";

interface EngineState {
  /** User-facing mode. `auto` = engine decides based on focus lock + perf. */
  mode: Mode;
  /** Resolved target motion level (0..1). Smoothed toward this. */
  target: number;
  /** Currently displayed motion level. */
  current: number;
  /** Performance tier 0..1 (1 = full power, 0.3 = throttled mobile). */
  perf: number;
  /** True when the user is interacting in a way that demands calm. */
  focusLocked: boolean;
  /** Dominant slot registry: zone → claimant id. */
  dominantByZone: Map<string, string>;
}

const state: EngineState = {
  mode: "auto",
  target: 1,
  current: 1,
  perf: 1,
  focusLocked: false,
  dominantByZone: new Map(),
};

const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export function subscribeMotion(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getMotionState(): Readonly<EngineState> {
  return state;
}

/* ---------------- Mode ---------------- */

export function setMotionMode(mode: Mode) {
  state.mode = mode;
  recomputeTarget();
}

/**
 * When set, replaces the rule-based target with an external value.
 * Used by LiveExperienceEngine's Dynamic Motion Mixer to drive the system
 * from scenes + audio + engagement. Focus lock still wins (acts as a hard
 * dampener) so typing in a form always calms the UI.
 */
let externalTarget: number | null = null;

export function setMotionTargetOverride(value: number) {
  externalTarget = Math.max(0, Math.min(1, value));
  recomputeTarget();
}
export function clearMotionTargetOverride() {
  externalTarget = null;
  recomputeTarget();
}

function recomputeTarget() {
  let t: number;
  if (externalTarget !== null && state.mode === "auto") {
    // Live engine drives target. Focus lock applies as a multiplicative
    // dampener — typing must always calm motion regardless of scene.
    t = externalTarget * (state.focusLocked ? 0.45 : 1) * state.perf;
  } else {
    switch (state.mode) {
      case "focus":       t = 0.25; break;
      case "performance": t = 0.4;  break;
      case "live":        t = 1;    break;
      case "auto":
      default:
        t = state.focusLocked ? 0.35 : 1;
        t *= state.perf;
    }
  }
  state.target = Math.max(0, Math.min(1, t));
  notify();
}

/* ---------------- Focus Lock ---------------- */

let focusLockTimer: number | null = null;
function lockFocus(durationMs = 2400) {
  state.focusLocked = true;
  recomputeTarget();
  if (focusLockTimer) window.clearTimeout(focusLockTimer);
  focusLockTimer = window.setTimeout(() => {
    state.focusLocked = false;
    recomputeTarget();
  }, durationMs);
}

/* ---------------- Dominant slot registry ---------------- */

/**
 * Claim the dominant reactive role for a viewport zone.
 * Returns `true` if granted, `false` if another claimant already holds it.
 * Caller MUST call `releaseDominant(zone, id)` on unmount.
 */
export function claimDominant(zone: string, id: string): boolean {
  const holder = state.dominantByZone.get(zone);
  if (!holder || holder === id) {
    state.dominantByZone.set(zone, id);
    return true;
  }
  return false;
}

export function releaseDominant(zone: string, id: string) {
  if (state.dominantByZone.get(zone) === id) {
    state.dominantByZone.delete(zone);
  }
}

/* ---------------- DOM bootstrap (call once) ---------------- */

let booted = false;

export function bootMotionEngine() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  // Performance tier — cheap heuristic. Refined elsewhere via setPerf().
  const hwc = (navigator as Navigator & { hardwareConcurrency?: number })
    .hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  let perf = 1;
  if (hwc <= 4 || mem <= 2) perf = 0.6;
  if (coarse && (hwc <= 4 || mem <= 2)) perf = 0.45;
  state.perf = perf;

  // Respect reduced-motion as a hard floor.
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (reduce?.matches) state.perf = Math.min(state.perf, 0.2);
  reduce?.addEventListener?.("change", (e) => {
    if (e.matches) state.perf = Math.min(state.perf, 0.2);
    recomputeTarget();
  });

  // Focus lock triggers — form interaction.
  const onFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const tag = t.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      t.isContentEditable
    ) {
      lockFocus(8000); // calm while editing
    }
  };
  document.addEventListener("focusin", onFocusIn, true);

  // Focus lock triggers — active scroll.
  let lastScroll = 0;
  const onScroll = () => {
    const now = performance.now();
    if (now - lastScroll < 80) return;
    lastScroll = now;
    lockFocus(900);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // Tab hidden → freeze.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      state.target = 0;
      state.current = 0;
      writeVars();
      notify();
    } else {
      recomputeTarget();
    }
  });

  // RAF loop — smooth current toward target, publish CSS vars.
  const tick = () => {
    state.current += (state.target - state.current) * 0.06;
    if (Math.abs(state.target - state.current) < 0.001) {
      state.current = state.target;
    }
    writeVars();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  recomputeTarget();
}

function writeVars() {
  const root = document.documentElement;
  root.style.setProperty("--motion-level", state.current.toFixed(3));
  root.style.setProperty("--motion-perf", state.perf.toFixed(3));
  root.style.setProperty("--motion-focus-lock", state.focusLocked ? "1" : "0");
}

/** Public hook-friendly accessor — read current resolved level. */
export function currentMotionLevel(): number {
  return state.current;
}
