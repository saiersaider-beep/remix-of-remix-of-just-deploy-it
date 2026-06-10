import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchTracks, fetchMyAccessIds, formatPlays } from "@/lib/tracks-data";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { Lock, Play, Sparkles } from "lucide-react";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";

export const Route = createFileRoute("/top_music")({
  head: () => ({
    meta: [
      { title: "Top Music — VinaSound" },
      { name: "description", content: "Les morceaux les plus écoutés sur VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <PageHeader eyebrow="Browse Music" accent="Top" title="Music" description="Les morceaux les plus écoutés en ce moment." />
      <TopMusicList />
    </AuthGate>
  ),
});

function TopMusicList() {
  const { user } = useAuth();
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["top-music"],
    queryFn: () => fetchTracks({ order: "popular", limit: 50 }),
  });
  const { data: ownedIds } = useQuery({
    queryKey: ["my-access", user?.id],
    enabled: !!user?.id,
    queryFn: fetchMyAccessIds,
  });
  const playQueue = usePlayerStore((s) => s.playQueue);
  const current = usePlayerStore(currentTrackSelector);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (tracks.length === 0) return <EmptyState title="Aucun morceau publié" hint="Les chansons les plus écoutées apparaîtront ici." />;

  return (
    <ul className="divide-y divide-border bg-surface/40 border border-border rounded-md">
      {tracks.map((row, i) => {
        const isCurrent = current?.id === row.id;
        const isPaid = row.pricing_model === "paid";
        const owned = ownedIds?.has(row.id);
        return (
          <li key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition group">
            <button
              onClick={() => playQueue(tracks, i)}
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
            <span className="font-display text-lg font-extrabold text-muted-foreground w-6 tabular-nums">{i + 1}</span>
            {row.cover_url ? (
              <img src={row.cover_url} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
            ) : (
              <div className={`w-10 h-10 rounded bg-gradient-to-br ${gradientFor(row.title)} shrink-0`} />
            )}
            <Link to="/tracks/$slug" params={{ slug: row.slug }} className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate group-hover:text-primary transition">{row.title}</p>
              <p className="text-xs text-muted-foreground truncate">{row.artist_name}</p>
            </Link>
            <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${isPaid ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>
              {isPaid ? <Lock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {isPaid ? (owned ? "ACHETÉ" : "PAYANT") : "GRATUIT"}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{formatPlays(row.plays)}</span>
          </li>
        );
      })}
    </ul>
  );
}
