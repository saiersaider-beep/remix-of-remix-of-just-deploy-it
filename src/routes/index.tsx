import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Play, Star, Upload, BarChart3, Heart, Plus, Headphones, Music2, Users, Sparkles, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTopArtists, fetchTracks, fetchTrendingTracks } from "@/lib/tracks-data";
import { gradientFor } from "@/components/PageScaffold";
import { RealTrackCard } from "@/components/RealTrackCard";
import { avatarOrDefault } from "@/lib/default-avatar";
import { TrackGridSkeleton, ArtistGridSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "track";
const cover = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;
const avatar = (seed: string) => `https://i.pravatar.cc/240?u=${encodeURIComponent(seed)}`;
import heroMan from "@/assets/hero-man.jpg";
import heroWoman from "@/assets/hero-woman.jpg";
import manRock from "@/assets/man-rock.png";
import playlistImg from "@/assets/playlist.png";
import everywhereImg from "@/assets/everywhere.png";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Waveform, WaveformPlayer } from "@/components/Waveform";
import { TrackCard, TrackGrid, type Track } from "@/components/TrackCard";
import { useAudioPulse } from "@/hooks/use-audio-pulse";
import { usePlayerStore } from "@/stores/player";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Les Voix du Togo — Mango en premier" },
      {
        name: "description",
        content:
          "La plateforme musicale des artistes de Mango et du Togo. Découvre, écoute et soutiens les talents de Mango, Lomé, Kara, Sokodé et tout le 228 — Afrobeat, Rap 228, sons traditionnels.",
      },
    ],
  }),

});

const trendingTogo: Track[] = [
  { title: "Natey (Mine)", artist: "Bahe Za", cover: cover("natey-mine"), plays: 1240000, trend: "hot", duration: "3:24" },
  { title: "Lomé Nights", artist: "King Mensah", cover: cover("lome-nights"), plays: 892000, trend: "hot", duration: "4:01" },
  { title: "Amapiano Vibes", artist: "DJ Tovi", cover: cover("amapiano-vibes"), plays: 654000, trend: "rising", duration: "5:12" },
  { title: "Drill 228", artist: "Toofan", cover: cover("drill-228"), plays: 510000, trend: "new", duration: "2:58" },
  { title: "Coupé Décalé Remix", artist: "Almok", cover: cover("coupe-decale"), plays: 421000, trend: "rising", duration: "3:47" },
];

const afrobeatPopular: Track[] = [
  { title: "Calm Down (Remix)", artist: "Rema · Selena", cover: cover("calm-down"), plays: 8200000, trend: "hot", duration: "3:59" },
  { title: "Last Last", artist: "Burna Boy", cover: cover("last-last"), plays: 6100000, trend: "hot", duration: "2:53" },
  { title: "Unavailable", artist: "Davido · Musa Keys", cover: cover("unavailable"), plays: 5400000, duration: "3:32" },
  { title: "Terminator", artist: "Asake", cover: cover("terminator"), plays: 3200000, trend: "rising", duration: "2:45" },
  { title: "Soso", artist: "Omah Lay", cover: cover("soso"), plays: 2800000, duration: "3:18" },
  { title: "Water", artist: "Tyla", cover: cover("water-tyla"), plays: 9800000, trend: "hot", duration: "3:20" },
  { title: "Bandana", artist: "Fireboy DML · Asake", cover: cover("bandana"), plays: 4100000, duration: "3:01" },
  { title: "Body & Soul", artist: "Joeboy", cover: cover("body-soul"), plays: 1900000, trend: "new", duration: "2:48" },
  { title: "Rush", artist: "Ayra Starr", cover: cover("rush-ayra"), plays: 7300000, trend: "hot", duration: "2:53" },
  { title: "People", artist: "Libianca", cover: cover("people-libianca"), plays: 6700000, duration: "3:15" },
];

const playlistTags = ["Mix", "Classic", "Rock", "Jazz", "Other"];

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatPill({ icon: Icon, value, suffix, label }: { icon: typeof Play; value: number; suffix: string; label: string }) {
  const n = useCountUp(value);
  const formatted = n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000
    ? (n / 1_000).toFixed(0) + "K"
    : n.toString();
  return (
    <div className="glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-glow group">
      <span className="grid place-items-center w-9 h-9 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.25)] shrink-0 text-[#FF6B00] bg-white mb-3 group-hover:scale-110 transition">
        <Icon className="w-4 h-4" />
      </span>
      <p className="font-display text-3xl font-extrabold tabular-nums">
        {formatted}
        <span className="text-gradient-primary">{suffix}</span>
      </p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mt-1">{label}</p>
    </div>
  );
}

function Hero() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const pulse = useAudioPulse(isPlaying);
  // Mouse parallax (desktop only)
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setMouse({ x, y }));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 0..1 reactive intensity for blur/glow when audio is playing
  const k = Math.min(1, pulse * 1.6);
  const tx = (m: number) => mouse.x * m;
  const ty = (m: number) => mouse.y * m;

  return (
    <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 -z-10 bg-mesh animate-gradient-shift" />
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute top-20 -left-32 w-[28rem] h-[28rem] rounded-full bg-amber-600/30 blur-[120px] animate-float-slow transition-transform duration-300 will-change-transform"
          style={{
            transform: `translate3d(${tx(-30)}px, ${ty(-20)}px, 0) scale(${1 + k * 0.18})`,
            opacity: 0.6 + k * 0.4,
          }}
        />
        <div
          className="absolute top-40 right-0 w-[32rem] h-[32rem] rounded-full bg-primary/25 blur-[120px] animate-float-slow will-change-transform"
          style={{
            animationDelay: "2s",
            transform: `translate3d(${tx(40)}px, ${ty(25)}px, 0) scale(${1 + k * 0.22})`,
            opacity: 0.55 + k * 0.45,
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-[24rem] h-[24rem] rounded-full bg-cyan-400/15 blur-[100px] animate-float-slow will-change-transform"
          style={{
            animationDelay: "4s",
            transform: `translate3d(${tx(20)}px, ${ty(-30)}px, 0) scale(${1 + k * 0.15})`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div
        className="relative mx-auto max-w-[1400px] px-6 grid md:grid-cols-[1.15fr_1fr] gap-12 items-center"
        style={{
          // Subtle whole-grid parallax so cards drift opposite the cursor
          transform: `translate3d(${tx(-6)}px, ${ty(-6)}px, 0)`,
        }}
      >
        <div className="relative z-10 animate-fade-up">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold glass rounded-full px-3 py-1.5 mb-6">
            <span className="text-lg leading-none">🇹🇬</span>
            <span className="text-gradient-primary">Mango · Lomé · Kara · Sokodé · Tout le Togo</span>
          </span>

          <h1 className="font-display text-5xl md:text-6xl lg:text-[5.5rem] font-extrabold leading-[1.05]">
            <span className="block">Les</span>
            <span className="block text-primary">Voix du</span>
            <span className="relative inline-block">
              Togo
              <Sparkles className="absolute -top-2 -right-8 w-7 h-7 text-primary animate-pulse" />
            </span>
            .
          </h1>

          <p className="mt-7 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Écoute, publie et soutiens les talents de <span className="text-foreground font-semibold">Mango</span> et de tout le Togo — du nord au sud.
            <span className="text-foreground font-semibold"> Afrobeat, Rap 228, Coupé Décalé, sons traditionnels</span> — toute l'énergie du 228, en un seul endroit.
          </p>


          <div className="mt-9 flex items-center gap-3 flex-wrap">
            <Link
              to="/discover"
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-primary text-white font-bold pl-2 pr-6 py-2 rounded-full shadow-glow animate-glow-pulse hover:scale-105 transition-transform"
            >
              <span className="grid place-items-center w-10 h-10 rounded-full bg-white/15 backdrop-blur group-hover:rotate-12 transition">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </span>
              <span className="text-base">Écouter maintenant</span>
            </Link>
            <Link
              to="/upload-song"
              className="inline-flex items-center gap-2.5 glass-strong text-foreground font-bold px-6 py-3.5 rounded-full hover:border-amber-500 hover:text-amber-400 transition"
            >
              <Upload className="w-4 h-4" />
              Publier ta musique
            </Link>
            <Link to="/signup" className="hidden sm:inline-flex items-center gap-2 font-bold text-muted-foreground hover:text-foreground transition px-3">
              S'inscrire <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-3 max-w-xl">
            <StatPill icon={Headphones} value={45000} suffix="+" label="Écoutes/mois" />
            <StatPill icon={Users} value={320} suffix="+" label="Artistes togolais" />
            <StatPill icon={Music2} value={1200} suffix="+" label="Sons publiés" />
          </div>

        </div>

        <div data-hero-photos className="relative grid grid-cols-2 gap-5 min-h-[420px] md:min-h-[560px]">
          {/* Ambient glows behind cards */}
          <div className="pointer-events-none absolute -top-10 left-0 w-56 h-56 rounded-full bg-amber-500/30 blur-[90px] animate-float-slow" />
          <div className="pointer-events-none absolute bottom-0 right-0 w-64 h-64 rounded-full bg-pink-500/25 blur-[100px] animate-float-slow" style={{ animationDelay: "1.4s" }} />

          {/* Card 1 — male artist */}
          <div className="group relative rounded-3xl overflow-hidden shadow-elegant ring-1 ring-white/10 rotate-[-4deg] self-start mt-2 animate-float-slow hover:rotate-0 hover:scale-[1.04] transition-transform duration-500 will-change-transform">
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-amber-400/60 via-orange-500/40 to-transparent opacity-70 blur-sm group-hover:opacity-100 transition" />
            <div className="relative rounded-3xl overflow-hidden">
              <img
                src={heroMan}
                alt="Artiste du Togo — Lomé Nights"
                loading="eager"
                decoding="async"
                className="block w-full h-[360px] object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />


              {/* 0K+ badge */}
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/10">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-rose-500" />
                </span>
                0K+
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 backdrop-blur-sm p-2.5 ring-1 ring-white/10">
                <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">N°1 Tendances</p>
                <p className="text-sm font-extrabold tracking-tight text-white mt-0.5">Lomé Nights</p>
                <p className="text-[11px] font-semibold truncate text-white/90">King Mensah · 4:01</p>

                <div className="flex items-end gap-0.5 h-5 mt-2">
                  {[8, 14, 10, 18, 12, 16, 9, 13, 17, 11, 14, 8].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 bg-gradient-to-t from-amber-500 to-primary/80 rounded-full eq-bar"
                      style={{ height: `${h * 5}%`, animationDelay: `${i * 70}ms` }}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Card 2 — female artist */}
          <div className="group relative rounded-3xl overflow-hidden shadow-elegant ring-1 ring-white/10 rotate-[4deg] self-end mb-2 animate-float-slow hover:rotate-0 hover:scale-[1.04] transition-transform duration-500 will-change-transform" style={{ animationDelay: "0.8s" }}>
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-pink-400/60 via-rose-500/40 to-transparent opacity-70 blur-sm group-hover:opacity-100 transition" />
            <div className="relative rounded-3xl overflow-hidden">
              <img
                src={heroWoman}
                alt="Artiste du Togo — Calm Down"
                loading="eager"
                decoding="async"
                className="block w-full h-[360px] object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

              {/* Play button */}
              <div className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full bg-white text-black shadow-glow group-hover:scale-110 transition">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/70 backdrop-blur-sm p-2.5 ring-1 ring-white/10">
                <p className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">Afrobeat</p>
                <p className="text-sm font-extrabold tracking-tight text-white mt-0.5">Calm Down</p>
                <p className="text-[11px] font-semibold truncate text-white/90">Rema · 3:59</p>

                <div className="mt-2 h-1 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full w-3/5 bg-gradient-to-r from-pink-400 to-rose-500" />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingTogoSection() {
  const days = 7;
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["home-trending-tracks", days],
    queryFn: () => fetchTrendingTracks(days, 5),
  });
  return (
    <section className="py-20 relative">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold glass rounded-full px-3 py-1.5 mb-3">
              <span className="text-lg leading-none">🇹🇬</span>
              <span className="text-gradient-primary">Tendances Togo · {days} derniers jours</span>
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
              Ce que <span className="text-gradient-primary">Vina</span> écoute
              <br />
              en ce moment
            </h2>

          </div>
          <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition group">
            Voir tout
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
        </div>

        {isLoading ? (
          <TrackGridSkeleton count={5} />
        ) : tracks.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="Pas encore d'écoutes cette semaine"
            description={`Aucun morceau n'a été joué ces ${days} derniers jours. Sois le premier à lancer une vibe.`}
            ctaLabel="Découvrir"
            ctaTo="/discover"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {tracks.map((t) => (
              <div key={t.id} className="space-y-2">
                <RealTrackCard track={t} queue={tracks} />
                <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground tabular-nums">
                  <span className="text-amber-400">{t.plays.toLocaleString("fr-FR")}</span> écoutes · {days}j
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AfrobeatSection() {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["home-popular-tracks"],
    queryFn: () => fetchTracks({ order: "popular", limit: 10 }),
  });
  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute top-1/2 -left-20 w-96 h-96 rounded-full bg-amber-600/15 blur-[120px]" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
      </div>
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold glass rounded-full px-3 py-1.5 mb-3">
              <Mic2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-gradient-primary">Afrobeat & Rap 228</span>
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
              Les sons qui font <span className="text-gradient-primary">vibrer</span> la Savane
            </h2>

          </div>
          <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition group">
            Voir tout <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
        </div>

        {isLoading ? (
          <TrackGridSkeleton count={5} />
        ) : tracks.length === 0 ? (
          <EmptyState
            icon={Mic2}
            title="Aucun titre publié pour le moment"
            description="Sois le premier à uploader un son et faire vibrer la Savane."
            ctaLabel="Publier un titre"
            ctaTo="/upload-song"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {tracks.map((t) => (
              <RealTrackCard key={t.id} track={t} queue={tracks} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EverywhereSection() {
  return (
    <section className="py-24 bg-surface/40">
      <div className="mx-auto max-w-[1400px] px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <img src={everywhereImg} alt="Listen everywhere" loading="lazy" width={768} height={768} className="w-full max-w-md mx-auto" />
        </div>
        <div>
          <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Tess of The Road · 3030</p>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
            Écoute ta musique <span className="text-primary">partout</span>, à tout moment
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
            Stream sur ton téléphone, ta tablette, ton ordinateur ou ta voiture — VinaSound suit ta playlist
            partout, en haute qualité, même hors ligne.
          </p>

        </div>
      </div>
    </section>
  );
}

function PlaylistSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[1400px] px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
            Crée tes <span className="text-primary">playlists</span> avec n'importe quel titre, partout
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
            Construis ta bibliothèque personnelle, partage-la avec tes amis, collabore en temps réel.
            Tes morceaux préférés, organisés comme tu le veux.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {playlistTags.map(t => (
              <Link key={t} to="/discover" className="px-5 py-2 rounded-full border border-border hover:border-primary hover:text-primary text-sm font-semibold transition">
                {t}
              </Link>
            ))}
          </div>
          <div className="mt-10">
            <Link to="/my_playlists" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-md hover:opacity-90 transition">
              <Plus className="w-4 h-4" /> Ouvrir mes playlists
            </Link>
          </div>
        </div>
        <div className="order-1 lg:order-2 relative">
          <img src={playlistImg} alt="Mobile playlist" loading="lazy" width={768} height={768} className="w-full max-w-md mx-auto" />
        </div>
      </div>
    </section>
  );
}

function ArtistsSection() {
  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["home-top-artists"],
    queryFn: () => fetchTopArtists(14),
  });
  return (
    <section className="py-24 bg-surface/40">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold">
            Découvre les <span className="text-primary">artistes les plus populaires</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Les plus écoutés du moment. VinaSound met en avant les artistes tendances pour que les fans accèdent
            rapidement à la musique qu'ils veulent écouter.
          </p>

        </div>
        {isLoading ? (
          <ArtistGridSkeleton count={7} />
        ) : artists.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun artiste pour le moment"
            description="Crée ton profil et deviens le premier artiste à briller sur VinaSound."
            ctaLabel="Devenir artiste"
            ctaTo="/become"
          />
        ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-6">
          {artists.map((a, i) => (
            <Link
              key={a.id}
              to="/artists/$slug"
              params={{ slug: a.slug }}
              className="group text-center"
            >
              <div className="relative aspect-square rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition">
                <img
                  src={avatarOrDefault(a.avatar_url, a.id)}
                  alt={a.name}
                  loading="lazy"
                  width={240}
                  height={240}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <p className="mt-3 text-sm font-semibold truncate group-hover:text-primary transition">{a.name}</p>
            </Link>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}

function CreatorsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[1400px] px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="relative">
          <img src={manRock} alt="Climbing creator" loading="lazy" width={768} height={768} className="w-full max-w-md mx-auto" />
        </div>
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
            Appel à tous les <span className="text-primary">créateurs</span>
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
            Rejoins VinaSound pour connecter avec tes fans, partager tes sons et faire grandir ton audience.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="flex items-center gap-3 bg-surface border border-border rounded-md px-5 py-3">
              <Upload className="w-5 h-5 text-primary" />
              <span className="font-semibold">Publier des titres</span>
            </div>
            <div className="flex items-center gap-3 bg-surface border border-border rounded-md px-5 py-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-semibold">Suivre tes stats</span>
            </div>
          </div>
          <Link to="/upload-song" className="mt-10 inline-flex items-center gap-3 bg-primary text-primary-foreground font-bold px-6 py-3.5 rounded-md hover:opacity-90 transition">
            <Upload className="w-4 h-4" />
            Publier ton titre maintenant
          </Link>

        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative py-24 overflow-hidden border-t border-border">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <Waveform bars={150} className="w-full h-32" />
      </div>
      <div className="relative mx-auto max-w-3xl text-center px-6">
        <h2 className="font-display text-4xl md:text-6xl font-extrabold leading-tight">
          Le meilleur endroit pour <span className="text-primary">écouter</span> ta musique.
        </h2>
        <p className="mt-6 text-muted-foreground text-lg">Prêt à enflammer tes oreilles.</p>
        <p className="mt-2 text-muted-foreground">Crée ton compte ou connecte-toi pour commencer.</p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/signup" className="bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-md hover:opacity-90 transition">
            S'inscrire
          </Link>
          <Link to="/login" className="border border-border font-bold px-8 py-3.5 rounded-md hover:border-primary hover:text-primary transition">
            Connexion
          </Link>
        </div>

      </div>
    </section>
  );
}

export function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <TrendingTogoSection />
        <AfrobeatSection />
        <EverywhereSection />
        <PlaylistSection />
        <ArtistsSection />
        <CreatorsSection />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
