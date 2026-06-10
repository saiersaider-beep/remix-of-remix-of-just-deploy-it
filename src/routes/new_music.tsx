import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { RealTrackGrid } from "@/components/RealTrackCard";
import { fetchTracks, fetchMyAccessIds } from "@/lib/tracks-data";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/new_music")({
  head: () => ({
    meta: [
      { title: "New Music — VinaSound" },
      { name: "description", content: "Les dernières chansons publiées sur VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Browse Music" accent="Nouveau" title="Music" description="Les nouveautés publiées par les artistes." />
      <NewMusicGrid />
    </AuthGate>
  ),
});

function NewMusicGrid() {
  const { user } = useAuth();
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["new-music"],
    queryFn: () => fetchTracks({ order: "newest", limit: 30 }),
  });
  const { data: ownedIds } = useQuery({
    queryKey: ["my-access", user?.id],
    enabled: !!user?.id,
    queryFn: fetchMyAccessIds,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (tracks.length === 0) return <EmptyState title="Aucune sortie récente" hint="Les nouvelles chansons apparaîtront ici." />;
  return <RealTrackGrid tracks={tracks} ownedIds={ownedIds} />;
}
