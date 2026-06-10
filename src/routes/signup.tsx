import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Lock,
  ListMusic,
  Share2,
  Heart,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { BrandMark } from "@/components/BrandMark";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Signup — VinaSound" },
      {
        name: "description",
        content: "Crée ton compte VinaSound pour accéder à la musique, aux playlists et plus.",
      },
    ],
  }),
});

function SignupPage() {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first: "", last: "", email: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (session) navigate({ to: "/discover" });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setSubmitting(true);
    const { error } = await signUp(form.email, form.password, {
      first_name: form.first,
      last_name: form.last,
    });
    setSubmitting(false);
    if (error) return toast.error(error);
    toast.success("Compte créé ! Bienvenue sur VinaSound.");
    navigate({ to: "/discover" });
  };

  return (
    <div className="auth-page relative min-h-screen text-white">
      <style>{`html,body,#root,.mobile-frame,.gs-page,.auth-route-page{background:#000!important;background-color:#000!important;color:#fff!important;color-scheme:dark!important}`}</style>
      <div aria-hidden className="auth-page-backdrop fixed inset-0 pointer-events-none" />

      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        aria-label="Fermer"
        className="auth-close-button fixed top-3 right-3 sm:top-4 sm:right-4 z-50 grid place-items-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 min-h-screen flex items-start sm:items-center justify-center p-3 sm:p-6 py-6 sm:py-8">
        <div
          className="auth-modal-shell relative w-full max-w-5xl rounded-3xl bg-black text-white grid lg:grid-cols-2 shadow-2xl border border-white/10 overflow-hidden"
        >
          {/* Left — form */}
          <div className="flex flex-col items-center justify-center px-5 sm:px-10 py-7 sm:py-8 lg:py-12">
            <div className="w-full max-w-md">
              <Link to="/" className="flex items-center justify-center gap-3 mb-5 sm:mb-7">
                <BrandMark size={48} className="shrink-0" />
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="text-primary">Vina</span>
                  <span className="text-white">Sound</span>
                </span>
              </Link>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-center">Inscription</h1>
              <p className="mt-3 text-center text-sm sm:text-base text-white/60">
                Crée ton compte pour accéder à ta musique, tes playlists et plus
              </p>

              <div className="mt-5 sm:mt-7 space-y-3">
                <GoogleAuthButton label="S'inscrire avec Google" />
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/40">
                  <span className="flex-1 h-px bg-white/10" />
                  ou
                  <span className="flex-1 h-px bg-white/10" />
                </div>
              </div>

              <form className="mt-4 space-y-3.5" onSubmit={onSubmit} noValidate>
                <Field
                  icon={User}
                  label="Prénom"
                  placeholder="Entrez votre prénom"
                  value={form.first}
                  onChange={set("first")}
                  required
                />
                <Field
                  icon={User}
                  label="Nom"
                  placeholder="Entrez votre nom"
                  value={form.last}
                  onChange={set("last")}
                  required
                />
                <Field
                  icon={Mail}
                  label="Adresse email"
                  type="email"
                  placeholder="Entrez votre adresse email"
                  value={form.email}
                  onChange={set("email")}
                  required
                />
                <Field
                  icon={Lock}
                  label="Mot de passe"
                  type="password"
                  placeholder="Créez un mot de passe"
                  value={form.password}
                  onChange={set("password")}
                  required
                />
                <Field
                  icon={Lock}
                  label="Confirmation"
                  type="password"
                  placeholder="Confirmez votre mot de passe"
                  value={form.confirm}
                  onChange={set("confirm")}
                  required
                />

                <p className="text-sm text-white/70 pt-2">
                  En t'inscrivant, tu acceptes nos{" "}
                  <a href="#" className="text-primary font-semibold">
                    Conditions
                  </a>{" "}
                  et notre{" "}
                  <a href="#" className="text-primary font-semibold">
                    Politique de confidentialité
                  </a>
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl py-4 font-bold text-white text-lg bg-primary hover:bg-primary/90 transition disabled:opacity-60 mt-2"
                >
                  {submitting ? "Création du compte…" : "S'inscrire"}
                </button>

                <p className="text-center text-sm text-white/70 pt-4">
                  Tu as déjà un compte ?{" "}
                  <Link to="/login" className="font-bold text-primary hover:text-primary/80">
                    Connexion
                  </Link>
                </p>

              </form>
            </div>
          </div>

          {/* Right — visual */}
          <div className="relative hidden lg:block overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80"
              alt="Singer performing"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-pink-600/50 via-purple-700/40 to-black/70 mix-blend-multiply" />

            <div className="relative h-full flex flex-col justify-between p-12 text-white">
              <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight max-w-md drop-shadow-lg">
                Plus de 30 millions de titres pour toutes tes humeurs &amp; occasions
              </h2>

              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: ListMusic, label: "Crée ta propre\nplaylist" },
                  { icon: Share2, label: "Partage la musique\navec tes proches" },
                  { icon: Heart, label: "Sauvegarde tes\nfavoris" },

                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <span className="grid place-items-center w-14 h-14 rounded-2xl border border-white/30">
                      <Icon className="w-6 h-6 text-white" />
                    </span>
                    <span className="whitespace-pre-line text-sm text-white font-medium leading-snug">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
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
    <label className="block space-y-1.5">
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
