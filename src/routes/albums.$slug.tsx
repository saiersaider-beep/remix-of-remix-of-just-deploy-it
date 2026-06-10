import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, EmptyState, gradientFor } from "@/components/PageScaffold";
import { fetchAlbumBySlug } from "@/lib/albums-data";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";
import { Play, Pause, Disc3 } from "lucide-react";

export const Route = createFileRoute("/albums/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Album — VinaSound` },
      { name: "description", content: `Album ${params.slug} on VinaSound.` },
    ],
  }),
  component: AlbumDetail,
});

function formatDuration(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function AlbumDetail() {
  const { slug } = Route.useParams();
  const { data: album, isLoading } = useQuery({
    queryKey: ["album", slug],
    queryFn: () => fetchAlbumBySlug(slug),
  });
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.toggle);
  const current = usePlayerStore(currentTrackSelector);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  if (isLoading) return <AuthGate><p className="text-sm text-muted-foreground">Chargement…</p></AuthGate>;
  if (!album) return <AuthGate><EmptyState title="Album introuvable" hint="Le lien est invalide ou l'album a été retiré." /></AuthGate>;

  const grad = gradientFor(album.title);
  const tracks = album.tracks as any[];
  const isPlayingThis = isPlaying && tracks.some((t) => t.id === current?.id);

  const playAll = () => {
    if (tracks.length === 0) return;
    if (current && tracks.some((t) => t.id === current.id)) {
      togglePlay();
      return;
    }
    playQueue(tracks.map((t) => ({
      id: t.id, artist_id: t.artist_id, title: t.title, slug: t.slug,
      audio_url: t.audio_url, cover_url: t.cover_url,
      artist_name: album.artist_name, artist_slug: album.artist_slug,
      duration_seconds: t.duration_seconds, genre: t.genre,
      pricing_model: t.pricing_model, price_amount: t.price_amount,
      price_currency: t.price_currency, preview_seconds: t.preview_seconds,
    })), 0);
  };

  return (
    <AuthGate>
      <div className="space-y-6">
        <section className={`relative rounded-xl overflow-hidden border border-border bg-gradient-to-br ${grad}`}>
          <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
          <div className="relative p-6 md:p-8 grid gap-6 md:grid-cols-[200px_1fr] items-end">
            <div className={`aspect-square rounded-xl bg-gradient-to-br ${grad} grid place-items-center shadow-xl overflow-hidden`}>
              {album.cover_url ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" /> : <Disc3 className="w-20 h-20 text-primary-foreground/80" />}
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Album</p>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-[1.1]">{album.title}</h1>
              {album.description && <p className="text-sm text-muted-foreground max-w-2xl">{album.description}</p>}
              <p className="text-sm">
                <Link to="/artists/$slug" params={{ slug: album.artist_slug }} className="font-semibold hover:text-primary">{album.artist_name}</Link>
                <span className="text-muted-foreground"> · {tracks.length} morceau{tracks.length > 1 ? "x" : ""} · {new Date(album.released_at).getFullYear()}</span>
              </p>
              <button
                onClick={playAll}
                disabled={tracks.length === 0}
                className="inline-flex items-center gap-2 h-11 rounded-full bg-primary text-primary-foreground px-5 text-sm font-bold disabled:opacity-50"
              >
                {isPlayingThis ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlayingThis ? "Pause" : "Lire tout"}
              </button>
            </div>
          </div>
        </section>

        {tracks.length === 0 ? (
          <EmptyState title="Aucun morceau" hint="Cet album ne contient pas encore de pistes." />
        ) : (
          <ol className="divide-y divide-border bg-surface/40 border border-border rounded-md">
            {tracks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition">
                <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Link to="/tracks/$slug" params={{ slug: t.slug }} className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate hover:text-primary transition">{t.title}</p>
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(t.duration_seconds)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AuthGate>
  );
}
