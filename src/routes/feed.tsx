import { createFileRoute } from "@tanstack/react-router";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Mon feed — VinaSound" }] }),
  component: () => (
    <AuthGate>
      <main className="p-6 lg:p-10 max-w-4xl mx-auto">
        <PageHeader eyebrow="Activité" accent="Mon" title="feed" description="Sorties, posts et activité des artistes que tu suis." />
        <EmptyState title="Ton feed est vide" hint="Suis des artistes pour voir leur activité ici." />
      </main>
    </AuthGate>
  ),
});
