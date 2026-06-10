import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchPublicPlaylists } from "@/lib/albums-data";
import { Music2, Plus } from "lucide-react";

export const Route = createFileRoute("/playlists")({
  head: () => ({
    meta: [
      { title: "Playlists — VinaSound" },
      { name: "description", content: "Discover community-made and curated playlists." },
    ],
  }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["public-playlists"],
    queryFn: () => fetchPublicPlaylists({ limit: 48 }),
  });

  return (
    <AuthGate>
      <PageHeader
        eyebrow="Browse Music"
        accent="Public"
        title="Playlists"
        actions={
          <Link to="/my_playlists" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-bold">
            <Plus className="w-4 h-4" /> Créer une playlist
          </Link>
        }
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : playlists.length === 0 ? (
        <EmptyState
          title="Aucune playlist publique"
          hint="Crée la tienne et active l'option « Publique » pour la partager ici."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {playlists.map((p, i) => (
            <Link key={p.id} to="/playlists/$slug" params={{ slug: p.slug }} className="group min-w-0">
              <div className={`relative aspect-square rounded-md overflow-hidden bg-gradient-to-br ${gradientFor(i + p.title)} grid place-items-center shadow-md`}>
                <Music2 className="w-12 h-12 text-white/80" />
              </div>
              <p className="mt-3 font-bold text-sm truncate group-hover:text-primary transition">{p.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.owner_name} · {p.track_count} morceau{p.track_count > 1 ? "x" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AuthGate>
  );
}
