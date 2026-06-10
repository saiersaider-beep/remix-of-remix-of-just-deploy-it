import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchGenreCounts } from "@/lib/albums-data";

export const Route = createFileRoute("/genres")({
  head: () => ({
    meta: [
      { title: "Genres — VinaSound" },
      { name: "description", content: "Explore music by genre." },
    ],
  }),
  component: GenresPage,
});

function GenresPage() {
  const { data: genres = [], isLoading } = useQuery({
    queryKey: ["genre-counts"],
    queryFn: fetchGenreCounts,
  });

  return (
    <AuthGate>
      <PageHeader eyebrow="Browse Music" accent="Music" title="Genres" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : genres.length === 0 ? (
        <EmptyState title="Aucun genre disponible" hint="Les genres apparaîtront dès que des morceaux seront publiés." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {genres.map((g) => (
            <Link
              key={g.genre}
              to="/search"
              search={{ q: g.genre }}
              className={`relative h-28 rounded-md overflow-hidden bg-gradient-to-br ${gradientFor(g.genre)} p-5 flex flex-col justify-end shadow hover:scale-[1.02] transition`}
            >
              <span className="font-display text-xl font-extrabold text-white drop-shadow">{g.genre}</span>
              <span className="text-xs text-white/80 font-semibold">{g.count} morceau{g.count > 1 ? "x" : ""}</span>
            </Link>
          ))}
        </div>
      )}
    </AuthGate>
  );
}
