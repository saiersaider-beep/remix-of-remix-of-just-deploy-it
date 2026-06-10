import { useEffect, useRef, useState } from "react";
import { ensureAnalyser, subscribeAudioElement } from "@/lib/audio-bus";

/**
 * Returns a smoothed 0..1 audio energy value (lows + mids) using the shared
 * AnalyserNode. Idle (no playback) returns a very slow ambient breathing wave
 * so reactive UI never feels frozen.
 */
export function useAudioPulse(active = true) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let analyser = ensureAnalyser();
    const unsub = subscribeAudioElement(() => {
      analyser = ensureAnalyser();
    });
    const data = new Uint8Array(64);
    let phase = 0;
    let smoothed = 0;

    const tick = () => {
      phase += 0.02;
      let raw: number;
      if (active && analyser) {
        try {
          analyser.getByteFrequencyData(data);
          // Average lows + low-mids (most musical "punch")
          let sum = 0;
          let n = 0;
          for (let i = 2; i < 24; i++) {
            sum += data[i] ?? 0;
            n++;
          }
          raw = n > 0 ? sum / n / 255 : 0;
        } catch {
          raw = 0;
        }
      } else {
        raw = 0;
      }
      // Ambient breathing fallback when silent
      const ambient = (Math.sin(phase) * 0.5 + 0.5) * 0.08;
      const target = Math.max(raw, ambient);
      smoothed = smoothed * 0.82 + target * 0.18;
      setLevel(smoothed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      unsub();
    };
  }, [active]);

  return level;
}
