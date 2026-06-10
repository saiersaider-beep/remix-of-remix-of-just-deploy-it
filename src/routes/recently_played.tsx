import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchRecentlyPlayed } from "@/lib/listening-history";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";
import { Play } from "lucide-react";

export const Route = createFileRoute("/recently_played")({
  head: () => ({
    meta: [
      { title: "Recently Played — VinaSound" },
      { name: "description", content: "Ton historique d'écoute récent." },
    ],
  }),
  component: RecentlyPlayedPage,
});

function RecentlyPlayedPage() {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["recently-played"],
    queryFn: () => fetchRecentlyPlayed(40),
  });
  const playQueue = usePlayerStore((s) => s.playQueue);
  const current = usePlayerStore(currentTrackSelector);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <AuthGate>
      <PageHeader eyebrow="Your Music" accent="Recently" title="Played" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : tracks.length === 0 ? (
        <EmptyState title="Pas encore d'historique" hint="Les morceaux que tu écoutes apparaîtront ici." />
      ) : (
        <ul className="divide-y divide-border bg-surface/40 border border-border rounded-md">
          {tracks.map((t, i) => {
            const isCurrent = current?.id === t.id;
            return (
              <li key={`${t.id}-${t.played_at}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition group">
                <button
                  onClick={() => playQueue(tracks as any, i)}
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition"
                  aria-label="Lire"
                >
                  {isCurrent && isPlaying ? (
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-full bg-current animate-pulse" />
                      <span className="w-0.5 h-2 bg-current animate-pulse" />
                      <span className="w-0.5 h-full bg-current animate-pulse" />
                    </span>
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                {t.cover_url ? (
                  <img src={t.cover_url} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
                ) : (
                  <div className={`w-10 h-10 rounded bg-gradient-to-br ${gradientFor(t.title)} shrink-0`} />
                )}
                <Link to="/tracks/$slug" params={{ slug: t.slug }} className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate group-hover:text-primary transition">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.artist_name}</p>
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(t.played_at).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AuthGate>
  );
}
