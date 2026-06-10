import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface GoogleAuthButtonProps {
  label?: string;
}

export function GoogleAuthButton({ label = "Continuer avec Google" }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/discover`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message || "Échec de la connexion Google");
      return;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-3 rounded-xl py-3.5 px-4 font-semibold text-[15px] bg-white text-[#1f1f1f] hover:bg-gray-50 border border-black/10 shadow-sm transition disabled:opacity-60"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      {loading ? "Connexion…" : label}
    </button>
  );
}
