import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Mot de passe oublié — VinaSound" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Email envoyé. Vérifie ta boîte de réception.");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <BrandMark size={32} />
          <span className="font-display text-xl font-extrabold">VinaSound</span>
        </Link>
        <div className="bg-surface/40 border border-border rounded-md p-8">
          <h1 className="font-display text-2xl font-extrabold">Mot de passe oublié ?</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            On t'envoie un lien sécurisé pour réinitialiser ton mot de passe.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground rounded-full py-3 font-bold disabled:opacity-50 hover:opacity-90">
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
          <Link to="/login" className="block text-center text-xs text-muted-foreground hover:text-primary mt-6">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
