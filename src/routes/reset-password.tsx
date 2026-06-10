import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — VinaSound" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Mot de passe mis à jour.");
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <BrandMark size={32} />
          <span className="font-display text-xl font-extrabold">VinaSound</span>
        </Link>
        <div className="bg-surface/40 border border-border rounded-md p-8">
          <h1 className="font-display text-2xl font-extrabold">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Choisis un mot de passe fort, qu'on n'aura plus à réinitialiser.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <Pwd label="Nouveau mot de passe" value={password} onChange={setPassword} />
            <Pwd label="Confirmer" value={confirm} onChange={setConfirm} />
            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground rounded-full py-3 font-bold disabled:opacity-50 hover:opacity-90">
              {loading ? "Mise à jour..." : "Mettre à jour"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Pwd({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</label>
      <input
        type="password"
        required
        minLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
