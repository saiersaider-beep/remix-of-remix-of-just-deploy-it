import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { getMyFavouriteTracks } from "@/lib/track-social";
import { fmtDuration } from "@/lib/artist-helpers";

export const Route = createFileRoute("/favourites")({
  head: () => ({
    meta: [
      { title: "Favourites — VinaSound" },
      { name: "description", content: "Songs you've liked." },
    ],
  }),
  component: FavouritesPage,
});

function FavouritesPage() {
  const { user } = useAuth();
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["favourites", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyFavouriteTracks(user!.id),
  });

  return (
    <AuthGate>
      <PageHeader eyebrow="Your Music" accent="Your" title="Favoris" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des favoris…</p>
      ) : tracks.length === 0 ? (
        <EmptyState title="No favourites yet" hint="Tap the heart on any song to save it here." />
      ) : (
        <ul className="divide-y divide-border bg-surface/40 border border-border rounded-md">
          {tracks.map((track) => (
            <li key={track.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition group">
              <div className="w-12 h-12 rounded-md overflow-hidden bg-surface border border-border shrink-0">
                {track.cover_url ? <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <Link to="/tracks/$slug" params={{ slug: track.slug }} className="font-bold text-sm truncate group-hover:text-primary transition block">
                  {track.title}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{track.artist_name} · {track.plays} lectures · {track.likes} likes</p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{fmtDuration(track.duration_seconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </AuthGate>
  );
}
