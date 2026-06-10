import { useEffect, useRef, useState } from "react";
import { ensureAnalyser, subscribeAudioElement } from "@/lib/audio-bus";

export type AudioBands = {
  /** Transient kick energy (lows + peak detection). Spikes briefly on hits. 0..1 */
  kick: number;
  /** Smoothed bass energy. Slower swells. 0..1 */
  bass: number;
  /** Mid-range energy (vocals, leads). 0..1 */
  mid: number;
  /** High frequencies (hats, air). 0..1 */
  high: number;
  /** Overall musical energy (bass + mids), matches legacy useAudioPulse. 0..1 */
  overall: number;
};

const ZERO: AudioBands = { kick: 0, bass: 0, mid: 0, high: 0, overall: 0 };

/**
 * Multi-band reactive audio energy, derived from the shared AnalyserNode.
 *
 * Tuned for "live but restrained" UI:
 *  - kick uses fast attack / slow decay so visual hits feel like real hits.
 *  - bass / mid / high are smoothed averages (no jitter).
 *  - When silent, an ambient sine breath keeps things alive (~0.05–0.08).
 *
 * Pass `active=false` to freeze at zero (e.g. when the component is off-screen).
 */
export function useAudioBands(active = true): AudioBands {
  const [bands, setBands] = useState<AudioBands>(ZERO);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let analyser = ensureAnalyser();
    const unsub = subscribeAudioElement(() => {
      analyser = ensureAnalyser();
    });
    const data = new Uint8Array(64);
    let phase = 0;

    // Smoothed values (carry between frames).
    let sKick = 0;
    let sBass = 0;
    let sMid = 0;
    let sHigh = 0;
    let sOverall = 0;
    let kickEnvelope = 0; // peak-and-decay envelope for transient detection

    const avg = (from: number, to: number) => {
      let sum = 0;
      let n = 0;
      for (let i = from; i < to; i++) {
        sum += data[i] ?? 0;
        n++;
      }
      return n > 0 ? sum / n / 255 : 0;
    };

    const tick = () => {
      phase += 0.02;
      let rawBass = 0;
      let rawMid = 0;
      let rawHigh = 0;
      if (active && analyser) {
        try {
          analyser.getByteFrequencyData(data);
          // fftSize=128 → 64 bins. Tuned for musical bands.
          rawBass = avg(1, 6);    // ~40–250 Hz
          rawMid = avg(6, 24);    // ~250 Hz – 2 kHz
          rawHigh = avg(24, 56);  // ~2 kHz – 12 kHz
        } catch {
          rawBass = rawMid = rawHigh = 0;
        }
      }
      // Ambient breath when silent — never fully frozen.
      const ambient = (Math.sin(phase) * 0.5 + 0.5) * 0.06;

      // Smoothed bands.
      const tBass = Math.max(rawBass, ambient);
      const tMid = Math.max(rawMid, ambient * 0.6);
      const tHigh = Math.max(rawHigh, ambient * 0.4);
      sBass = sBass * 0.82 + tBass * 0.18;
      sMid = sMid * 0.78 + tMid * 0.22;
      sHigh = sHigh * 0.7 + tHigh * 0.3;
      sOverall = sOverall * 0.82 + ((tBass + tMid) * 0.5) * 0.18;

      // Kick: peak-and-decay on bass. Fast attack, slow release.
      // Rises instantly to rawBass when it exceeds the envelope,
      // then decays exponentially. Produces sharp punchy spikes.
      kickEnvelope = Math.max(rawBass, kickEnvelope * 0.86);
      // Subtract a floor so quiet passages don't pulse.
      const kickRaw = Math.max(0, kickEnvelope - 0.18) / 0.82;
      sKick = sKick * 0.4 + kickRaw * 0.6; // light smoothing only

      setBands({
        kick: Math.min(1, sKick),
        bass: Math.min(1, sBass),
        mid: Math.min(1, sMid),
        high: Math.min(1, sHigh),
        overall: Math.min(1, sOverall),
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      unsub();
    };
  }, [active]);

  return bands;
}
