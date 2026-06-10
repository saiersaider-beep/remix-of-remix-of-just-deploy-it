import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Compass,
  Filter,
  Flame,
  Music2,
  Play,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { PublicShell, EmptyState } from "@/components/PageScaffold";
import { RealTrackCard } from "@/components/RealTrackCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchTopArtists, fetchTrendingTracks, type RealTrack } from "@/lib/tracks-data";
import { avatarOrDefault } from "@/lib/default-avatar";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Discover — VinaSound" },
      {
        name: "description",
        content:
          "Explore les nouvelles sorties, les hits, les artistes émergents et les vibes du moment sur VinaSound.",
      },
    ],
  }),
});

type DiscoverTrack = RealTrack & {
  plays: number;
  likes: number;
  released_at: string | null;
};

async function fetchPublishedTracks(): Promise<DiscoverTrack[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select(
      "id,artist_id,title,slug,audio_url,cover_url,duration_seconds,genre,plays,likes,released_at,pricing_model,price_amount,price_currency,preview_seconds,artists(name,slug)",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((t) => {
    const raw = (t as unknown as { artists: { name: string; slug: string } | { name: string; slug: string }[] | null }).artists;
    const a = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
    return {
      id: t.id,
      artist_id: t.artist_id,
      title: t.title,
      slug: t.slug,
      audio_url: t.audio_url,
      cover_url: t.cover_url,
      duration_seconds: t.duration_seconds,
      genre: t.genre,
      pricing_model: t.pricing_model,
      price_amount: t.price_amount,
      price_currency: t.price_currency,
      preview_seconds: t.preview_seconds,
      artist_name: a?.name ?? "Artiste inconnu",
      artist_slug: a?.slug ?? "",
      plays: t.plays ?? 0,
      likes: t.likes ?? 0,
      released_at: t.released_at,
    } as DiscoverTrack;
  });
}

const MOODS = [
  { id: "all", label: "Tout", emoji: "✨" },
  { id: "hot", label: "Populaire", emoji: "🔥" },
  { id: "chill", label: "Chill", emoji: "🌙" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "focus", label: "Focus", emoji: "🧠" },
  { id: "love", label: "Love", emoji: "💜" },
  { id: "workout", label: "Workout", emoji: "💪" },
];

function DiscoverPage() {
  return (
    <PublicShell>
      <DiscoverContent />
    </PublicShell>
  );
}

function DiscoverContent() {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<string>("all");
  const [genre, setGenre] = useState<string | null>(null);

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["discover-tracks"],
    queryFn: fetchPublishedTracks,
  });
  const { data: trending = [] } = useQuery({
    queryKey: ["discover-trending"],
    queryFn: () => fetchTrendingTracks(7, 8),
  });
  const { data: artists = [] } = useQuery({
    queryKey: ["discover-artists"],
    queryFn: () => fetchTopArtists(10),
  });

  const genres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => t.genre && set.add(t.genre));
    return Array.from(set).slice(0, 12);
  }, [tracks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (q && !`${t.title} ${t.artist_name}`.toLowerCase().includes(q)) return false;
      if (genre && t.genre !== genre) return false;
      if (mood === "hot" && t.plays < 1000) return false;
      return true;
    });
  }, [tracks, query, genre, mood]);

  const newest = filtered.slice(0, 10);
  const popular = useMemo(
    () => [...filtered].sort((a, b) => b.plays - a.plays).slice(0, 10),
    [filtered],
  );

  return (
    <div className="space-y-12">
      <SearchHero
        query={query}
        onQuery={setQuery}
        suggestions={tracks.slice(0, 6)}
        totalTracks={tracks.length}
      />

      <SmartFilters
        mood={mood}
        onMood={setMood}
        genres={genres}
        activeGenre={genre}
        onGenre={setGenre}
        hasFilters={!!query || !!genre || mood !== "all"}
        onClear={() => {
          setQuery("");
          setGenre(null);
          setMood("all");
        }}
      />

      {/* Trending strip (only when no filter applied) */}
      {!query && !genre && mood === "all" && trending.length > 0 && (
        <TrendingStrip tracks={trending as DiscoverTrack[]} />
      )}

      {/* Main grid — Nouvelles sorties */}
      <section>
        <SectionHeader
          icon={Sparkles}
          eyebrow="Nouvelles sorties"
          title="Fraîchement"
          accent="publié"
          actionLabel="Publier"
          actionHref="/upload-song"
        />
        {isLoading ? (
          <SkeletonGrid />
        ) : newest.length === 0 ? (
          <EmptyState
            title={query || genre ? "Aucun résultat" : "Aucune chanson publiée"}
            hint={
              query || genre
                ? "Essaie un autre mot-clé ou retire les filtres."
                : "Sois le premier à uploader un titre — il apparaîtra ici dès publication."
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {newest.map((t) => (
              <RealTrackCard key={t.id} track={t} queue={newest} />
            ))}
          </div>
        )}
      </section>

      {/* Creator spotlight */}
      {artists.length > 0 && (
        <CreatorSpotlight artists={artists} />
      )}

      {/* Popular grid */}
      {popular.length > 0 && (
        <section>
          <SectionHeader
            icon={TrendingUp}
            eyebrow="Les plus écoutés"
            title="Les hits qui"
            accent="dominent"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {popular.map((t) => (
              <RealTrackCard key={t.id} track={t} queue={popular} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

/* ---------- Search hero ---------- */

function SearchHero({
  query,
  onQuery,
  suggestions,
  totalTracks,
}: {
  query: string;
  onQuery: (v: string) => void;
  suggestions: DiscoverTrack[];
  totalTracks: number;
}) {
  const [focused, setFocused] = useState(false);
  const showSuggestions = focused && query.length === 0 && suggestions.length > 0;
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden rounded-[32px] glass-card p-6 md:p-10">
      <div aria-hidden className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-primary/30 blur-[140px] animate-float-slow" />
      <div aria-hidden className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-accent-cyan/25 blur-[140px] animate-float-slow" style={{ animationDelay: "2s" }} />

      <div className="relative max-w-3xl space-y-6 animate-fade-in">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] glass">
          <Compass className="w-3.5 h-3.5 text-primary-glow" />
          <span className="bg-gradient-to-r from-primary-glow to-accent-cyan bg-clip-text text-transparent">
            Discover · {totalTracks.toLocaleString("fr-FR")} tracks
          </span>
        </span>

        <h1 className="font-display text-4xl md:text-6xl font-black leading-[0.95] tracking-tight">
          <span className="bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            Explore
          </span>{" "}
          <span className="bg-gradient-to-r from-primary via-violet-400 to-accent-cyan bg-clip-text text-transparent">
            le son
          </span>{" "}
          <span className="bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            qui te ressemble.
          </span>
        </h1>

        <div className="relative">
          <div
            className={`relative flex items-center gap-3 h-14 md:h-16 px-5 rounded-full glass-strong ring-1 transition-all ${
              focused ? "ring-primary/50 shadow-glow-purple" : "ring-white/10"
            }`}
          >
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Cherche un titre, un artiste, une vibe…"
              className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery("")}
                aria-label="Effacer"
                className="grid place-items-center w-8 h-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-white/[0.06] ring-1 ring-white/10 text-muted-foreground">
              ⌘ K
            </span>
          </div>

          {showSuggestions && (
            <div className="absolute z-20 left-0 right-0 mt-2 rounded-3xl glass-strong ring-1 ring-white/10 p-3 shadow-elegant animate-fade-in">
              <p className="px-2 pb-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Suggestions du moment
              </p>
              <div className="space-y-1">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigate({ to: "/tracks/$slug", params: { slug: t.slug } })}
                    className="group flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-accent-cyan ring-1 ring-white/10 shrink-0">
                      {t.cover_url ? (
                        <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center">
                          <Music2 className="w-4 h-4 text-white/80" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate group-hover:text-primary-glow transition-colors">
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.artist_name}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Smart filters ---------- */

function SmartFilters({
  mood,
  onMood,
  genres,
  activeGenre,
  onGenre,
  hasFilters,
  onClear,
}: {
  mood: string;
  onMood: (m: string) => void;
  genres: string[];
  activeGenre: string | null;
  onGenre: (g: string | null) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <section className="space-y-4 sticky top-2 z-10">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
        {MOODS.map((m) => {
          const isActive = mood === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMood(m.id)}
              className={`relative inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? "text-white shadow-glow-purple"
                  : "glass text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-violet-500 to-accent-cyan"
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                <span className="text-sm leading-none">{m.emoji}</span>
                {m.label}
              </span>
            </button>
          );
        })}
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-[11px] font-bold text-muted-foreground hover:text-foreground glass hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" /> Effacer
          </button>
        )}
      </div>

      {genres.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
          <span className="inline-flex items-center gap-1.5 px-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground shrink-0">
            <Filter className="w-3 h-3" /> Genres
          </span>
          {genres.map((g) => {
            const isActive = activeGenre === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onGenre(isActive ? null : g)}
                className={`px-3 h-8 rounded-full text-[11px] font-bold tracking-wide transition-all shrink-0 ${
                  isActive
                    ? "bg-primary/20 text-primary-glow ring-1 ring-primary/40"
                    : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground ring-1 ring-white/5"
                }`}
              >
                #{g}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Section header ---------- */

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  accent,
  actionLabel,
  actionHref,
}: {
  icon?: typeof Play;
  eyebrow: string;
  title: string;
  accent?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div>
        <span className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] glass">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary-glow" />}
          <span className="bg-gradient-to-r from-primary-glow to-accent-cyan bg-clip-text text-transparent">
            {eyebrow}
          </span>
        </span>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
          {title}{" "}
          {accent && (
            <span className="bg-gradient-to-r from-primary via-violet-400 to-accent-cyan bg-clip-text text-transparent">
              {accent}
            </span>
          )}
        </h2>
      </div>
      {actionHref && actionLabel && (
        <Link
          to={actionHref}
          className="group inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </div>
  );
}

/* ---------- Skeleton ---------- */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-3 animate-pulse">
          <div className="aspect-square rounded-3xl bg-white/5" />
          <div className="h-3 w-3/4 rounded-full bg-white/5" />
          <div className="h-2 w-1/2 rounded-full bg-white/5" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Trending strip ---------- */

function TrendingStrip({ tracks }: { tracks: DiscoverTrack[] }) {
  return (
    <section>
      <SectionHeader
        icon={Flame}
        eyebrow="Trending · 7 jours"
        title="Ce qui"
        accent="explose"
        actionLabel="Voir tout"
        actionHref="/top_music"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.slice(0, 6).map((t, i) => (
          <Link
            key={t.id}
            to="/tracks/$slug"
            params={{ slug: t.slug }}
            className="group relative flex items-center gap-4 rounded-3xl glass p-3 pr-5 hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-accent-cyan ring-1 ring-white/10 shrink-0">
              {t.cover_url ? (
                <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <Music2 className="w-7 h-7 text-white/80" />
                </div>
              )}
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-black tabular-nums bg-black/70 text-white">
                #{i + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base truncate group-hover:text-primary-glow transition-colors">
                {t.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">{t.artist_name}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-rose-400">
                  <Flame className="w-3 h-3" /> Hot
                </span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="tabular-nums">{t.plays.toLocaleString("fr-FR")} plays</span>
              </div>
            </div>
            <span className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent-cyan text-white shadow-glow-purple opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all shrink-0">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Creator spotlight ---------- */

function CreatorSpotlight({
  artists,
}: {
  artists: Awaited<ReturnType<typeof fetchTopArtists>>;
}) {
  return (
    <section>
      <SectionHeader
        icon={Sparkles}
        eyebrow="Creator spotlight"
        title="Artistes à"
        accent="suivre"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {artists.map((a) => (
          <Link
            key={a.id}
            to="/artists/$slug"
            params={{ slug: a.slug }}
            className="group relative rounded-3xl glass p-5 text-center hover:bg-white/[0.08] hover:-translate-y-1 transition-all overflow-hidden"
          >
            <div aria-hidden className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden ring-2 ring-white/5 group-hover:ring-primary/50 transition-all group-hover:scale-[1.04]">
              <img
                src={avatarOrDefault(a.avatar_url, a.id)}
                alt={a.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <p className="relative mt-3 font-bold text-sm truncate group-hover:text-primary-glow transition-colors">
              {a.name}
            </p>
            <p className="relative mt-0.5 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Artiste
            </p>
            <span className="relative inline-flex items-center justify-center gap-1.5 mt-3 px-3 h-8 rounded-full text-[11px] font-bold bg-primary/15 text-primary-glow ring-1 ring-primary/30 group-hover:bg-primary/25 transition-colors">
              + Suivre
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

