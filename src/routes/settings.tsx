import { createFileRoute } from "@tanstack/react-router";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Paramètres — VinaSound" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  return (
    <AuthGate>
      <main className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader eyebrow="Compte" accent="Mes" title="paramètres" description="Profil, sécurité, notifications et confidentialité." />

        <section className="bg-surface/40 border border-border rounded-md p-6 mb-6">
          <h2 className="font-display text-lg font-extrabold uppercase mb-4">Profil</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email" defaultValue={user?.email ?? ""} readOnly />
            <Field label="Nom d'affichage" />
            <Field label="Nom d'utilisateur" />
            <Field label="Pays" />
          </div>
        </section>

        <section className="bg-surface/40 border border-border rounded-md p-6 mb-6">
          <h2 className="font-display text-lg font-extrabold uppercase mb-4">Sécurité</h2>
          <Field label="Nouveau mot de passe" type="password" />
          <div className="mt-4">
            <Field label="Confirmation" type="password" />
          </div>
        </section>

        <section className="bg-surface/40 border border-border rounded-md p-6 mb-6">
          <h2 className="font-display text-lg font-extrabold uppercase mb-4">Notifications</h2>
          <Toggle label="Recevoir les emails de nouveautés" />
          <Toggle label="Notification quand un fan m'achète un morceau" />
          <Toggle label="Notification d'événements à proximité" />
        </section>

        <button className="bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold hover:opacity-90">
          Enregistrer
        </button>
      </main>
    </AuthGate>
  );
}

function Field({ label, type = "text", defaultValue, readOnly }: { label: string; type?: string; defaultValue?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</label>
      <input type={type} defaultValue={defaultValue} readOnly={readOnly} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60" />
    </div>
  );
}

function Toggle({ label }: { label: string }) {
  return (
    <label className="flex items-center justify-between py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-9 appearance-none rounded-full bg-muted checked:bg-primary transition cursor-pointer" />
    </label>
  );
}
