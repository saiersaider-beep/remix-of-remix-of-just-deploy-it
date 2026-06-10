import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Play, Shuffle, Share2, BadgeCheck, UserPlus, UserCheck,
  MoreHorizontal, Music2, Disc3, ListMusic, Heart, Info,
  TrendingUp, Flame, Clock, Users, Headphones, Trophy, MessageSquare,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AuthGate, gradientFor, MediaGrid, TrackList, EmptyState } from "@/components/PageScaffold";
import { unslug } from "@/components/DetailView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { avatarOrDefault } from "@/lib/default-avatar";

export const Route = createFileRoute("/artists/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${unslug(params.slug)} — Artist — VinaSound` },
      { name: "description", content: `Listen to ${unslug(params.slug)}, follow the artist, and explore tracks, albums and playlists on VinaSound.` },
      { property: "og:title", content: `${unslug(params.slug)} — VinaSound` },
      { property: "og:description", content: `Discover ${unslug(params.slug)} on VinaSound.` },
    ],
  }),
  component: ArtistPage,
});

type ArtistRow = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  verified: boolean;
  monthly_listeners: number;
};

type TabKey = "tracks" | "albums" | "playlists" | "liked" | "about";

const TABS: { key: TabKey; label: string; icon: typeof Music2 }[] = [
  { key: "tracks", label: "Titres", icon: Music2 },
  { key: "albums", label: "Albums", icon: Disc3 },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "liked", label: "Liked", icon: Heart },
  { key: "about", label: "À propos", icon: Info },
];

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ArtistPage() {
  return (
    <AuthGate>
      <ArtistInner />
    </AuthGate>
  );
}

function ArtistInner() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messaging, setMessaging] = useState(false);

  const handleMessage = async () => {
    if (!user || !artist || messaging) return;
    setMessaging(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_conversation", {
        _other_user_id: artist.user_id,
      });
      if (error) throw error;
      navigate({ to: "/messages", search: { c: data as string } });
    } catch (e) {
      console.error(e);
    } finally {
      setMessaging(false);
    }
  };
  const fallbackName = useMemo(() => unslug(slug), [slug]);

  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [followers, setFollowers] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("tracks");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("artists")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      setArtist(data as ArtistRow | null);

      if (data) {
        const { count } = await supabase
          .from("artist_followers")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", data.id);
        if (!cancelled) setFollowers(count ?? 0);

        if (user) {
          const { data: f } = await supabase
            .from("artist_followers")
            .select("artist_id")
            .eq("artist_id", data.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!cancelled) setIsFollowing(!!f);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, user]);

  // Live followers count via Supabase Realtime
  useEffect(() => {
    if (!artist?.id) return;
    const channel = supabase
      .channel(`artist-followers-${artist.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artist_followers", filter: `artist_id=eq.${artist.id}` },
        async () => {
          const { count } = await supabase
            .from("artist_followers")
            .select("*", { count: "exact", head: true })
            .eq("artist_id", artist.id);
          setFollowers(count ?? 0);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [artist?.id]);

  async function handleFollow() {
    if (!user || !artist) return;
    if (isFollowing) {
      setIsFollowing(false);
      setFollowers((c) => Math.max(0, c - 1));
      await supabase
        .from("artist_followers")
        .delete()
        .eq("artist_id", artist.id)
        .eq("user_id", user.id);
    } else {
      setIsFollowing(true);
      setFollowers((c) => c + 1);
      await supabase
        .from("artist_followers")
        .insert({ artist_id: artist.id, user_id: user.id });
    }
  }

  async function handleClaim() {
    if (!user) return;
    setClaiming(true);
    const { data, error } = await supabase
      .from("artists")
      .insert({ user_id: user.id, slug, name: fallbackName })
      .select()
      .single();
    setClaiming(false);
    if (!error && data) setArtist(data as ArtistRow);
  }

  const name = artist?.name ?? fallbackName;
  const grad = gradientFor(name);
  const isOwner = !!(user && artist && artist.user_id === user.id);

  return (
    <div className="-mx-6 lg:-mx-10 -mt-6 lg:-mt-10">
      {/* Banner */}
      <section className="relative h-56 md:h-72 overflow-hidden">
        {artist?.cover_url ? (
          <img src={artist.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </section>

      <div className="px-6 lg:px-10 -mt-20 md:-mt-24 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end gap-6">
          <div className={`w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-gradient-to-br ${grad} ring-4 ring-background shadow-2xl shrink-0`}>
            <img
              src={avatarOrDefault(artist?.avatar_url, artist?.id ?? slug)}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                const fallback = avatarOrDefault(null, artist?.id ?? slug);
                if (!img.src.endsWith(fallback)) img.src = fallback;
              }}
            />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Artiste</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight truncate">{name}</h1>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{formatCount(followers)}</span> followers
              <span className="mx-2">·</span>
              <span className="font-bold text-foreground">{formatCount(artist?.monthly_listeners ?? 0)}</span> monthly listeners
            </p>
          </div>
        </header>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-bold hover:opacity-90">
            <Play className="w-4 h-4 fill-current" /> Play all
          </button>
          <button className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-surface">
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
          {!loading && artist && !isOwner && (
            <button
              onClick={handleFollow}
              disabled={!user}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
                isFollowing
                  ? "bg-surface border border-border hover:border-primary"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? "Abonnements" : "Suivre"}
            </button>
          )}
          {!loading && artist && !isOwner && user && (
            <button
              onClick={handleMessage}
              disabled={messaging}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold border border-border hover:border-primary hover:text-primary transition disabled:opacity-60"
            >
              <MessageSquare className="w-4 h-4" /> {messaging ? "…" : "Message"}
            </button>
          )}
          {!loading && !artist && user && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              <BadgeCheck className="w-4 h-4" /> {claiming ? "Claiming…" : "Claim this artist"}
            </button>
          )}
          <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="Partager">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="grid place-items-center w-10 h-10 rounded-full border border-border hover:bg-surface" aria-label="More">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <nav className="mt-10 border-b border-border flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${
                  active ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <section className="py-8">
          {tab === "tracks" && <TracksTab name={name} artistId={artist?.id ?? null} followers={followers} />}
          {tab === "albums" && <AlbumsTab name={name} artistId={artist?.id ?? null} />}
          {tab === "playlists" && <PlaylistsTab name={name} />}
          {tab === "liked" && (
            <EmptyState title="No liked tracks yet" hint={`${name} hasn't liked anything publicly.`} />
          )}
          {tab === "about" && <AboutTab artist={artist} fallbackName={name} />}
        </section>

        {/* Owner edit hint */}
        {isOwner && (
          <p className="text-xs text-muted-foreground pb-8">
            Tu gères ce profil artiste. <Link to="/upload-song" className="text-primary font-semibold">Publier un titre</Link> ou modifie ta bio dans les paramètres.
          </p>
        )}
      </div>
    </div>
  );
}

type TrackRow = {
  id: string;
  title: string;
  slug: string;
  duration_seconds: number;
  plays: number;
  likes: number;
  released_at: string;
  cover_url: string | null;
};

function fmtTime(s: number) {
  return `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, "0")}`;
}

function TracksTab({ name, artistId, followers }: { name: string; artistId: string | null; followers: number }) {
  const [tracks, setTracks] = useState<TrackRow[] | null>(null);

  useEffect(() => {
    if (!artistId) { setTracks([]); return; }
    supabase
      .from("tracks")
      .select("id, title, slug, duration_seconds, plays, likes, released_at, cover_url")
      .eq("artist_id", artistId)
      .eq("is_published", true)
      .order("released_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setTracks((data ?? []) as TrackRow[]));
  }, [artistId]);

  if (tracks === null) return <p className="text-sm text-muted-foreground">Loading tracks…</p>;
  if (tracks.length === 0) return <EmptyState title="No tracks yet" hint={`${name} hasn't published any tracks.`} />;

  const totalStreams = tracks.reduce((a, t) => a + (t.plays || 0), 0);
  const totalLikes = tracks.reduce((a, t) => a + (t.likes || 0), 0);
  const topTrack = [...tracks].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0] ?? null;

  const top5 = [...tracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);
  const recent = tracks.slice(0, 8);

  const recentRows = recent.map((t) => ({
    title: t.title, artist: name, slug: t.slug, time: fmtTime(t.duration_seconds),
  }));

  return (
    <div className="space-y-12">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Headphones} label="Total streams" value={formatCount(totalStreams)} />
        <StatCard icon={Heart} label="Total likes" value={formatCount(totalLikes)} />
        <StatCard icon={Users} label="Abonnés" value={formatCount(followers)} />
        <StatCard icon={Trophy} label="Top track" value={topTrack?.title ?? "—"} subtle />
      </div>

      {/* Top tracks */}
      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-extrabold inline-flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" /> Top tracks
          </h2>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">By plays</span>
        </header>
        <ol className="divide-y divide-border border border-border rounded-md overflow-hidden">
          {top5.map((t, i) => (
            <li key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface/60 transition">
              <span className="w-6 text-right text-sm font-bold text-muted-foreground">{i + 1}</span>
              <div className={`w-10 h-10 rounded ${gradientFor(t.title)} bg-gradient-to-br shrink-0 overflow-hidden`}>
                {t.cover_url && <img src={t.cover_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <Link to="/tracks/$slug" params={{ slug: t.slug }} className="font-bold text-sm truncate hover:text-primary">
                  {t.title}
                </Link>
                <p className="text-xs text-muted-foreground">{formatCount(t.plays || 0)} plays · {formatCount(t.likes || 0)} likes</p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(t.duration_seconds)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Recently released */}
      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-extrabold inline-flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Recently released
          </h2>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Newest first</span>
        </header>
        <TrackList rows={recentRows} />
      </section>
    </div>
  );
}

type AlbumRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  plays: number;
  released_at: string;
};

function AlbumsTab({ name, artistId }: { name: string; artistId: string | null }) {
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);

  useEffect(() => {
    if (!artistId) { setAlbums([]); return; }
    supabase
      .from("albums")
      .select("id, title, slug, cover_url, plays, released_at")
      .eq("artist_id", artistId)
      .eq("is_published", true)
      .order("released_at", { ascending: false })
      .then(({ data }) => setAlbums((data ?? []) as AlbumRow[]));
  }, [artistId]);

  if (albums === null) return <p className="text-sm text-muted-foreground">Loading albums…</p>;
  if (albums.length === 0) return <EmptyState title="No albums yet" hint={`${name} hasn't released any albums.`} />;

  const popular = [...albums].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 8);
  const recent = albums.slice(0, 8);

  return (
    <div className="space-y-12">
      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-extrabold inline-flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Popular releases
          </h2>
        </header>
        <MediaGrid items={popular.map((a) => ({ title: a.title, subtitle: name, badge: "Album" }))} kind="album" />
      </section>
      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-extrabold inline-flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Recently released
          </h2>
        </header>
        <MediaGrid items={recent.map((a) => ({ title: a.title, subtitle: name, badge: "Album" }))} kind="album" />
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, live, subtle,
}: { icon: typeof Music2; label: string; value: string; live?: boolean; subtle?: boolean }) {
  return (
    <div className="border border-border rounded-md p-4 bg-surface/40">
      <div className="flex items-center justify-between text-muted-foreground">
        <Icon className="w-4 h-4" />
        {live && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        )}
      </div>
      <p className={`mt-2 font-display font-extrabold ${subtle ? "text-lg truncate" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function PlaylistsTab({ name }: { name: string }) {
  const items = [`This is ${name}`, `${name} Essentials`, `${name} Radio`].map((t) => ({
    title: t,
    subtitle: "Playlist",
    badge: "Mix",
  }));
  return <MediaGrid items={items} kind="playlist" />;
}

function AboutTab({ artist, fallbackName }: { artist: ArtistRow | null; fallbackName: string }) {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="font-display text-2xl font-extrabold">About {artist?.name ?? fallbackName}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {artist?.bio?.trim()
          ? artist.bio
          : `${artist?.name ?? fallbackName} hasn't shared a bio yet. Follow to be the first to know when new music drops.`}
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Vérifié</dt>
          <dd className="font-bold">{artist?.verified ? "Oui" : "Non"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Monthly listeners</dt>
          <dd className="font-bold">{formatCount(artist?.monthly_listeners ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Profil</dt>
          <dd className="font-bold">{artist ? "Claimed" : "Unclaimed"}</dd>
        </div>
      </dl>
    </div>
  );
}
