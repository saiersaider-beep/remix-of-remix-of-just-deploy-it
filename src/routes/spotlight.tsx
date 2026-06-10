import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { RealTrackGrid } from "@/components/RealTrackCard";
import { fetchTracks, fetchMyAccessIds } from "@/lib/tracks-data";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/spotlight")({
  head: () => ({
    meta: [
      { title: "Spotlight — VinaSound" },
      { name: "description", content: "Les morceaux qui montent sur VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Curated" accent="In the" title="Spotlight" description="Les morceaux qui buzz et qui méritent ton attention." />
      <SpotlightGrid />
    </AuthGate>
  ),
});

function SpotlightGrid() {
  const { user } = useAuth();
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["spotlight"],
    queryFn: () => fetchTracks({ order: "trending", limit: 20 }),
  });
  const { data: ownedIds } = useQuery({
    queryKey: ["my-access", user?.id],
    enabled: !!user?.id,
    queryFn: fetchMyAccessIds,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (tracks.length === 0) return <EmptyState title="Pas encore de spotlight" hint="Les morceaux qui buzz apparaîtront ici." />;
  return <RealTrackGrid tracks={tracks} ownedIds={ownedIds} />;
}
