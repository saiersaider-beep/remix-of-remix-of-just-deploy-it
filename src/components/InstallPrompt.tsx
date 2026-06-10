import { useEffect, useState } from "react";
import { Download, X, Share, Plus, Smartphone, Monitor } from "lucide-react";

const DISMISS_KEY = "vinasound-install-dismissed";
const SHOW_DELAY_MS = 2500;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * VINASOUND install modal — proposes to install the app on PC or phone.
 * - Chrome/Edge/Android: native beforeinstallprompt → click "Installer"
 * - iOS Safari: shows manual Share → Add to Home Screen instructions
 * - Hidden inside Lovable preview iframe to avoid breaking the editor.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.self !== window.top) return; // skip in iframe
    } catch {
      return;
    }
    // Already installed?
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    if ((window.navigator as unknown as { standalone?: boolean }).standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    setIsIOS(iOS);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires beforeinstallprompt → show manual modal after a short delay
    let t: ReturnType<typeof setTimeout> | undefined;
    if (iOS) t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!open) return null;

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setDeferred(null);
    setOpen(false);
  };

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Installer VINASOUND"
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-primary/30 shadow-2xl shadow-primary/20 p-6 text-white animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="grid place-items-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-amber-500 shadow-lg shadow-primary/40 p-2">
            <img src="/brand/logo.png" alt="VINASOUND" className="w-full h-full object-contain drop-shadow" />
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            Installer <span className="text-gradient-primary">VINASOUND</span>
          </h2>
          <p className="text-sm text-white/70">
            Ajoute VINASOUND à ton écran d'accueil ou ton bureau. Lancement rapide, plein écran, comme une vraie app.
          </p>

          <div className="flex items-center gap-4 text-xs text-white/60 mt-1">
            <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Mobile</span>
            <span className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> PC</span>
          </div>
        </div>

        {isIOS && !deferred ? (
          <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/85 space-y-2">
            <p className="font-semibold text-white">Sur iPhone / iPad :</p>
            <p className="flex items-center gap-2">
              1. Touche <Share className="w-4 h-4 inline text-primary" /> <span className="text-white/70">(Partager)</span>
            </p>
            <p className="flex items-center gap-2">
              2. Choisis <Plus className="w-4 h-4 inline text-primary" /> <span className="font-medium">Sur l'écran d'accueil</span>
            </p>
            <p>3. Confirme <span className="font-medium">Ajouter</span>.</p>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          {deferred ? (
            <button
              onClick={install}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-amber-500 text-white font-bold py-3 hover:scale-[1.02] active:scale-95 transition shadow-lg shadow-primary/30"
            >
              <Download className="w-4 h-4" /> Installer maintenant
            </button>
          ) : (
            !isIOS && (
              <p className="flex-1 text-center text-xs text-white/60 py-3">
                Ouvre ce site dans Chrome ou Edge pour activer l'installation en un clic.
              </p>
            )
          )}
          <button
            onClick={dismiss}
            className="px-4 rounded-full border border-white/20 text-sm text-white/80 hover:bg-white/10 transition"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
