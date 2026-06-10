import { Link, useNavigate } from "@tanstack/react-router";
import { Music2, Pause, Play, Lock, Sparkles, ShoppingBag, Check } from "lucide-react";
import { useEffect } from "react";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";
import { gradientFor } from "@/components/PageScaffold";
import { formatPlays, formatPrice, type RealTrack } from "@/lib/tracks-data";
import { useAuth } from "@/hooks/use-auth";
import { SmartImage, preloadImages } from "@/components/SmartImage";


export function RealTrackCard({
  track,
  queue,
  ownedIds,
  size = "md",
}: {
  track: RealTrack;
  queue?: RealTrack[];
  ownedIds?: Set<string>;
  size?: "md" | "sm";
}) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const current = usePlayerStore(currentTrackSelector);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrent = current?.id === track.id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const grad = gradientFor(track.title);

  const isPaid = track.pricing_model === "paid";
  const owned = ownedIds?.has(track.id) ?? false;
  const price = track.price_amount ?? 0;
  const currency = track.price_currency || "XOF";

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      const back = encodeURIComponent(window.location.pathname + window.location.search);
      navigate({ to: "/login", search: { redirect: back } as never });
      return;
    }
    if (queue && queue.length > 1) {
      const idx = queue.findIndex((t) => t.id === track.id);
      playQueue(queue, Math.max(0, idx));
    } else {
      playTrack(track);
    }
  };

  const handleCardClick = () => {
    navigate({ to: "/tracks/$slug", params: { slug: track.slug } });
  };

  return (
    <div
      onClick={handleCardClick}
      className="group min-w-0 cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
    >
      <div className={`cover-3d relative aspect-square overflow-hidden bg-gradient-to-br ${grad}`}>
        {track.cover_url ? (
          <SmartImage
            src={track.cover_url}
            alt={track.title}
            wrapperClassName="absolute inset-0"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Music2 className="w-10 h-10 text-white/80" />
          </div>
        )}


        {/* Pricing badge top-left */}
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-full text-white shadow ${
            isPaid
              ? "bg-gradient-to-r from-amber-500 to-primary"
              : "bg-gradient-to-r from-emerald-500 to-teal-600"
          }`}
        >
          {isPaid ? <Lock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
          {isPaid ? "PAYANT" : "GRATUIT"}
        </span>

        {/* Owned badge */}
        {isPaid && owned && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/90 text-white shadow">
            <Check className="w-3 h-3" /> Acheté
          </span>
        )}

        {/* Preview badge bottom-right for paid */}
        {isPaid && !owned && (
          <span className="absolute bottom-2 right-2 inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
            10s preview
          </span>
        )}

        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition grid place-items-center">
          <button
            onClick={handlePlay}
            aria-label={isCurrent && isPlaying ? "Pause" : "Lire"}
            className="grid place-items-center w-12 h-12 rounded-full bg-primary text-primary-foreground hover:scale-105 transition"
          >
            {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      <div className="mt-3 px-0.5">
        <p className={`font-bold ${size === "sm" ? "text-xs" : "text-sm"} truncate group-hover:text-primary transition`}>
          {track.title}
        </p>
        {track.artist_slug ? (
          <Link
            to="/artists/$slug"
            params={{ slug: track.artist_slug }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground truncate hover:text-primary block"
          >
            {track.artist_name}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{formatPlays(track.plays)} lectures</span>
          {isPaid && !owned && (
            <span className="inline-flex items-center gap-1 font-bold text-amber-500">
              <ShoppingBag className="w-3 h-3" />
              {formatPrice(price, currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function RealTrackGrid({
  tracks,
  ownedIds,
}: {
  tracks: RealTrack[];
  ownedIds?: Set<string>;
}) {
  // Pre-decode every cover during idle time so scroll/back-nav is instant.
  useEffect(() => {
    preloadImages(tracks.map((t) => t.cover_url));
  }, [tracks]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
      {tracks.map((t) => (
        <RealTrackCard key={t.id} track={t} queue={tracks} ownedIds={ownedIds} />
      ))}
    </div>
  );
}

