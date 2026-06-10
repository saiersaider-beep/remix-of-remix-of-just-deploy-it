import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  ChevronDown,
  Loader2,
  X,
  Music2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { usePlayerStore, currentTrack } from "@/stores/player";
import { formatTime } from "@/lib/player";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { PremiumWaveform } from "@/components/PremiumWaveform";
import { useAudioBands } from "@/hooks/use-audio-bands";

/**
 * Live halo around the cover — reacts to kick transients (fast attack, slow decay).
 * Calibrated subtle: max +12% scale, +30% glow opacity on a hard hit.
 */
function ReactiveLiveHalo({ active }: { active: boolean }) {
  const { kick, bass } = useAudioBands(active);
  const scale = 1 + kick * 0.12 + bass * 0.04;
  const glowOpacity = 0.55 + kick * 0.35;
  const ringOpacity = 0.55 + bass * 0.3;
  return (
    <>
      <span
        aria-hidden
        className="absolute -inset-1 rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-500 blur-md pointer-events-none will-change-transform"
        style={{
          opacity: glowOpacity,
          transform: `scale(${scale})`,
          transition: "transform 90ms linear, opacity 120ms linear",
        }}
      />
      <span
        aria-hidden
        className="absolute -inset-0.5 rounded-xl ring-2 ring-rose-400 pointer-events-none"
        style={{ opacity: ringOpacity, transition: "opacity 140ms linear" }}
      />
    </>
  );
}

export function StickyMiniPlayer() {
  const track = usePlayerStore(currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const repeat = usePlayerStore((s) => s.repeat);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const expanded = usePlayerStore((s) => s.expanded);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const error = usePlayerStore((s) => s.error);

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setExpanded = usePlayerStore((s) => s.setExpanded);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);

  // Radio-live feature removed. Kept as inert constants so the rest of the
  // component (which still references them) stays a no-op.
  const hostArtistName: string | null = null;
  const radioLocked = false;
  const lockedNoop = () => {};
  const guardedToggle = toggle;
  const guardedNext = next;
  const guardedPrev = prev;
  const guardedSeek = seek;
  const guardedShuffle = toggleShuffle;
  const guardedRepeat = cycleRepeat;
  void hostArtistName;
  void lockedNoop;

  if (!track) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      <MiniBar
        track={track}
        isPlaying={isPlaying}
        isBuffering={isBuffering}
        pct={pct}
        position={position}
        duration={duration}
        volume={volume}
        muted={muted}
        repeat={repeat}
        shuffle={shuffle}
        error={error}
        radioLocked={radioLocked}
        onToggle={guardedToggle}
        onNext={guardedNext}
        onPrev={guardedPrev}
        onSeek={guardedSeek}
        onVolume={setVolume}
        onMute={toggleMute}
        onShuffle={guardedShuffle}
        onRepeat={guardedRepeat}
        onExpand={() => setExpanded(true)}
        onQueue={() => setQueueOpen(true)}
      />
      {radioLocked && (
        <div className="fixed bottom-[88px] sm:bottom-[112px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] bg-rose-600 text-white shadow-[0_8px_24px_-8px_rgba(225,29,72,0.6)] flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Lecture pilotée par {hostArtistName ?? "l'artiste"}
          </div>
        </div>
      )}
      {expanded && (
        <NowPlayingScreen
          track={track}
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          position={position}
          duration={duration}
          volume={volume}
          muted={muted}
          repeat={repeat}
          shuffle={shuffle}
          radioLocked={radioLocked}
          onToggle={guardedToggle}
          onNext={guardedNext}
          onPrev={guardedPrev}
          onSeek={guardedSeek}
          onVolume={setVolume}
          onMute={toggleMute}
          onShuffle={guardedShuffle}
          onRepeat={guardedRepeat}
          onClose={() => setExpanded(false)}
          onQueue={() => setQueueOpen(true)}
        />
      )}
      {queueOpen && <QueueDrawer onClose={() => setQueueOpen(false)} />}
    </>
  );
}

interface BarProps {
  track: NonNullable<ReturnType<typeof currentTrack>>;
  isPlaying: boolean;
  isBuffering: boolean;
  pct: number;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: "off" | "all" | "one";
  shuffle: boolean;
  error: string | null;
  radioLocked?: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (s: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onExpand: () => void;
  onQueue: () => void;
}

function MiniBar(props: BarProps) {
  const {
    track, isPlaying, isBuffering, pct, position, duration,
    volume, muted, repeat, shuffle, error, radioLocked,
    onToggle, onNext, onPrev, onSeek, onVolume, onMute,
    onShuffle, onRepeat, onExpand, onQueue,
  } = props;

  // Mobile gestures: swipe up = expand, swipe left/right = next/prev
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    touchStart.current = null;
    if (dy > 50 && Math.abs(dy) > Math.abs(dx)) {
      onExpand();
    } else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onNext();
      else onPrev();
    }
  };

  return (
    <div className="fixed bottom-[64px] left-0 right-0 sm:bottom-4 sm:left-4 sm:right-4 z-50 pointer-events-none">
      <div className="mx-auto max-w-[1500px] pointer-events-auto">
        <div
          className="bg-[rgba(18,18,22,0.72)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[20px] overflow-hidden ring-1 ring-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.5),0_24px_60px_-20px_rgba(255,107,0,0.18)] transition-all duration-500 hover:ring-white/[0.12] hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.6),0_32px_80px_-20px_rgba(255,107,0,0.25)]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Seekable progress bar (read-only in radio listener mode) */}
          <SeekBar pct={pct} duration={duration} onSeek={onSeek} locked={!!radioLocked} />



          {error && (
            <div className="px-4 py-1.5 text-xs text-destructive flex items-center gap-2 bg-destructive/10">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
            {/* Track info */}
            <button
              type="button"
              onClick={onExpand}
              className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-72 text-left"
            >
              <div className="relative shrink-0" key={`cover-${track.id}`}>
                {/* Live halo — pulsing rose/fuchsia ring around the cover.
                    Reacts to kick transients when locked & playing. */}
                {radioLocked && (
                  <ReactiveLiveHalo active={isPlaying && !isBuffering} />
                )}
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className={`relative w-12 h-12 rounded-lg object-cover shadow-glow transition-transform duration-700 animate-scale-in ${
                      isPlaying && !isBuffering && !radioLocked ? "animate-vinyl-spin" : ""
                    }`}
                  />

                ) : (
                  <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent-cyan grid place-items-center">
                    <Music2 className="w-5 h-5 text-white" />
                  </div>
                )}
                {isPlaying && !isBuffering && (
                  <>
                    <div className="absolute inset-0 rounded-lg ring-2 ring-primary/60 animate-pulse" />
                    {/* Live visualizer overlay reacting to audio */}
                    <div className="pointer-events-none absolute inset-x-1 bottom-1 h-4 opacity-90 mix-blend-screen">
                      <AudioVisualizer active bars={10} height={16} />
                    </div>
                  </>
                )}
                {isBuffering && (
                  <div className="absolute inset-0 rounded-lg bg-black/40 grid place-items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 animate-fade-up" key={`meta-${track.id}`} style={{ animationDuration: "320ms" }}>
                <p className="font-bold text-sm truncate flex items-center gap-1.5">
                  {radioLocked && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9px] font-black uppercase tracking-[0.14em] bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.4)]">
                      <Lock className="w-2.5 h-2.5" /> Live
                    </span>
                  )}
                  <span className="truncate">{track.title}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist_name}
                  {track.genre ? ` · ${track.genre}` : ""}
                </p>
              </div>
            </button>

            {/* Controls (desktop) */}
            <div className="hidden sm:flex flex-1 items-center justify-center gap-2">
              <button
                onClick={onShuffle}
                className={`hidden md:grid place-items-center w-8 h-8 rounded-full transition ${shuffle ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Shuffle"
                aria-pressed={shuffle}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={onPrev} className="grid place-items-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition" aria-label="Précédent">
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={onToggle}
                aria-disabled={radioLocked || undefined}
                title={radioLocked ? "Lecture pilotée par l'artiste en direct" : isPlaying ? "Pause" : "Lecture"}
                className={`relative grid place-items-center w-12 h-12 rounded-full text-white transition-all duration-500 active:scale-95 hover:scale-105 ${
                  radioLocked
                    ? "bg-rose-600 cursor-not-allowed opacity-95 shadow-[0_8px_28px_-8px_rgba(225,29,72,0.55)]"
                    : `bg-gradient-to-br from-[#C2410C] via-[#E8731E] to-[#F98F1D] shadow-[0_10px_30px_-8px_rgba(194,65,12,0.45),0_4px_12px_-2px_rgba(249,143,29,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] ${isPlaying ? "animate-breathe-glow" : ""}`
                }`}
                aria-label={isPlaying ? "Pause" : "Lecture"}
              >
                {isPlaying && !isBuffering && !radioLocked && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary/30 blur-md"
                  />
                )}
                <span className="relative grid place-items-center transition-transform duration-300">
                  {radioLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : isBuffering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current animate-scale-in" key="pause" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5 animate-scale-in" key="play" />
                  )}
                </span>
              </button>
              <button onClick={onNext} className="grid place-items-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground transition" aria-label="Suivant">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={onRepeat}
                className={`hidden md:grid place-items-center w-8 h-8 rounded-full transition ${repeat !== "off" ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Répéter"
              >
                {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            {/* Mobile play */}
            <div className="sm:hidden flex items-center gap-1">
              <button onClick={onPrev} className="grid place-items-center w-9 h-9 rounded-full text-muted-foreground" aria-label="Précédent">
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={onToggle}
                className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-[#C2410C] via-[#E8731E] to-[#F98F1D] text-white shadow-[0_8px_24px_-6px_rgba(194,65,12,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]"
                aria-label={isPlaying ? "Pause" : "Lecture"}
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
              <button onClick={onNext} className="grid place-items-center w-9 h-9 rounded-full text-muted-foreground" aria-label="Suivant">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-3 w-80 justify-end">
              <div className="hidden md:block w-20 xl:w-28 opacity-90">
                <AudioVisualizer active={isPlaying && !isBuffering} bars={20} height={24} />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {formatTime(position)} / {formatTime(duration)}
              </span>
              <button onClick={onQueue} className="grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground transition" aria-label="File d'attente">
                <ListMusic className="w-4 h-4" />
              </button>
              <button onClick={onMute} className="grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground transition" aria-label="Muet">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="w-24 accent-violet-500"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeekBar({ pct, duration, onSeek, locked }: { pct: number; duration: number; onSeek: (s: number) => void; locked?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const handle = (clientX: number) => {
    if (locked) { onSeek(0); return; }
    const el = ref.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };
  const trackHover = (clientX: number) => {
    if (locked) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHoverPct(ratio * 100);
  };
  return (
    <div
      ref={ref}
      className={`relative h-[3px] ${locked ? "" : "hover:h-[7px] cursor-pointer"} transition-[height] duration-200 bg-white/[0.06] group`}
      onClick={(e) => handle(e.clientX)}
      onMouseMove={(e) => trackHover(e.clientX)}
      onMouseLeave={() => setHoverPct(null)}
      onTouchEnd={(e) => !locked && handle(e.changedTouches[0].clientX)}
      aria-disabled={locked || undefined}
    >
      {/* Hover preview */}
      {hoverPct !== null && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/15 pointer-events-none transition-[width] duration-75"
          style={{ width: `${hoverPct}%` }}
        />
      )}
      {/* Progress */}
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-fuchsia-500 to-accent-cyan transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
      {/* Glow trail */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 blur-lg opacity-80 bg-gradient-to-r from-primary via-fuchsia-500 to-accent-cyan"
        style={{ width: `${pct}%` }}
      />
      {/* Scrubber dot */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_18px_4px_rgba(167,139,250,0.7)] opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200"
        style={{ left: `calc(${pct}% - 7px)` }}
      />
    </div>
  );
}

function NowPlayingScreen(props: Omit<BarProps, "pct" | "error" | "onExpand"> & { onClose: () => void }) {
  const {
    track, isPlaying, isBuffering, position, duration, volume, muted, repeat, shuffle,
    onToggle, onNext, onPrev, onSeek, onVolume, onMute, onShuffle, onRepeat, onClose, onQueue,
  } = props;

  // Lock scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Swipe down to close
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    if (dy > 80) onClose();
  };

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Floating reactions — discreet, slow, capped count.
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const sendReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    const x = 40 + Math.random() * 20; // % from left, centered
    setReactions((r) => [...r.slice(-6), { id, emoji, x }]);
    window.setTimeout(() => setReactions((r) => r.filter((it) => it.id !== id)), 3200);
  };

  return (
    <div
      className="fixed inset-0 z-[60] text-foreground flex flex-col overflow-hidden animate-fade-up"
      style={{ animationDuration: "var(--motion-slow)", animationTimingFunction: "var(--ease-cinema)" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Immersive backdrop: blurred cover at huge scale + deep vignette.
          AmbientBackdrop is already mounted globally; this layer adds depth on top. */}
      {track.cover_url ? (
        <div aria-hidden className="absolute inset-0 -z-10">
          <img
            src={track.cover_url}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover scale-[1.4] ${isPlaying ? "animate-vinyl-spin" : ""}`}
            style={{ filter: "blur(80px) saturate(140%)", opacity: 0.55, animationDuration: "60s" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(5,8,22,0.35) 0%, rgba(5,8,22,0.88) 70%, rgba(5,8,22,0.96) 100%)",
            }}
          />
        </div>
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-background/95 backdrop-blur-xl" />
      )}

      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <button
          onClick={onClose}
          className="grid place-items-center w-10 h-10 rounded-full hover:bg-white/10 transition-all"
          style={{ transitionDuration: "var(--motion-fast)" }}
          aria-label="Fermer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">En lecture · immersif</p>
        <button
          onClick={onQueue}
          className="grid place-items-center w-10 h-10 rounded-full hover:bg-white/10 transition-all"
          style={{ transitionDuration: "var(--motion-fast)" }}
          aria-label="File d'attente"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-8 px-6 lg:px-12 pb-8 max-w-[1600px] mx-auto w-full min-h-0">
        {/* Left: Cover + meta */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
          <div className="relative">
            <div
              className={`aspect-square w-[min(70vh,420px)] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 ${
                isPlaying ? "animate-breathe-glow" : ""
              }`}
            >
              {track.cover_url ? (
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className={`w-full h-full object-cover ${isPlaying ? "animate-vinyl-spin" : ""}`}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent-cyan grid place-items-center">
                  <Music2 className="w-20 h-20 text-white" />
                </div>
              )}
            </div>
            {/* Floating reactions layer */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden">
              {reactions.map((r) => (
                <span
                  key={r.id}
                  className="absolute bottom-0 text-3xl animate-float-up"
                  style={{ left: `${r.x}%`, animationDuration: "3.2s" }}
                >
                  {r.emoji}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center w-full max-w-md">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold truncate tracking-tight">
              {track.title}
            </h2>
            <Link
              to="/artists/$slug"
              params={{ slug: track.artist_slug }}
              onClick={onClose}
              className="mt-2 inline-block text-base text-muted-foreground hover:text-primary-glow transition-colors"
              style={{ transitionDuration: "var(--motion-fast)" }}
            >
              {track.artist_name}
            </Link>
          </div>

          {/* Discreet reaction strip */}
          <div className="flex items-center gap-2">
            {["❤️", "🔥", "✨", "🎧", "🙌"].map((e) => (
              <button
                key={e}
                onClick={() => sendReaction(e)}
                className="grid place-items-center w-10 h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.10] ring-1 ring-white/5 text-lg transition-all"
                style={{ transitionDuration: "var(--motion-fast)" }}
                aria-label={`Réagir ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Waveform + controls */}
        <div className="flex-1 flex flex-col justify-center gap-6 max-w-2xl w-full mx-auto">
          <div className="glass rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Forme d'onde</p>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {formatTime(position)} <span className="opacity-50">/ {formatTime(duration)}</span>
              </span>
            </div>
            <PremiumWaveform
              url={track.audio_url ?? null}
              isCurrent
              isPlaying={isPlaying && !isBuffering}
              height={120}
            />
          </div>

          <div className="flex items-center justify-center gap-3 md:gap-5">
            <button
              onClick={onShuffle}
              className={`grid place-items-center w-11 h-11 rounded-full transition-all hover:bg-white/5 ${
                shuffle ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ transitionDuration: "var(--motion-fast)" }}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={onPrev}
              className="grid place-items-center w-12 h-12 rounded-full hover:bg-white/10 transition-all"
              style={{ transitionDuration: "var(--motion-fast)" }}
              aria-label="Précédent"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
            <button
              onClick={onToggle}
              className={`relative grid place-items-center w-20 h-20 rounded-full bg-gradient-to-br from-primary via-violet-500 to-accent-cyan text-white shadow-glow active:scale-95 hover:scale-[1.04] ${
                isPlaying ? "animate-breathe-glow" : ""
              }`}
              style={{ transitionDuration: "var(--motion-base)", transitionTimingFunction: "var(--ease-cinema)" }}
              aria-label={isPlaying ? "Pause" : "Lecture"}
            >
              {isBuffering ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8 fill-current animate-scale-in" key="pause" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1 animate-scale-in" key="play" />
              )}
            </button>
            <button
              onClick={onNext}
              className="grid place-items-center w-12 h-12 rounded-full hover:bg-white/10 transition-all"
              style={{ transitionDuration: "var(--motion-fast)" }}
              aria-label="Suivant"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
            <button
              onClick={onRepeat}
              className={`grid place-items-center w-11 h-11 rounded-full transition-all hover:bg-white/5 ${
                repeat !== "off" ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ transitionDuration: "var(--motion-fast)" }}
              aria-label="Répéter"
            >
              {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          {/* Lyrics placeholder — minimal, premium silence rather than fake content */}
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Paroles</p>
            <p className="text-sm text-muted-foreground/70 italic leading-relaxed">
              Perdu dans la musique. Les paroles synchronisées arrivent bientôt.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full max-w-sm mx-auto">
            <button
              onClick={onMute}
              className="text-muted-foreground hover:text-foreground transition-colors"
              style={{ transitionDuration: "var(--motion-fast)" }}
              aria-label="Muet"
            >
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="flex-1 accent-violet-500"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueDrawer({ onClose }: { onClose: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const items = useMemo(() => queue, [queue]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:w-[420px] h-full bg-background border-l border-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-display text-lg font-extrabold">File d'attente</h3>
            <p className="text-xs text-muted-foreground">{items.length} piste{items.length > 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">La file d'attente est vide.</p>
          ) : items.map((t, i) => (
            <button
              key={t.id + i}
              onClick={() => playQueue(items, i)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${i === index ? "bg-surface" : "hover:bg-surface/60"}`}
            >
              <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-surface">
                {t.cover_url ? <img src={t.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary to-accent-cyan" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${i === index ? "text-primary-glow" : ""}`}>{t.title}</p>
                <p className="text-xs text-muted-foreground truncate">{t.artist_name}</p>
              </div>
              {i === index && <Play className="w-4 h-4 text-primary-glow fill-current" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
