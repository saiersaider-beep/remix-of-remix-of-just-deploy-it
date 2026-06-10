import { useEffect, useRef } from "react";
import { usePlayerStore, currentTrack } from "@/stores/player";
import { resolveAudioUrl, checkTrackAccess, PAID_PREVIEW_SECONDS } from "@/lib/player";
import { recordTrackEvent } from "@/lib/track-events";
import { recordListening } from "@/lib/listening-history";
import { setGlobalAudioElement, ensureAnalyser, fadeGain } from "@/lib/audio-bus";
import { useRadioListeningStore } from "@/stores/radio-listening";

/**
 * Mounts the single global <audio> element and bridges it to the Zustand store.
 * Also enforces the 10-second preview limit for paid tracks the user has not bought.
 */
export function PlayerProvider() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedTrackIdRef = useRef<string | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const playFiredForLoadRef = useRef<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const safePlay = async (el: HTMLAudioElement) => {
    let faded = false;
    try {
      // Wake Web Audio + reset gain to 0 then fade in for a smooth start.
      ensureAnalyser();
      // If the element has no usable source yet (e.g. during a fast track
      // switch) bail out gracefully — the load effect will retry once src
      // is set. Otherwise el.play() rejects with NotSupportedError and the
      // user sees "Lecture refusée par le navigateur".
      if (!el.src || (el.readyState === 0 && !el.networkState)) return;
      fadeGain(0, 0);
      faded = true;
      const p = el.play();
      playPromiseRef.current = p;
      await p;
      // Long fade-in pairs with the long fade-out for a smooth crossfade feel.
      fadeGain(1, 520);
      faded = false;
    } catch (e: any) {
      // AbortError + the harmless "interrupted by a call to pause()" race
      // happen routinely on track switches — they're not real errors.
      const name = e?.name;
      const msg: string = e?.message ?? "";
      if (name === "AbortError" || /interrupted by a call to (pause|load)/i.test(msg)) {
        return;
      }
      if (name === "NotAllowedError") {
        usePlayerStore.getState()._setError(
          "Touche play pour démarrer la lecture (le navigateur bloque l'autoplay).",
        );
        usePlayerStore.getState().setPlaying(false);
        return;
      }
      usePlayerStore.getState()._setError(e?.message ?? "Lecture impossible. Réessaie.");
    } finally {
      playPromiseRef.current = null;
      // CRITICAL: if we faded the gain to 0 but never made it to the
      // fade-in (early return, AbortError on track switch / live sync seek,
      // autoplay denial), restore the gain. Otherwise audio plays silently
      // — the most common "I'm connected to the live but I hear nothing"
      // symptom.
      if (faded) {
        try { fadeGain(1, 120); } catch { /* ignore */ }
      }
    }
  };

  const safePause = async (el: HTMLAudioElement) => {
    if (playPromiseRef.current) {
      try { await playPromiseRef.current; } catch { /* ignore */ }
    }
    // Longer fade-out so track transitions feel like a real DJ crossfade
    // rather than a hard cut. ~360ms of dip + the load latency of the new
    // src reads as a soft fade to listeners.
    const faded = fadeGain(0, 360);
    if (faded) {
      await new Promise((r) => setTimeout(r, 380));
    }
    el.pause();
  };

  const track = usePlayerStore(currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);

  // Create audio element once
  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    el.crossOrigin = "anonymous";
    audioRef.current = el;
    setGlobalAudioElement(el);

    // Prime Web Audio on the first user gesture so the AudioContext
    // transitions to "running". Without this, MediaElementSource gets
    // wired to a suspended context and audio is silently routed nowhere
    // (the player appears stuck on the buffering spinner).
    const primeAudio = () => {
      ensureAnalyser();
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
      window.removeEventListener("touchstart", primeAudio);
    };
    window.addEventListener("pointerdown", primeAudio, { once: false });
    window.addEventListener("keydown", primeAudio, { once: false });
    window.addEventListener("touchstart", primeAudio, { once: false });

    const setPosition = usePlayerStore.getState()._setPosition;
    const setDuration = usePlayerStore.getState()._setDuration;
    const setBuffering = usePlayerStore.getState()._setBuffering;
    const setError = usePlayerStore.getState()._setError;
    const onEnded = usePlayerStore.getState()._onEnded;

    const onTime = () => {
      setPosition(el.currentTime);
      // Paywall enforcement — skipped while listening to an artist's radio
      // live: the listener mirrors the host's stream and must not be
      // interrupted by a "buy this track" prompt. They're attending a
      // broadcast, not auditioning a paid catalog track on their own.
      const state = usePlayerStore.getState();
      const t = currentTrack(state);
      if (!t) return;
      const inRadio = !!useRadioListeningStore.getState().hostArtistId;
      if (inRadio) return;
      const isPaid = t.pricing_model === "paid";
      const has = state.accessMap[t.id];
      const minutePassWindow = state.minutePassMap[t.id];
      if (isPaid && has === false) {
        // 1-minute pass active: enforce its cutoff (default 60s) and reset.
        if (minutePassWindow && minutePassWindow > 0) {
          if (el.currentTime >= minutePassWindow) {
            el.pause();
            // Consume the pass so the user can't replay it for free.
            usePlayerStore.setState((s) => {
              const m = { ...s.minutePassMap };
              delete m[t.id];
              return { minutePassMap: m };
            });
            state.openPaywall(t);
          }
          return;
        }
        const limit = t.preview_seconds && t.preview_seconds > 0 ? Math.min(t.preview_seconds, PAID_PREVIEW_SECONDS) : PAID_PREVIEW_SECONDS;
        if (el.currentTime >= limit) {
          el.pause();
          state.openPaywall(t);
        }
      }
    };
    const onDur = () => setDuration(el.duration || 0);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      const t = currentTrack(usePlayerStore.getState());
      if (t && playFiredForLoadRef.current !== t.id) {
        playFiredForLoadRef.current = t.id;
        void recordTrackEvent(t.id, t.artist_id, "play").catch(() => {});
        void recordListening(t.id).catch(() => {});
      }
    };
    const onCanPlay = () => setBuffering(false);
    const onErrorEvt = () => setError("Lecture impossible. Vérifie ta connexion ou réessaie.");
    const onEnd = () => onEnded();

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onErrorEvt);
    el.addEventListener("ended", onEnd);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onErrorEvt);
      el.removeEventListener("ended", onEnd);
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
      window.removeEventListener("touchstart", primeAudio);
      el.pause();
      el.src = "";
      setGlobalAudioElement(null);
    };
  }, []);

  // Load src whenever the current track changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!track) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      loadedTrackIdRef.current = null;
      playFiredForLoadRef.current = null;
      return;
    }
    if (loadedTrackIdRef.current === track.id) return;
    loadedTrackIdRef.current = track.id;
    playFiredForLoadRef.current = null;
    usePlayerStore.getState()._setBuffering(true);
    usePlayerStore.getState()._setError(null);

    let cancelled = false;
    (async () => {
      try {
        // Verify the user is signed in — the audio server fn requires auth.
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (cancelled) return;
          usePlayerStore.getState()._setError(
            "Connecte-toi pour écouter de la musique.",
          );
          return;
        }
        // Check access for paid tracks (cache result)
        let accessKnown = usePlayerStore.getState().accessMap[track.id];
        if (track.pricing_model === "paid" && accessKnown === undefined) {
          accessKnown = await checkTrackAccess(track.id);
          if (cancelled) return;
          usePlayerStore.getState().setAccess(track.id, accessKnown);
        }
        const hasMinutePass = !!usePlayerStore.getState().minutePassMap[track.id];
        const wantPreview =
          track.pricing_model === "paid" && accessKnown === false && !hasMinutePass;
        const resolved = await resolveAudioUrl(track, {
          mode: wantPreview ? "preview" : "full",
        });
        if (cancelled || loadedTrackIdRef.current !== track.id) return;
        await safePause(el);
        el.src = resolved.url;
        el.load();
        if (usePlayerStore.getState().isPlaying) {
          await safePlay(el);
        }
        // Safety net: if neither "playing" nor "error" has fired after 12s,
        // the element is stuck (CORS/decoder/network). Surface a real error
        // instead of leaving the UI spinning forever.
        setTimeout(() => {
          if (cancelled || loadedTrackIdRef.current !== track.id) return;
          const s = usePlayerStore.getState();
          if (s.isBuffering && s.position === 0) {
            s._setError("Lecture impossible. Vérifie ta connexion ou réessaie.");
          }
        }, 12000);
      } catch (e) {
        if (!cancelled) {
          usePlayerStore.getState()._setError(
            e instanceof Error ? e.message : "Audio introuvable.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track]);

  // Sync play/pause
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;
    if (isPlaying) {
      void safePlay(el);
    } else {
      void safePause(el);
    }
  }, [isPlaying, track]);

  // Sync volume/mute
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  // Apply seek requests — block seeking past preview limit on paid/unowned
  const seekRequest = usePlayerStore((s) => s._seekRequest);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const r = usePlayerStore.getState()._consumeSeek();
    if (r === null) return;
    if (Number.isFinite(r) && r >= 0) {
      const state = usePlayerStore.getState();
      const t = currentTrack(state);
      const inRadio = !!useRadioListeningStore.getState().hostArtistId;
      let target = r;
      if (!inRadio && t && t.pricing_model === "paid" && state.accessMap[t.id] === false) {
        const limit = t.preview_seconds && t.preview_seconds > 0 ? Math.min(t.preview_seconds, PAID_PREVIEW_SECONDS) : PAID_PREVIEW_SECONDS;
        if (target >= limit) {
          state.openPaywall(t);
          target = Math.max(0, limit - 0.1);
        }
      }
      try {
        el.currentTime = target;
      } catch {
        // ignore — element not ready yet
      }
    }
  }, [seekRequest]);

  // Prefetch the next queue track when the current one is near the end so
  // the browser primes its HTTP cache and the transition feels seamless.
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  useEffect(() => {
    if (!track || duration <= 0) return;
    const remaining = duration - position;
    if (remaining > 12 || remaining <= 0) return;
    const s = usePlayerStore.getState();
    const next = s.queue[s.index + 1];
    if (!next || preloadedTrackIdRef.current === next.id) return;
    preloadedTrackIdRef.current = next.id;
    (async () => {
      try {
        const wantPreview =
          next.pricing_model === "paid" && s.accessMap[next.id] === false;
        const resolved = await resolveAudioUrl(next, {
          mode: wantPreview ? "preview" : "full",
        });
        if (preloadRef.current) {
          try { preloadRef.current.src = ""; } catch { /* ignore */ }
        }
        const el = new Audio();
        el.preload = "auto";
        el.muted = true;
        el.crossOrigin = "anonymous";
        el.src = resolved.url;
        try { el.load(); } catch { /* ignore */ }
        preloadRef.current = el;
      } catch {
        preloadedTrackIdRef.current = null;
      }
    })();
  }, [track, position, duration]);

  // Reset preload tracker when the active track changes
  useEffect(() => {
    preloadedTrackIdRef.current = null;
  }, [track?.id]);

  return null;
}
