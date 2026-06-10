import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlayerTrack } from "@/lib/player";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  // Queue
  queue: PlayerTrack[];
  index: number;
  // Playback
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  // UI
  expanded: boolean;
  queueOpen: boolean;
  // Errors
  error: string | null;

  // Paywall
  paywallTrack: PlayerTrack | null;
  // map of trackId -> hasAccess (for paid tracks). undefined = not yet checked
  accessMap: Record<string, boolean>;
  // map of trackId -> max seconds allowed (1-minute pass). The player serves
  // the full audio but cuts off & re-opens the paywall at this position.
  minutePassMap: Record<string, number>;

  // Actions
  openPaywall: (track: PlayerTrack) => void;
  closePaywall: () => void;
  setAccess: (trackId: string, hasAccess: boolean) => void;
  setMinutePass: (trackId: string, seconds: number) => void;
  playTrack: (track: PlayerTrack) => void;
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  enqueue: (track: PlayerTrack) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setExpanded: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  // Internal — engine wiring
  _setPosition: (s: number) => void;
  _setDuration: (s: number) => void;
  _setBuffering: (v: boolean) => void;
  _setError: (e: string | null) => void;
  _onEnded: () => void;
  _seekRequest: number | null;
  _consumeSeek: () => number | null;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 0,
      volume: 0.9,
      muted: false,
      repeat: "off",
      shuffle: false,
      expanded: false,
      queueOpen: false,
      error: null,
      paywallTrack: null,
      accessMap: {},
      minutePassMap: {},
      _seekRequest: null,

      openPaywall: (track) => set({ paywallTrack: track, isPlaying: false }),
      closePaywall: () => set({ paywallTrack: null }),
      setAccess: (trackId, hasAccess) =>
        set((s) => ({ accessMap: { ...s.accessMap, [trackId]: hasAccess } })),
      setMinutePass: (trackId, seconds) =>
        set((s) => ({ minutePassMap: { ...s.minutePassMap, [trackId]: seconds } })),

      playTrack: (track) => {
        const { queue, index } = get();
        // If track already in queue, jump to it
        const existing = queue.findIndex((t) => t.id === track.id);
        if (existing >= 0) {
          // Always restart from 0 and force the engine to seek — otherwise
          // tapping "Lire" on a track already loaded resumes from its last
          // position (a common "music doesn't start" complaint).
          set({
            index: existing,
            isPlaying: true,
            position: 0,
            error: null,
            isBuffering: false,
            _seekRequest: 0,
          });
          return;
        }
        // Insert after current and play
        const insertAt = index >= 0 ? index + 1 : queue.length;
        const next = [...queue.slice(0, insertAt), track, ...queue.slice(insertAt)];
        set({
          queue: next,
          index: insertAt,
          isPlaying: true,
          position: 0,
          error: null,
          isBuffering: false,
        });
      },

      playQueue: (tracks, startIndex = 0) => {
        if (tracks.length === 0) return;
        const i = Math.max(0, Math.min(startIndex, tracks.length - 1));
        set({ queue: tracks, index: i, isPlaying: true, position: 0, error: null });
      },

      enqueue: (track) => {
        const { queue } = get();
        if (queue.some((t) => t.id === track.id)) return;
        set({ queue: [...queue, track] });
      },

      toggle: () => {
        const { isPlaying, queue, index } = get();
        if (queue.length === 0 || index < 0) return;
        set({ isPlaying: !isPlaying, error: null });
      },
      setPlaying: (v) => {
        const { queue, index } = get();
        if (v && (queue.length === 0 || index < 0)) return;
        set({ isPlaying: v, error: v ? null : get().error });
      },

      next: () => {
        const { queue, index, shuffle, repeat } = get();
        if (queue.length === 0) return;
        let nextIndex: number;
        if (shuffle) {
          if (queue.length === 1) nextIndex = 0;
          else {
            do {
              nextIndex = Math.floor(Math.random() * queue.length);
            } while (nextIndex === index);
          }
        } else {
          nextIndex = index + 1;
          if (nextIndex >= queue.length) {
            if (repeat === "all") nextIndex = 0;
            else {
              set({ isPlaying: false, position: 0 });
              return;
            }
          }
        }
        set({ index: nextIndex, isPlaying: true, position: 0, error: null });
      },

      prev: () => {
        const { queue, index, position } = get();
        if (queue.length === 0) return;
        // If >3s in, restart current
        if (position > 3) {
          set({ _seekRequest: 0, position: 0 });
          return;
        }
        const prevIndex = index - 1 < 0 ? queue.length - 1 : index - 1;
        set({ index: prevIndex, isPlaying: true, position: 0, error: null });
      },

      seek: (s) => set({ _seekRequest: s, position: s }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: false }),
      toggleMute: () => set({ muted: !get().muted }),
      toggleShuffle: () => set({ shuffle: !get().shuffle }),
      cycleRepeat: () => {
        const order: RepeatMode[] = ["off", "all", "one"];
        const cur = get().repeat;
        set({ repeat: order[(order.indexOf(cur) + 1) % order.length] });
      },
      setExpanded: (v) => set({ expanded: v }),
      setQueueOpen: (v) => set({ queueOpen: v }),

      _setPosition: (s) => set({ position: s }),
      _setDuration: (s) => set({ duration: s }),
      _setBuffering: (v) => set({ isBuffering: v }),
      _setError: (e) => set({ error: e, isPlaying: e ? false : get().isPlaying, isBuffering: e ? false : get().isBuffering }),
      _onEnded: () => {
        const { repeat } = get();
        if (repeat === "one") {
          set({ _seekRequest: 0, position: 0, isPlaying: true });
          return;
        }
        get().next();
      },
      _consumeSeek: () => {
        const r = get()._seekRequest;
        if (r !== null) set({ _seekRequest: null });
        return r;
      },
    }),
    {
      name: "vinasound-player",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        position: s.position,
        volume: s.volume,
        muted: s.muted,
        repeat: s.repeat,
        shuffle: s.shuffle,
      }),
      // Never auto-resume on load
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isPlaying = false;
          state.isBuffering = false;
        }
      },
    },
  ),
);

export const currentTrack = (s: PlayerState) =>
  s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;
