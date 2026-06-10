// Shared bus for the single global <audio> element + Web Audio analyser.
// PlayerProvider registers the element; UI components (waveform, visualizer)
// subscribe to it without needing direct refs.

type Listener = (el: HTMLAudioElement | null) => void;

let _el: HTMLAudioElement | null = null;
const listeners = new Set<Listener>();

let _ctx: AudioContext | null = null;
let _source: MediaElementAudioSourceNode | null = null;
let _analyser: AnalyserNode | null = null;
let _gain: GainNode | null = null;

export function setGlobalAudioElement(el: HTMLAudioElement | null) {
  _el = el;
  listeners.forEach((l) => l(el));
}

export function getGlobalAudioElement(): HTMLAudioElement | null {
  return _el;
}

export function subscribeAudioElement(l: Listener): () => void {
  listeners.add(l);
  l(_el);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Lazily create (or return) the shared AnalyserNode wired to the global audio
 * element. Must be called from a user gesture-adjacent code path (the browser
 * AudioContext starts suspended; we resume on demand).
 */
export function ensureAnalyser(): AnalyserNode | null {
  if (typeof window === "undefined") return null;
  const el = _el;
  if (!el) return null;
  try {
    if (!_ctx) {
      const Ctor = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext) as typeof AudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    if (_ctx.state === "suspended") {
      void _ctx.resume();
    }
    // CRITICAL: only wire MediaElementSource once the context is actually
    // running. Connecting it to a suspended context routes the <audio>
    // through a silent graph — the element keeps "buffering" forever and
    // no sound is heard. Defer until a user-gesture-triggered resume.
    if (!_source && _ctx.state === "running") {
      _source = _ctx.createMediaElementSource(el);
      _analyser = _ctx.createAnalyser();
      _analyser.fftSize = 128;
      _analyser.smoothingTimeConstant = 0.82;
      _gain = _ctx.createGain();
      _gain.gain.value = 1;
      _source.connect(_gain);
      _gain.connect(_analyser);
      _analyser.connect(_ctx.destination);
    }
    return _analyser;
  } catch {
    return null;
  }
}

/**
 * Smoothly ramp the master gain (fade in/out) without touching element.volume.
 * Returns true if a ramp was scheduled, false if Web Audio isn't ready.
 */
export function fadeGain(target: number, durationMs = 180): boolean {
  if (!_ctx || !_gain) return false;
  const now = _ctx.currentTime;
  const g = _gain.gain;
  try {
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), now + durationMs / 1000);
    return true;
  } catch {
    return false;
  }
}
