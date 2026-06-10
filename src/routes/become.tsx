import { createFileRoute } from "@tanstack/react-router";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { Check, Mic2 } from "lucide-react";

export const Route = createFileRoute("/become")({
  head: () => ({ meta: [{ title: "Devenir artiste — VinaSound" }] }),
  component: BecomeArtistPage,
});

function BecomeArtistPage() {
  return (
    <AuthGate>
      <main className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader eyebrow="Postuler" accent="Devenir" title="un artiste VinaSound" description="Soumets ton dossier pour obtenir le badge artiste et publier ta musique." />

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {["Vends ta musique", "Reçois des paiements", "Page profil dédiée", "Statistiques détaillées"].map((p) => (
            <div key={p} className="flex items-center gap-3 bg-surface/40 border border-border rounded-md p-4 text-sm">
              <Check className="w-4 h-4 text-primary" /> {p}
            </div>
          ))}
        </div>

        <form className="space-y-5 bg-surface/40 border border-border rounded-md p-6">
          <h2 className="font-display text-xl font-extrabold uppercase flex items-center gap-2"><Mic2 className="w-5 h-5 text-primary" /> Ta candidature</h2>
          <Field label="Nom d'artiste" name="stage_name" />
          <Field label="Genre principal" name="genre" />
          <Field label="Lien Instagram / SoundCloud" name="social" />
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Présente-toi en quelques lignes</label>
            <textarea rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="button" className="bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold hover:opacity-90">
            Envoyer ma candidature
          </button>
        </form>
      </main>
    </AuthGate>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</label>
      <input id={name} name={name} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );
}
