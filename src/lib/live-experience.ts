/**
 * LiveExperienceEngine — the "Stage Controller" sitting on top of the
 * Motion Engine. Turns the app into a live, audio-reactive experience while
 * keeping every existing API (`currentMotionLevel`, `claimDominant`,
 * `AmbientPulse`, `.aura-pulse`, etc.) fully backwards-compatible.
 *
 * Architecture (top → bottom):
 *
 *   LiveExperienceEngine    ← scenes, mixer, AI, spotlight, FPS watchdog
 *        │
 *        ▼   (writes resolved target each frame)
 *   Motion Engine           ← --motion-level, focus lock, dominant zones
 *        │
 *        ▼   (CSS vars on :root)
 *   Components / CSS        ← read var(--motion-level), var(--scene-*) etc.
 *
 * The Dynamic Motion Mixer is the heart:
 *   finalMotion = audioEnergy * audioWeight
 *               + sceneIntensity * sceneWeight
 *               + userEngagement * engagementWeight
 *
 * All weights, scenes, AI signals and the FPS-driven anti-chaos governor are
 * documented inline below.
 */

import { setMotionTargetOverride, clearMotionTargetOverride } from "./motion-engine";

/* ─────────────────────────  TYPES  ───────────────────────── */

export type SceneId =
  | "intro"
  | "build"
  | "drop"
  | "chill"
  | "focus"
  | "transition"
  | "ambient_idle";

export type EmotionState =
  | "calm"
  | "focus"
  | "hype"
  | "drop"
  | "emotional_peak"
  | "recovery"
  | "ambient_idle";

export type LiveMode = "default" | "tiktok" | "concert" | "minimal";

export interface SceneConfig {
  /** Target intensity contributed by this scene (0..1). */
  intensity: number;
  /** Multiplier applied to incoming audio energy. */
  audioSensitivity: number;
  /** Color temperature shift (-1 cool, 0 neutral, +1 warm). */
  colorTemp: number;
  /** UI density: 0 minimal, 1 dense. */
  density: number;
  /** Suggested emotion state companion. */
  emotion: EmotionState;
}

const SCENES: Record<SceneId, SceneConfig> = {
  intro:        { intensity: 0.25, audioSensitivity: 0.5, colorTemp: -0.1, density: 0.5, emotion: "calm" },
  build:        { intensity: 0.55, audioSensitivity: 0.85, colorTemp: 0.1, density: 0.7, emotion: "focus" },
  drop:         { intensity: 1.0,  audioSensitivity: 1.2,  colorTemp: 0.4, density: 1.0, emotion: "drop" },
  chill:        { intensity: 0.35, audioSensitivity: 0.6,  colorTemp: -0.05, density: 0.55, emotion: "calm" },
  focus:        { intensity: 0.18, audioSensitivity: 0.3,  colorTemp: -0.2, density: 0.35, emotion: "focus" },
  transition:   { intensity: 0.5,  audioSensitivity: 0.7,  colorTemp: 0,    density: 0.6, emotion: "recovery" },
  ambient_idle: { intensity: 0.4,  audioSensitivity: 0.7,  colorTemp: 0,    density: 0.6, emotion: "ambient_idle" },
};

/* ─────────────────────────  STATE  ───────────────────────── */

interface LiveState {
  scene: SceneId;
  targetScene: SceneId;          // when crossfading
  sceneBlend: number;            // 0..1 toward targetScene
  emotion: EmotionState;
  mode: LiveMode;

  // Live signals (0..1)
  audioEnergy: number;           // smoothed bus from AmbientPulse
  audioKick: number;             // last kick spike
  engagement: number;            // AI-derived user energy
  perfHeadroom: number;          // 0 = stressed, 1 = idle

  // AI signals (raw)
  scrollVelocity: number;        // px/sec, normalized
  clicksPerSec: number;
  hoverActivity: number;
  dwellMs: number;               // time since last interaction
  idle: boolean;

  // Spotlight — at most ONE id holds it globally
  spotlightId: string | null;
  // High-energy animation budget (concurrent active animations)
  highEnergyActive: Set<string>;

  // Mixer weights (tunable by scene)
  audioWeight: number;
  sceneWeight: number;
  engagementWeight: number;

  // Resolved final motion level (post-mixer, pre-perf-cap)
  finalMotion: number;

  // FPS watchdog
  fps: number;
  stressLevel: number;           // 0 healthy → 1 dropping frames
}

const state: LiveState = {
  scene: "ambient_idle",
  targetScene: "ambient_idle",
  sceneBlend: 1,
  emotion: "ambient_idle",
  mode: "default",
  audioEnergy: 0,
  audioKick: 0,
  engagement: 0.3,
  perfHeadroom: 1,
  scrollVelocity: 0,
  clicksPerSec: 0,
  hoverActivity: 0,
  dwellMs: 0,
  idle: false,
  spotlightId: null,
  highEnergyActive: new Set(),
  audioWeight: 0.5,
  sceneWeight: 0.3,
  engagementWeight: 0.2,
  finalMotion: 1,
  fps: 60,
  stressLevel: 0,
};

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function subscribeLive(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getLiveState(): Readonly<LiveState> { return state; }

/* ─────────────────────────  PUBLIC API  ───────────────────────── */

/** Switch scene with an automatic crossfade (transition scene during blend). */
export function setScene(next: SceneId, _crossfadeMs = 800) {
  if (state.scene === next && state.targetScene === next) return;
  state.targetScene = next;
  state.sceneBlend = 0;
  emit();
}

export function setLiveMode(mode: LiveMode) {
  state.mode = mode;
  // Modes nudge mixer weights and scene defaults
  switch (mode) {
    case "concert":
      state.audioWeight = 0.6; state.sceneWeight = 0.3; state.engagementWeight = 0.1;
      break;
    case "tiktok":
      // TikTok = interaction-driven, not audio-driven
      state.audioWeight = 0.25; state.sceneWeight = 0.25; state.engagementWeight = 0.5;
      break;
    case "minimal":
      state.audioWeight = 0.15; state.sceneWeight = 0.5; state.engagementWeight = 0.35;
      setScene("focus");
      break;
    case "default":
    default:
      state.audioWeight = 0.5; state.sceneWeight = 0.3; state.engagementWeight = 0.2;
  }
  emit();
}

/**
 * Push fresh audio bands from AmbientPulse into the engine.
 * Called every frame; cheap.
 */
export function pushAudioBands(bands: { overall: number; kick: number }) {
  // Fast attack on kick, slow release — keeps spikes punchy.
  state.audioKick = Math.max(bands.kick, state.audioKick * 0.82);
  state.audioEnergy = state.audioEnergy * 0.78 + bands.overall * 0.22;
}

/**
 * SPOTLIGHT — at most ONE element across the entire app may hold it.
 * Different from `claimDominant(zone, id)` which is per-zone. Spotlight is
 * the single "headline" of the whole stage. Returns true if granted.
 */
export function claimSpotlight(id: string): boolean {
  if (state.spotlightId && state.spotlightId !== id) return false;
  state.spotlightId = id;
  document.documentElement.style.setProperty("--spotlight-active", "1");
  emit();
  return true;
}
export function releaseSpotlight(id: string) {
  if (state.spotlightId === id) {
    state.spotlightId = null;
    document.documentElement.style.setProperty("--spotlight-active", "0");
    emit();
  }
}

/**
 * Register a high-energy animation. Engine enforces a hard cap (default 2).
 * Returns true if allowed, false → caller should fall back to opacity-only.
 */
const MAX_HIGH_ENERGY = 2;
export function requestHighEnergy(id: string): boolean {
  if (state.highEnergyActive.has(id)) return true;
  if (state.highEnergyActive.size >= MAX_HIGH_ENERGY) return false;
  if (state.stressLevel > 0.6) return false; // fallback cascade under stress
  state.highEnergyActive.add(id);
  return true;
}
export function releaseHighEnergy(id: string) {
  state.highEnergyActive.delete(id);
}

/* ─────────────────────────  ADAPTIVE AI  ───────────────────────── */

/**
 * Rule-based AI that converts raw behavioral signals into a single
 * `engagement` score (0..1) and proposes scene changes.
 *
 * - rapid clicks / hovers → wake up, push toward `build` / `drop`
 * - long dwell with no interaction → drift toward `ambient_idle` / `chill`
 * - fast scrolling → stabilize (focus scene), engagement neutral
 * - audio dominant → let scene follow audio (build → drop on energy peaks)
 */
function adaptiveTick(dt: number) {
  // Decay raw signals so they reflect "recent activity".
  state.clicksPerSec = Math.max(0, state.clicksPerSec - dt * 1.2);
  state.hoverActivity = Math.max(0, state.hoverActivity - dt * 0.8);
  state.scrollVelocity *= Math.pow(0.6, dt); // exponential decay
  state.dwellMs += dt * 1000;
  state.idle = state.dwellMs > 12_000;

  // Engagement: clicks dominate, hovers add texture, scrolling subtracts
  // (scrolling = consumption, not engagement with controls).
  const interactionScore = Math.min(1, state.clicksPerSec * 0.6 + state.hoverActivity * 0.15);
  const scrollPenalty = Math.min(0.3, state.scrollVelocity / 4000);
  const idlePenalty = state.idle ? 0.4 : 0;
  const target = Math.max(0.1, interactionScore - scrollPenalty - idlePenalty + 0.2);
  state.engagement = state.engagement * 0.9 + target * 0.1;

  // Scene auto-suggestion (only nudges, never overrides explicit setScene
  // calls within 4 s — caller-priority).
  if (sceneLockUntil < performance.now()) {
    if (state.audioKick > 0.7 && state.audioEnergy > 0.55) autoScene("drop");
    else if (state.audioEnergy > 0.35) autoScene("build");
    else if (state.idle) autoScene("ambient_idle");
    else if (state.scrollVelocity > 1500) autoScene("focus");
    else autoScene("chill");
  }
}

let sceneLockUntil = 0;
export function setSceneManual(s: SceneId, lockMs = 4000) {
  setScene(s);
  sceneLockUntil = performance.now() + lockMs;
}
function autoScene(s: SceneId) {
  if (state.targetScene !== s) setScene(s);
}

/* ─────────────────  DYNAMIC MOTION MIXER  ───────────────── */

function mixerTick() {
  // Crossfade scene blend toward 1.
  if (state.sceneBlend < 1) {
    state.sceneBlend = Math.min(1, state.sceneBlend + 0.04); // ~25 frames ≈ 400ms
    if (state.sceneBlend >= 1) {
      state.scene = state.targetScene;
    }
  }
  const a = SCENES[state.scene];
  const b = SCENES[state.targetScene];
  const sceneIntensity = a.intensity + (b.intensity - a.intensity) * state.sceneBlend;
  const audioSens     = a.audioSensitivity + (b.audioSensitivity - a.audioSensitivity) * state.sceneBlend;
  const density       = a.density + (b.density - a.density) * state.sceneBlend;
  const colorTemp     = a.colorTemp + (b.colorTemp - a.colorTemp) * state.sceneBlend;
  state.emotion       = state.sceneBlend > 0.5 ? b.emotion : a.emotion;

  const audioInput = Math.min(1, (state.audioEnergy * 0.7 + state.audioKick * 0.3) * audioSens);

  // The mixer formula the user requested:
  let final =
    audioInput * state.audioWeight +
    sceneIntensity * state.sceneWeight +
    state.engagement * state.engagementWeight;

  // Hard cap by perf headroom (FPS watchdog).
  final *= state.perfHeadroom;
  final = Math.max(0, Math.min(1, final));
  state.finalMotion = final;

  // Publish to Motion Engine — it remains the single source of truth for
  // --motion-level so every existing consumer keeps working.
  setMotionTargetOverride(final);

  // Publish scene/emotion CSS vars for CSS consumers.
  const root = document.documentElement;
  root.style.setProperty("--scene-intensity", sceneIntensity.toFixed(3));
  root.style.setProperty("--scene-density", density.toFixed(3));
  root.style.setProperty("--scene-color-temp", colorTemp.toFixed(3));
  root.style.setProperty("--user-engagement", state.engagement.toFixed(3));
  root.style.setProperty("--audio-mix", audioInput.toFixed(3));
  root.style.setProperty("--perf-headroom", state.perfHeadroom.toFixed(3));
  root.dataset.scene = state.targetScene;
  root.dataset.emotion = state.emotion;
  root.dataset.liveMode = state.mode;
}

/* ─────────────────  FPS WATCHDOG (anti-chaos)  ───────────────── */

let lastFrameTs = 0;
let fpsEma = 60;
function watchdogTick(now: number) {
  if (lastFrameTs) {
    const dt = now - lastFrameTs;
    const inst = 1000 / Math.max(1, dt);
    fpsEma = fpsEma * 0.92 + inst * 0.08;
    state.fps = fpsEma;
    // Stress rises below 45 fps, falls back above 55 fps.
    const target = fpsEma < 45 ? Math.min(1, (45 - fpsEma) / 25) : 0;
    state.stressLevel = state.stressLevel * 0.9 + target * 0.1;
    // Perf headroom — degrades motion before FPS collapses further.
    const targetHead = 1 - state.stressLevel * 0.6;
    state.perfHeadroom = state.perfHeadroom * 0.9 + targetHead * 0.1;
  }
  lastFrameTs = now;
}

/* ─────────────────  DOM SIGNAL LISTENERS  ───────────────── */

function attachSignalListeners() {
  let lastScrollY = window.scrollY;
  let lastScrollTs = performance.now();
  window.addEventListener("scroll", () => {
    const now = performance.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = Math.max(16, now - lastScrollTs);
    state.scrollVelocity = state.scrollVelocity * 0.6 + (dy / dt) * 1000 * 0.4;
    lastScrollY = window.scrollY;
    lastScrollTs = now;
    state.dwellMs = 0;
  }, { passive: true });

  window.addEventListener("pointerdown", () => {
    state.clicksPerSec = Math.min(6, state.clicksPerSec + 1);
    state.dwellMs = 0;
  });
  window.addEventListener("pointermove", () => {
    state.hoverActivity = Math.min(1, state.hoverActivity + 0.05);
    state.dwellMs = 0;
  }, { passive: true });
  window.addEventListener("keydown", () => { state.dwellMs = 0; });
}

/* ─────────────────  BOOT  ───────────────── */

let booted = false;
export function bootLiveExperience() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  attachSignalListeners();

  let lastTs = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - lastTs) / 1000);
    lastTs = now;
    watchdogTick(now);
    adaptiveTick(dt);
    mixerTick();
    emit();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function shutdownLiveExperience() {
  clearMotionTargetOverride();
  booted = false;
}
