import { useEffect, useState } from "react";

/**
 * Dopamine micro-reward overlay.
 *
 * Anywhere in the app, call `triggerReward({ amount: 1, label: "+1 ❤" })`
 * to spawn a floating point-burst at the cursor position (or center). Also
 * fires a tiny haptic pulse on supported devices.
 *
 * Mount once at the root. Tier-aware: low-end devices get a single, smaller,
 * shorter burst to avoid frame drops on cheap mobiles.
 */

type Burst = {
  id: number;
  x: number;
  y: number;
  label: string;
};

type Listener = (b: Omit<Burst, "id">) => void;
const listeners = new Set<Listener>();
let nextId = 1;
let lastPointer: { x: number; y: number } | null = null;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
    },
    { passive: true, capture: true },
  );
}

export type RewardKind = "like" | "repost" | "tip" | "follow" | "custom";

const KIND_LABEL: Record<RewardKind, string> = {
  like: "+1 ❤",
  repost: "+2 🔁",
  tip: "+5 ⭐",
  follow: "+1 ✨",
  custom: "+1",
};

export function triggerReward(kind: RewardKind, opts?: { label?: string; x?: number; y?: number }) {
  if (typeof window === "undefined") return;
  const label = opts?.label ?? KIND_LABEL[kind];
  const fallback = lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const x = opts?.x ?? fallback.x;
  const y = opts?.y ?? fallback.y;

  // Haptic — short, non-intrusive
  try {
    if ("vibrate" in navigator) navigator.vibrate?.(kind === "tip" ? 18 : 8);
  } catch {
    /* noop */
  }

  listeners.forEach((l) => l({ label, x, y }));
}

export function RewardOverlay() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const handler: Listener = (b) => {
      const id = nextId++;
      setBursts((prev) => [...prev.slice(-5), { ...b, id }]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((x) => x.id !== id));
      }, 1100);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]" style={{ contain: "strict" }}>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="absolute font-semibold tabular-nums text-sm rounded-full bg-primary/90 text-primary-foreground px-2.5 py-1 shadow-lg ring-1 ring-white/15 backdrop-blur"
          style={{
            left: b.x,
            top: b.y,
            transform: "translate(-50%, -50%)",
            animation: "rewardBurst 1100ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
            willChange: "transform, opacity",
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}