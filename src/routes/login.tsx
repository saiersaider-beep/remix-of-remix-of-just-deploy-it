import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Mail, Lock, X, RefreshCw, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

async function resolvePostLoginPath(userId: string | undefined): Promise<"/admin" | "/discover"> {
  if (!userId) return "/discover";
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return data ? "/admin" : "/discover";
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Login — VinaSound" },
      { name: "description", content: "Sign in to VinaSound to access your music and playlists." },
    ],
  }),
});

function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  useEffect(() => {
    if (!session) return;
    resolvePostLoginPath(session.user?.id).then((to) => navigate({ to }));
  }, [session, navigate]);

  // Silent auto-seed on first visit so demo accounts exist after every remix.
  useEffect(() => {
    const KEY = "vinasound:demo-accounts-seeded";
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(KEY) === "1") return;
    fetch("/api/public/seed-test-accounts?token=vinasound-seed-2026")
      .then((r) => { if (r.ok) window.sessionStorage.setItem(KEY, "1"); })
      .catch(() => { /* silent */ });
  }, []);

  const reseedAccounts = async () => {
    setReseeding(true);
    try {
      const r = await fetch("/api/public/seed-test-accounts?token=vinasound-seed-2026", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      window.sessionStorage.setItem("vinasound:demo-accounts-seeded", "1");
      toast.success("Comptes de démo régénérés.");
    } catch {
      toast.error("Impossible de régénérer les comptes.");
    } finally {
      setReseeding(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim().toLowerCase(), password.trim());
    setSubmitting(false);
    if (error) return toast.error(error);
    toast.success("Bon retour !");
    const { data: { user } } = await supabase.auth.getUser();
    const to = await resolvePostLoginPath(user?.id);
    navigate({ to });
  };

  const close = () => navigate({ to: "/" });

  return (
    <div className="auth-page relative min-h-screen text-white bg-black">
      <div
        aria-hidden
        className="auth-page-backdrop fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, rgba(255,107,53,0.18), transparent 60%), radial-gradient(900px 500px at 85% 90%, rgba(255,107,53,0.12), transparent 60%), #000",
        }}
      />



      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="auth-close-button fixed top-3 right-3 sm:top-4 sm:right-4 z-50 grid place-items-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-3 sm:p-6">
        <div
          className="auth-modal-shell relative w-full max-w-5xl rounded-3xl bg-black text-white grid lg:grid-cols-2 shadow-2xl border border-white/10 overflow-hidden"
        >



          {/* Left — form */}
          <div className="flex flex-col items-center justify-center px-5 sm:px-10 py-8 lg:py-14">
            <div className="w-full max-w-md">
              <Link to="/" className="flex items-center justify-center gap-3 mb-6 lg:mb-10">
                <BrandMark size={48} className="shrink-0" />
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="text-primary">Vina</span>
                  <span className="text-white">Sound</span>
                </span>
              </Link>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-center">Connexion</h1>
              <p className="mt-3 text-center text-sm sm:text-base text-white/60">
                Accède à ta musique, tes playlists et ton compte
              </p>

              <div className="mt-6 sm:mt-8 space-y-3">
                <GoogleAuthButton label="Se connecter avec Google" />
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/40">
                  <span className="flex-1 h-px bg-white/10" />
                  ou
                  <span className="flex-1 h-px bg-white/10" />
                </div>
              </div>

              <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>

                <Field
                  icon={Mail}
                  label="Adresse email"
                  type="text"
                  autoComplete="email"
                  placeholder="Entrez votre adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ""))}
                  required
                />
                <Field
                  icon={Lock}
                  label="Mot de passe"
                  type="password"
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="w-5 h-5 rounded-md bg-primary grid place-items-center">
                      {remember && (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M3 8l4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Se souvenir de cet appareil
                  </label>
                  <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:text-primary/80">
                    Mot de passe oublié ?
                  </Link>

                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl py-4 font-bold text-white text-lg bg-primary hover:bg-primary/90 transition disabled:opacity-60 mt-2"
                >
                  {submitting ? "Connexion…" : "Connexion"}
                </button>

                <p className="text-center text-sm text-white/70 pt-4">
                  Pas encore de compte ?{" "}
                  <Link to="/signup" className="font-bold text-primary hover:text-primary/80">
                    S'inscrire
                  </Link>
                </p>

              </form>

              {/* Discreet recovery: force-recreate demo accounts if creds appear broken */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={reseedAccounts}
                  disabled={reseeding}
                  className="inline-flex items-center gap-2 text-[11px] text-white/40 hover:text-white/70 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${reseeding ? "animate-spin" : ""}`} />
                  {reseeding ? "Régénération…" : "Recréer les comptes de démo"}
                </button>
              </div>
            </div>
          </div>

          {/* Right — visual */}
          <div className="relative hidden lg:block overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80"
              alt="Live concert"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-black/30 to-black/70 mix-blend-multiply" />
            <div className="absolute bottom-12 left-12 right-12">
              <h2 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg flex flex-col gap-3">
                <span>VIS TES JOURNÉES</span>
                <span className="flex items-center gap-3">
                  EN <span className="text-primary">MUSIQUE</span>
                  <BrandMark size={56} />
                </span>
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  placeholder,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon; label: string }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-white">{label}</span>
      <span className="relative block">
        <Icon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        <input
          {...props}
          placeholder={placeholder}
          aria-label={label}
          className="auth-field-control w-full rounded-full border border-white/10 bg-white/[0.03] pl-12 pr-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-primary/60 focus:bg-white/[0.05]"
        />
      </span>
    </label>
  );
}
