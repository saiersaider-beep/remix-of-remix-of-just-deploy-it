import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { Music, Disc3 } from "lucide-react";

export const Route = createFileRoute("/upload-song")({
  head: () => ({
    meta: [
      { title: "Upload Song — VinaSound" },
      { name: "description", content: "Choose how you'd like to upload your music." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Publier" accent="Share Your" title="Music" />
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <Link to="/upload-single" className="group p-8 rounded-md border border-border bg-surface/40 hover:border-primary transition">
          <Music className="w-10 h-10 text-primary" />
          <h2 className="font-display text-2xl font-extrabold mt-4">Publier un titre</h2>
          <p className="text-sm text-muted-foreground mt-2">Publie un titre à la fois avec un contrôle complet des métadonnées.</p>
        </Link>
        <Link to="/upload-album" className="group p-8 rounded-md border border-border bg-surface/40 hover:border-primary transition">
          <Disc3 className="w-10 h-10 text-primary" />
          <h2 className="font-display text-2xl font-extrabold mt-4">Publier un album</h2>
          <p className="text-sm text-muted-foreground mt-2">Bundle multiple tracks together as an album release.</p>
        </Link>
      </div>
    </AuthGate>
  ),
});
