import { useState } from "react";
import { Smile, X } from "lucide-react";

interface Props {
  onSend: (emoji: string) => void;
}

const EMOJIS = ["🔥", "❤️", "🎧", "🙌", "✨", "💜", "🥁", "🎵", "🚀", "👏", "🌍", "😍"];

/**
 * Floating reaction palette anchored bottom-right of the track page.
 * Each tap broadcasts the emoji to every connected listener.
 */
export function ReactionPicker({ onSend }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-24 right-4 md:bottom-28 md:right-6 z-50">
      {open && (
        <div
          className="mb-3 grid grid-cols-4 gap-1.5 p-2.5 rounded-2xl glass border border-white/10 backdrop-blur-2xl shadow-2xl"
          style={{ animation: "scale-in 180ms cubic-bezier(0.22,0.61,0.36,1)" }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onSend(e)}
              className="w-10 h-10 grid place-items-center text-2xl rounded-xl hover:bg-white/15 hover:scale-125 active:scale-95 transition-transform"
              aria-label={`Réagir ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`grid place-items-center w-14 h-14 rounded-full text-white shadow-2xl transition-all hover:scale-110 active:scale-95 ${
          open
            ? "bg-white/15 backdrop-blur-xl border border-white/20"
            : "bg-gradient-to-br from-primary via-violet-500 to-accent-cyan shadow-glow-purple"
        }`}
        aria-label={open ? "Fermer les réactions" : "Envoyer une réaction"}
      >
        {open ? <X className="w-6 h-6" /> : <Smile className="w-6 h-6" />}
      </button>
    </div>
  );
}
