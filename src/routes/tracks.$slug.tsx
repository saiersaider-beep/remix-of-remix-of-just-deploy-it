import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Download, FileText, Heart, ListMusic, Loader2, Lock, Music2, Pause, Pencil, Play, Plus, Share2, ShoppingBag, Sparkles, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGate, EmptyState, gradientFor } from "@/components/PageScaffold";
import { ThreadedComments } from "@/components/ThreadedComments";
import { PremiumWaveform } from "@/components/PremiumWaveform";
import { RepostButton } from "@/components/RepostButton";
import { unslug } from "@/components/DetailView";
import { TRACK_POCHETTE_COVER } from "@/lib/default-cover";
import decorativeHeadphones from "@/assets/decorative-headphones.png";


import { useAuth } from "@/hooks/use-auth";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";
import { formatPrice } from "@/lib/player";
import { getTrackPurchaseInfo } from "@/lib/purchase.functions";
import { initCinetPayPayment } from "@/lib/cinetpay.functions";
import {
  addTrackToPlaylist,
  createPlaylist,
  getMyPlaylists,
  getTrackBySlug,
  toggleTrackLike,
  updateTrackLyrics,
} from "@/lib/track-social";

function formatSeconds(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// (legacy synthetic waveform removed — PremiumWaveform owns the visualization)

export const Route = createFileRoute("/tracks/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${unslug(params.slug)} — Track — VinaSound` },
      { name: "description", content: `Play the track ${unslug(params.slug)} on VinaSound.` },
    ],
  }),
  component: TrackDetail,
});

function TrackDetail() {
  const { user } = useAuth();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"description" | "lyrics">("description");
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState("");

  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.toggle);
  const playerCurrent = usePlayerStore(currentTrackSelector);
  const playerIsPlaying = usePlayerStore((s) => s.isPlaying);
  const playerPosition = usePlayerStore((s) => s.position);
  const playerDuration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.index);

  const { data: track, isLoading } = useQuery({
    queryKey: ["track", slug],
    queryFn: () => getTrackBySlug(slug),
  });



  const { data: playlists = [] } = useQuery({
    queryKey: ["my-playlists", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyPlaylists(user!.id),
  });

  const buyFn = useServerFn(initCinetPayPayment);
  const purchaseInfoFn = useServerFn(getTrackPurchaseInfo);
  const { data: purchaseInfo, refetch: refetchPurchaseInfo } = useQuery({
    queryKey: ["track-purchase-info", track?.id, user?.id],
    enabled: !!track?.id && !!user?.id,
    queryFn: () => purchaseInfoFn({ data: { trackId: track!.id } }),
  });

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!track) throw new Error("Piste introuvable.");
      return buyFn({
        data: { purpose: "track", target_id: track.id },
      });
    },
    onSuccess: (res) => {
      if (!res.payment_url) {
        toast.error("Lien de paiement indisponible.");
        return;
      }
      window.location.href = res.payment_url;
    },
    onError: (e: Error) => toast.error(e.message || "Paiement impossible."),
  });

  const isCurrent = !!track && playerCurrent?.id === track.id;
  const isPlayingThis = isCurrent && playerIsPlaying;
  // progress now driven directly by PremiumWaveform via store subscription

  const handlePlay = () => {
    if (!track) return;
    if (isCurrent) {
      togglePlay();
      return;
    }
    playTrack({
      id: track.id,
      artist_id: track.artist_id,
      title: track.title,
      slug: track.slug,
      audio_url: track.audio_url,
      cover_url: track.cover_url,
      artist_name: track.artist_name,
      artist_slug: track.artist_slug,
      duration_seconds: track.duration_seconds,
      genre: track.genre,
      pricing_model: track.pricing_model,
      price_amount: track.price_amount,
      price_currency: track.price_currency,
      preview_seconds: track.preview_seconds,
    });
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!track || !user) throw new Error("Connecte-toi pour liker cette piste.");
      return toggleTrackLike(track, user.id);
    },
    onSuccess: (result) => {
      toast.success(result.is_liked ? "Piste ajoutée aux favoris" : "Piste retirée des favoris");
      // (live: sendLike removed)
      if (result.is_liked) {
        import("@/components/RewardOverlay").then(({ triggerReward }) => triggerReward("like"));
      }
      qc.invalidateQueries({ queryKey: ["track", slug] });
      qc.invalidateQueries({ queryKey: ["favourites", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // (commentMutation removed — handled by ThreadedComments)

  const playlistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      if (!track || !user) throw new Error("Connecte-toi pour ajouter à une playlist.");
      await addTrackToPlaylist(playlistId, track.id, user.id);
    },
    onSuccess: () => toast.success("Piste ajoutée à la playlist"),
    onError: (error: Error) => toast.error(error.message),
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connecte-toi pour créer une playlist.");
      const title = playlistTitle.trim();
      if (!title) throw new Error("Donne un nom à la playlist.");
      return createPlaylist(user.id, title);
    },
    onSuccess: () => {
      setPlaylistTitle("");
      toast.success("Playlist créée");
      qc.invalidateQueries({ queryKey: ["my-playlists", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // (deleteCommentMutation removed — handled by ThreadedComments)

  const lyricsMutation = useMutation({
    mutationFn: async () => {
      if (!track) throw new Error("Piste introuvable.");
      const value = lyricsDraft.trim();
      await updateTrackLyrics(track.id, value ? value : null);
    },
    onSuccess: () => {
      toast.success("Paroles mises à jour");
      setEditingLyrics(false);
      qc.invalidateQueries({ queryKey: ["track", slug] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const shareTrack = async () => {
    if (!track) return;
    const url = `${window.location.origin}/tracks/${track.slug}`;
    const text = `🎵 ${track.title}${track.artist_name ? ` — ${track.artist_name}` : ""} sur VinaSound\n${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: track.title, text, url });
        return;
      }
    } catch {
      // fall through to WhatsApp
    }
    window.open(waUrl, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié — partage sur WhatsApp ouvert");
    } catch {
      toast.success("Partage WhatsApp ouvert");
    }
  };

  // (live host/video controls removed)


  if (isLoading) {
    return (
      <AuthGate>
        <div className="space-y-6 animate-pulse">
          <div className="rounded-xl border border-border bg-surface/40 p-6 md:p-8 space-y-6">
            <div className="h-4 w-40 rounded bg-muted/50" />
            <div className="h-10 w-3/4 rounded bg-muted/60" />
            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              <div className="aspect-square rounded-xl bg-muted/50" />
              <div className="space-y-4">
                <div className="h-24 rounded bg-muted/40" />
                <div className="h-9 w-2/3 rounded bg-muted/50" />
              </div>
            </div>
          </div>
          <div className="h-40 rounded-xl bg-surface/40 border border-border" />
        </div>
      </AuthGate>
    );
  }

  if (!track) {
    return <AuthGate><EmptyState title="Piste introuvable" hint="Le lien est invalide ou la piste n'est plus disponible." /></AuthGate>;
  }

  const grad = gradientFor(track.title);
  const releasedYear = track.released_at ? new Date(track.released_at).getFullYear() : "—";
  const releasedLabel = track.released_at
    ? new Date(track.released_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : `${releasedYear}`;

  return (
    <AuthGate>
      <div className="space-y-6">


        {/* Premium CTA + mini file d'attente — bandeau du haut */}
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-stretch">
          <Link
            to="/go-pro"
            className="group relative overflow-hidden rounded-2xl border-2 border-[#FF6B00] bg-gradient-to-r from-[#FF6B00] to-[#FF9900] px-4 py-3 flex items-center gap-3 shadow-[0_6px_24px_rgba(255,107,0,0.45)] hover:shadow-[0_10px_30px_rgba(255,107,0,0.6)] hover:brightness-110 transition-all"
          >
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-white text-[#FF6B00] shadow-[0_4px_15px_rgba(0,0,0,0.25)] shrink-0">
              <Crown className="w-4 h-4 text-[#FF6B00]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                Passe en Premium
              </p>
              <p className="text-[11px] font-semibold text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                Hi‑Fi sans pub · file d'attente illimitée · téléchargements
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white text-[#FF6B00] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest shadow-md group-hover:scale-105 transition-transform">
              <Sparkles className="w-3 h-3" /> Découvrir
            </span>
          </Link>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur px-4 py-2.5 flex items-center gap-3 min-w-0">
            <ListMusic className="w-4 h-4 text-primary-glow shrink-0" />
            <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground shrink-0">
              À suivre
            </p>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {queue.length === 0 ? (
                <span className="text-xs text-muted-foreground truncate">File d'attente vide</span>
              ) : (
                queue.slice(queueIndex + 1, queueIndex + 4).map((t) => (
                  <div
                    key={t.id}
                    className="group flex items-center gap-1.5 rounded-full bg-background/60 hover:bg-primary/20 pl-1.5 pr-1 py-1 transition-colors shrink-0 max-w-[220px]"
                  >
                    <Link
                      to="/tracks/$slug"
                      params={{ slug: t.slug }}
                      className="flex items-center gap-1.5 min-w-0"
                    >
                      {t.cover_url ? (
                        <img src={t.cover_url} alt="" className="w-5 h-5 rounded object-cover" />
                      ) : (
                        <span className="w-5 h-5 rounded bg-gradient-to-br from-primary to-accent-cyan" />
                      )}
                      <span className="text-[11px] font-semibold truncate group-hover:text-primary-glow transition-colors">{t.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => playTrack(t)}
                      title="Écouter maintenant"
                      aria-label={`Écouter ${t.title} maintenant`}
                      className="ml-1 grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent-cyan text-white hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                    </button>
                  </div>
                ))
              )}
              {queue.length > queueIndex + 4 && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">+{queue.length - queueIndex - 4}</span>
              )}
            </div>
          </div>
        </div>

        {/* Hero immersif — Cinematic NextGen */}
        <section className="relative rounded-[32px] overflow-hidden border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_120px_rgba(255,170,0,0.08)] p-6 md:p-12 bg-[linear-gradient(135deg,#0a0a0a_0%,#151515_45%,#0d0d0f_100%)]">
          {/* Deep cinematic vignette — bottom heavy for text legibility */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.55)_0%,rgba(5,5,5,0.85)_60%,rgba(5,5,5,0.97)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,176,0,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(255,45,85,0.14),transparent_55%)]" />
          <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-[#FFB000]/20 blur-[140px] animate-float-slow" />
          <div className="absolute -bottom-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-[#FF2D55]/15 blur-[140px] animate-float-slow" style={{ animationDelay: "3s" }} />

          {/* Decorative background headphones — NOT the cover. Sized per breakpoint
              so it never crops the waveform or the player controls. */}
          <div
            aria-hidden="true"
            role="presentation"
            tabIndex={-1}
            className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] md:w-[105%] lg:w-[95%] max-w-[1400px] aspect-square z-0 animate-headphone-zoom"
          >
            {/* Warm orange halo behind */}
            <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,140,0,0.32)_0%,rgba(255,90,0,0.12)_45%,transparent_70%)] blur-3xl" />
            <img
              src={decorativeHeadphones}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width={1400}
              height={1400}
              className="relative w-full h-full object-contain opacity-[0.18] md:opacity-[0.22] blur-[1px] md:blur-[1.5px] animate-headphone-float drop-shadow-[0_40px_80px_rgba(0,0,0,0.7)]"
            />
          </div>

          <div className="relative z-20 flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
            {/* Cover — REAL artist pochette (small, left, premium glass, fully visible) */}
            <div className="flex flex-row gap-3 items-start shrink-0">
              <div className="relative group animate-headphone-float">
                <div
                  aria-hidden
                  className={`absolute -inset-4 rounded-[2rem] blur-2xl transition-opacity duration-700 ${
                    isPlayingThis ? "opacity-90" : "opacity-50"
                  }`}
                  style={{ background: "conic-gradient(from 0deg, #7c3aed, #2563eb, #ec4899, #7c3aed)" }}
                />
                <div className={`relative w-56 h-56 md:w-72 md:h-72 rounded-3xl overflow-hidden bg-gradient-to-br ${grad} shadow-[0_35px_90px_-15px_rgba(0,0,0,0.95),0_0_0_2px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] ring-2 ring-white/25 backdrop-blur-xl`}>
                  <img src={TRACK_POCHETTE_COVER} alt={track.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-3xl pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Center */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-6 text-center lg:text-left">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-primary-glow mb-3">
                  {track.genre || "Titre"}
                </p>
                <h1
                  className="font-display font-black leading-[0.92] bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
                  style={{ fontSize: "clamp(48px, 6vw, 88px)", letterSpacing: "-0.04em" }}
                >
                  {track.title}
                </h1>

                <div className="mt-4 flex items-center justify-center lg:justify-start gap-2 text-base">
                  <Link to="/artists/$slug" params={{ slug: track.artist_slug }} className="font-semibold hover:text-primary-glow transition">
                    {track.artist_name}
                  </Link>
                </div>
                <div className="mt-3 flex items-center justify-center lg:justify-start gap-2.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Play className="w-3 h-3 fill-current" />
                    <span className="tabular-nums font-semibold text-foreground/80">{track.plays.toLocaleString()}</span> écoutes
                  </span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>{releasedLabel}</span>
                  {track.genre && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary-glow font-semibold">
                        #{track.genre}
                      </span>
                    </>
                  )}
                </div>

              </div>


              {/* Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={handlePlay}
                  aria-label={isPlayingThis ? "Pause" : "Lecture"}
                  className="track-play-button group/play relative inline-flex items-center gap-3 pl-2 pr-7 py-2 rounded-full font-bold tracking-wide hover:scale-[1.04] active:scale-[0.98] transition-all"
                >
                  <span className="track-play-icon grid place-items-center w-11 h-11 rounded-full backdrop-blur group-hover/play:rotate-12 transition-transform">
                    {isPlayingThis ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </span>
                  <span className="text-base">{isPlayingThis ? "Pause" : "Lecture"}</span>
                </button>
                <button
                  onClick={() => likeMutation.mutate()}
                  disabled={likeMutation.isPending}
                  data-active={track.is_liked ? "true" : "false"}
                  className="track-icon-button grid place-items-center w-12 h-12 rounded-full transition-all hover:scale-110 active:scale-95 disabled:opacity-60"
                  aria-label="J'aime"
                >
                  {likeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${track.is_liked ? "fill-current" : ""}`} />}
                </button>
                <button onClick={shareTrack} className="track-icon-button grid place-items-center w-12 h-12 rounded-full transition-all hover:scale-110 active:scale-95" aria-label="Partager">
                  <Share2 className="w-5 h-5" />
                </button>
                <RepostButton trackId={track.id} />


                <button className="track-secondary-button inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]">
                  <UserPlus className="w-4 h-4" /> Suivre
                </button>
              </div>

              {/* Premium waveform wrapped in floating panel */}
              <div className="relative rounded-2xl glass p-4 md:p-5 bg-[rgba(245,238,220,0.55)] ring-1 ring-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
                  style={{
                    background:
                      "radial-gradient(120% 60% at 50% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
                  }}
                />

                <div className="relative">
                  <PremiumWaveform
                    url={track.audio_url ?? null}
                    isCurrent={isCurrent}
                    isPlaying={isPlayingThis}
                    height={88}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] tabular-nums text-foreground/80">
                    <span className="font-mono font-bold text-foreground">{formatSeconds(isCurrent ? playerPosition : 0)}</span>
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
                        <span className="w-3 h-3 rounded-sm bg-[linear-gradient(180deg,var(--primary-glow),var(--primary),var(--accent-cyan))] shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
                        Lu
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px] text-foreground/60">
                        <span className="w-3 h-3 rounded-sm bg-[rgba(18,14,36,0.85)]" />
                        À venir
                      </span>
                      <span className="inline-flex items-center gap-2 text-pink-500 font-bold uppercase tracking-widest text-[10px]">
                        <Heart className="w-3 h-3 fill-current" />
                        {track.likes.toLocaleString()} fans
                      </span>
                    </div>
                    <span className="font-mono font-bold text-foreground">{formatSeconds(isCurrent ? playerDuration : track.duration_seconds ?? 0)}</span>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Buy / Download banner */}
          {(track.pricing_model === "paid" || purchaseInfo?.hasAccess) && (
            <div className="relative mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {purchaseInfo?.hasAccess ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Check className="w-4 h-4" />
                    {purchaseInfo.isOwner ? "Ta piste" : track.pricing_model === "paid" ? "Déjà acheté" : "Accès libre"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    Aperçu {track.preview_seconds ?? 30}s — débloque la piste complète
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {purchaseInfo?.hasAccess && (
                  <button
                    onClick={async () => {
                      try {
                        const { resolveAudioUrl } = await import("@/lib/player");
                        const res = await resolveAudioUrl(
                          {
                            id: track.id,
                            artist_id: track.artist_id,
                            title: track.title,
                            slug: track.slug,
                            audio_url: track.audio_url,
                            cover_url: track.cover_url ?? null,
                            artist_name: track.artist_name,
                            artist_slug: track.artist_slug,
                            pricing_model: track.pricing_model,
                          },
                          { mode: "full" },
                        );
                        const r = await fetch(res.url);
                        if (!r.ok) throw new Error("Téléchargement impossible.");
                        const blob = await r.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const ext = (track.audio_url?.split(".").pop() || "mp3").split("?")[0];
                        a.download = `${track.title}.${ext}`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        toast.error((e as Error).message || "Téléchargement impossible.");
                      }
                    }}
                    className="track-secondary-button inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" /> Télécharger
                  </button>
                )}
                {track.pricing_model === "paid" && !purchaseInfo?.hasAccess && (
                  <>
                    <button
                      onClick={() => buyMutation.mutate()}
                      disabled={buyMutation.isPending || !purchaseInfo}
                      className="track-secondary-button inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
                      title="Payer pour télécharger"
                    >
                      <Download className="w-4 h-4" /> Télécharger
                    </button>
                    <button
                      onClick={() => buyMutation.mutate()}
                      disabled={buyMutation.isPending || !purchaseInfo}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent-cyan text-white font-bold shadow-glow-purple disabled:opacity-60 hover:scale-[1.03] transition-all"
                    >
                      {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                      Payer {formatPrice(track.price_amount ?? 0, track.price_currency ?? "XOF")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-6 min-w-0">
            {/* Premium tabs — Spotify/Apple Podcasts inspired */}
            <PremiumTabs
              tabs={[
                { id: "about", label: "À propos", icon: <FileText className="w-3.5 h-3.5" /> },
                { id: "comments", label: "Commentaires", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "chapters", label: "Chapitres", icon: <ListMusic className="w-3.5 h-3.5" /> },
                { id: "recos", label: "Recommandations", icon: <Music2 className="w-3.5 h-3.5" /> },
              ]}
            >
              {(active) => (
                <>
                  {active === "about" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab("description")}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                            activeTab === "description"
                              ? "bg-white/10 text-foreground ring-1 ring-white/15"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Description
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("lyrics")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                            activeTab === "lyrics"
                              ? "bg-white/10 text-foreground ring-1 ring-white/15"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" /> Paroles
                        </button>
                      </div>

                      {activeTab === "description" ? (
                        <div className="space-y-3 text-[15px] text-foreground/85 leading-7">
                          {track.description ? <p>{track.description}</p> : <p className="text-muted-foreground">Aucune description.</p>}
                          {track.genre && (
                            <p>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/15 text-primary-glow text-xs font-bold tracking-wide">
                                #{track.genre}
                              </span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {editingLyrics ? (
                            <>
                              <textarea
                                value={lyricsDraft}
                                onChange={(e) => setLyricsDraft(e.target.value)}
                                rows={14}
                                maxLength={20000}
                                placeholder="Colle ici les paroles du morceau…"
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 whitespace-pre-wrap transition"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => lyricsMutation.mutate()}
                                  disabled={lyricsMutation.isPending}
                                  className="inline-flex items-center justify-center gap-2 h-10 rounded-full bg-gradient-to-r from-primary to-accent-cyan text-white px-5 text-sm font-bold disabled:opacity-60 shadow-glow-purple hover:scale-[1.03] transition-all"
                                >
                                  {lyricsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enregistrer
                                </button>
                                <button
                                  onClick={() => { setEditingLyrics(false); setLyricsDraft(track.lyrics ?? ""); }}
                                  className="inline-flex items-center justify-center gap-2 h-10 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold hover:bg-white/10 transition-colors"
                                >
                                  <X className="w-4 h-4" /> Annuler
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {track.lyrics ? (
                                <pre className="text-[15px] text-foreground/90 leading-8 whitespace-pre-wrap font-sans">{track.lyrics}</pre>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {track.is_owner ? "Pas encore de paroles. Ajoute-les pour aider tes fans à chanter avec toi." : "L'artiste n'a pas encore publié les paroles de ce morceau."}
                                </p>
                              )}
                              {track.is_owner && (
                                <button
                                  onClick={() => { setLyricsDraft(track.lyrics ?? ""); setEditingLyrics(true); }}
                                  className="inline-flex items-center justify-center gap-2 h-9 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold hover:bg-white/10 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> {track.lyrics ? "Modifier les paroles" : "Ajouter les paroles"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {active === "comments" && (
                    <ThreadedComments trackId={track.id} isOwner={track.is_owner} />
                  )}

                  {active === "chapters" && (
                    <EmptyState
                      title="Pas de chapitres pour ce morceau"
                      hint="Les chapitres permettent de découper la piste en segments (intro, drop, outro…). Cette fonctionnalité arrive bientôt."
                    />
                  )}

                  {active === "recos" && (
                    <EmptyState
                      title="Recommandations à venir"
                      hint="Nous préparons des suggestions personnalisées basées sur ton historique d'écoute."
                    />
                  )}
                </>
              )}
            </PremiumTabs>
          </div>

          {/* Sticky right rail — Playlists */}
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto scrollbar-thin pr-1">


            <div className="relative rounded-[28px] glass-card p-6 space-y-5 overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(255,107,0,0.08)_0%,rgba(0,0,0,0)_70%)] blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-accent-cyan text-white shadow-glow-purple">
                    <ListMusic className="w-4 h-4" />
                  </span>
                  <h2 className="font-display text-lg font-extrabold leading-none tracking-tight">Playlists</h2>
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{playlists.length}</span>
              </div>

              <div className="relative flex gap-2">
                <input
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  placeholder="Nouvelle playlist"
                  className="flex-1 min-w-0 h-11 rounded-full border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                />
                <button
                  onClick={() => createPlaylistMutation.mutate()}
                  disabled={createPlaylistMutation.isPending || !playlistTitle.trim()}
                  className="inline-flex items-center justify-center gap-2 h-11 w-11 rounded-full bg-gradient-to-br from-primary to-accent-cyan text-white font-bold disabled:opacity-50 shadow-glow-purple hover:scale-105 active:scale-95 transition-all shrink-0"
                  aria-label="Créer une playlist"
                >
                  {createPlaylistMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative space-y-2">
                {playlists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Crée une playlist puis ajoute cette piste dedans.</p>
                ) : playlists.map((playlist) => (
                  <div key={playlist.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 px-4 py-3 transition-all">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-sm truncate leading-none">{playlist.title}</p>
                      <p className="text-xs text-muted-foreground truncate leading-none">{playlist.description || "Playlist personnelle"}</p>
                    </div>
                    <button
                      onClick={() => playlistMutation.mutate(playlist.id)}
                      disabled={playlistMutation.isPending}
                      className="inline-flex items-center justify-center gap-1.5 h-8 rounded-full bg-primary/15 text-primary-glow px-3 text-xs font-bold hover:bg-primary/25 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AuthGate>
  );
}

/* ---------- Premium Tabs (Spotify/Apple Podcasts inspired) ---------- */

interface PremiumTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface PremiumTabsProps {
  tabs: PremiumTab[];
  children: (active: string) => ReactNode;
}

function PremiumTabs({ tabs, children }: PremiumTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div className="relative rounded-[28px] glass-card overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(255,107,0,0.06)_0%,rgba(0,0,0,0)_70%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(255,107,0,0.05)_0%,rgba(0,0,0,0)_70%)] blur-3xl" />

      <div className="relative px-4 md:px-6 pt-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/30 border border-white/10 backdrop-blur-xl">
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? "text-white shadow-glow-purple"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-violet-500 to-accent-cyan"
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {t.icon}
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative p-5 md:p-7 animate-fade-in" key={active}>
        {children(active)}
      </div>
    </div>
  );
}
