import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { RealTrackGrid } from "@/components/RealTrackCard";
import { fetchMyPurchasedTracks } from "@/lib/tracks-data";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/purchased")({
  head: () => ({
    meta: [
      { title: "Achats — VinaSound" },
      { name: "description", content: "Les chansons que tu as achetées." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Store" accent="Mes" title="Achats" description="Les chansons que tu possèdes." />
      <PurchasedGrid />
    </AuthGate>
  ),
});

function PurchasedGrid() {
  const { user } = useAuth();
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["my-purchased", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyPurchasedTracks(user!.id),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (tracks.length === 0)
    return <EmptyState title="Aucun achat pour le moment" hint="Les chansons que tu achètes apparaîtront ici." />;
  const ownedIds = new Set(tracks.map((t) => t.id));
  return <RealTrackGrid tracks={tracks} ownedIds={ownedIds} />;
}
