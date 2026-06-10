import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Code2, Key, Webhook } from "lucide-react";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Développeurs — VinaSound" },
      { name: "description", content: "Crée des applications avec l'API VinaSound." },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Plateforme</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
          <span className="text-primary">Développeurs,</span> connectez-vous à VinaSound
        </h1>
        <p className="text-muted-foreground max-w-2xl mb-12">
          API REST, OAuth 2.0, webhooks, SDKs. Construisez des apps qui utilisent le catalogue, l'authentification et les paiements VinaSound.
        </p>

        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <Card icon={Code2} title="API REST" desc="Endpoints typés pour tracks, albums, artists, playlists." />
          <Card icon={Key} title="OAuth 2.0" desc="Auth utilisateur sécurisée avec scopes granulaires." />
          <Card icon={Webhook} title="Webhooks" desc="Événements en temps réel : achats, nouveaux fans, lectures." />
        </div>

        <div className="flex gap-3">
          <Link to="/login" className="bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold hover:opacity-90">
            Créer une app
          </Link>
          <a href="#" className="border border-border rounded-full px-6 py-3 font-bold hover:border-primary hover:text-primary">
            Lire la doc
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});

function Card({ icon: Icon, title, desc }: { icon: typeof Code2; title: string; desc: string }) {
  return (
    <div className="bg-surface/40 border border-border rounded-md p-6">
      <Icon className="w-6 h-6 text-primary mb-3" />
      <h3 className="font-display text-lg font-extrabold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{desc}</p>
    </div>
  );
}
