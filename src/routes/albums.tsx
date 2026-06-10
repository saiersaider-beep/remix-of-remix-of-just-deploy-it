import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchAlbums } from "@/lib/albums-data";
import { Disc3 } from "lucide-react";

export const Route = createFileRoute("/albums")({
  head: () => ({
    meta: [
      { title: "Albums — VinaSound" },
      { name: "description", content: "Browse complete albums from your favourite artists." },
    ],
  }),
  component: AlbumsPage,
});

function AlbumsPage() {
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums-discover"],
    queryFn: () => fetchAlbums({ limit: 48 }),
  });

  return (
    <AuthGate>
      <PageHeader eyebrow="Browse Music" accent="Featured" title="Albums" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : albums.length === 0 ? (
        <EmptyState
          title="Aucun album publié"
          hint="Les albums publiés par les artistes apparaîtront ici."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {albums.map((a, i) => (
            <Link
              key={a.id}
              to="/albums/$slug"
              params={{ slug: a.slug }}
              className="group min-w-0"
            >
              <div className={`relative aspect-square rounded-md overflow-hidden bg-gradient-to-br ${gradientFor(i + a.title)} shadow-md`}>
                {a.cover_url ? (
                  <img src={a.cover_url} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-white/70">
                    <Disc3 className="w-12 h-12" />
                  </div>
                )}
              </div>
              <p className="mt-3 font-bold text-sm truncate group-hover:text-primary transition">{a.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {a.artist_name} · {a.track_count} morceau{a.track_count > 1 ? "x" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AuthGate>
  );
}
