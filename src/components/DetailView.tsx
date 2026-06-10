import { Play, Heart, Share2, Plus, Download, MoreHorizontal, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { gradientFor, TrackList } from "@/components/PageScaffold";

export type DetailKind = "album" | "playlist" | "track";

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function unslug(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DetailView({
  kind,
  title,
  subtitle,
  meta,
  tracks,
}: {
  kind: DetailKind;
  title: string;
  subtitle?: string;
  meta?: string;
  tracks: { title: string; artist: string; time: string }[];
}) {
  const grad = gradientFor(title);
  const totalSeconds = tracks.reduce((acc, t) => {
    const [m, s] = t.time.split(":").map(Number);
    return acc + (m || 0) * 60 + (s || 0);
  }, 0);
  const totalMin = Math.floor(totalSeconds / 60);

  return (
    <div>
      <section className="flex flex-col md:flex-row gap-8 mb-10">
        <div className={`relative w-full md:w-72 aspect-square rounded-md overflow-hidden bg-gradient-to-br ${grad} shadow-2xl shrink-0`}>
          <div className="absolute inset-0 grid place-items-center">
            <Play className="w-16 h-16 fill-white/90 text-white/90" />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-end min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">{kind}</p>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-lg text-muted-foreground mt-3">{subtitle}</p>}
          {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}
          {kind !== "track" && (
            <p className="text-sm text-muted-foreground mt-1">
              {tracks.length} tracks · {totalMin} min
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-bold hover:opacity-90">
              <Play className="w-4 h-4 fill-current" /> Play
            </button>
            <button className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-surface">
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="J'aime">
              <Heart className="w-4 h-4" />
            </button>
            <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="Ajouter">
              <Plus className="w-4 h-4" />
            </button>
            <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="Télécharger">
              <Download className="w-4 h-4" />
            </button>
            <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="Partager">
              <Share2 className="w-4 h-4" />
            </button>
            <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="More">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="mb-10 bg-surface/40 border border-border rounded-md p-5">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded bg-gradient-to-br ${grad} shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{tracks[0]?.title ?? title}</p>
            <p className="text-xs text-muted-foreground truncate">{tracks[0]?.artist ?? subtitle}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
            <button className="hover:text-foreground"><SkipBack className="w-5 h-5" /></button>
            <button className="grid place-items-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:opacity-90">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
            <button className="hover:text-foreground"><SkipForward className="w-5 h-5" /></button>
          </div>
          <div className="hidden md:flex items-center gap-2 text-muted-foreground ml-4">
            <Volume2 className="w-4 h-4" />
            <div className="w-24 h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-primary" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span>0:00</span>
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-primary" />
          </div>
          <span>{tracks[0]?.time ?? "0:00"}</span>
        </div>
      </section>

      {kind !== "track" && (
        <section>
          <h2 className="font-display text-xl font-extrabold mb-4">Tracklist</h2>
          <TrackList rows={tracks} />
        </section>
      )}
    </div>
  );
}
