import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchTopArtists } from "@/lib/tracks-data";
import { Award, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — VinaSound" },
      { name: "description", content: "Les artistes les plus écoutés sur VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Community" accent="Hall of" title="Fame" description="Les artistes qui font vivre la plateforme." />
      <FameList />
    </AuthGate>
  ),
});

function FameList() {
  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["fame-artists"],
    queryFn: () => fetchTopArtists(30),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (artists.length === 0) return <EmptyState title="Aucun artiste" hint="Les artistes apparaîtront ici." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {artists.map((a, i) => (
        <Link
          key={a.id}
          to="/artists/$slug"
          params={{ slug: a.slug }}
          className="flex items-center gap-4 p-4 rounded-md bg-surface/40 border border-border hover:border-primary transition"
        >
          {a.avatar_url ? (
            <img src={a.avatar_url} alt={a.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradientFor(a.name)} grid place-items-center font-display text-xl font-extrabold text-white`}>
              #{i + 1}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate inline-flex items-center gap-1">
              {a.name} {a.verified && <BadgeCheck className="w-4 h-4 text-primary" />}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{(a.monthly_listeners ?? 0).toLocaleString()} auditeurs/mois</p>
          </div>
          <Award className="w-5 h-5 text-primary" />
        </Link>
      ))}
    </div>
  );
}
