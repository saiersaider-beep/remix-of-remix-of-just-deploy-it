// iPhone-style "message sent" sound, played on user action.
// Uses a real MP3 served from /sounds/message-sent.mp3.

const SRC = "/sounds/message-sent.mp3";
let pool: HTMLAudioElement[] = [];
let idx = 0;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (pool.length === 0) {
    for (let i = 0; i < 3; i++) {
      const a = new Audio(SRC);
      a.preload = "auto";
      a.volume = 0.9;
      pool.push(a);
    }
  }
  const a = pool[idx];
  idx = (idx + 1) % pool.length;
  return a;
}

export function playSendSound() {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
