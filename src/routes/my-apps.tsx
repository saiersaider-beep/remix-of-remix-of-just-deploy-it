import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/my-apps")({
  head: () => ({ meta: [{ title: "Mes apps — VinaSound" }] }),
  component: () => (
    <AuthGate>
      <main className="p-6 lg:p-10 max-w-5xl mx-auto">
        <PageHeader
          eyebrow="Développeur"
          accent="Mes"
          title="applications"
          description="Apps OAuth utilisant l'API VinaSound."
          actions={
            <Link to="/developers" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-bold hover:opacity-90">
              <Plus className="w-4 h-4" /> Nouvelle app
            </Link>
          }
        />
        <EmptyState title="Aucune application" hint="Crée ta première app pour obtenir un client ID et un secret OAuth." />
      </main>
    </AuthGate>
  ),
});
