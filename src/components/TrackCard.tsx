import { Link } from "@tanstack/react-router";
import { Play, Heart, MoreHorizontal, TrendingUp, Flame } from "lucide-react";
import { useEffect, useState } from "react";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "track";

export interface Track {
  title: string;
  artist: string;
  cover: string;
  plays: number;
  trend?: "hot" | "new" | "rising";
  duration?: string;
}

function formatPlays(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function useCountUp(target: number, duration = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

const trendConfig = {
  hot: { label: "HOT", icon: Flame, gradient: "from-primary to-rose-600" },
  new: { label: "NEW", icon: TrendingUp, gradient: "from-amber-500 to-primary" },
  rising: { label: "RISING", icon: TrendingUp, gradient: "from-cyan-400 to-amber-500" },
} as const;

export function TrackCard({ track }: { track: Track }) {
  const plays = useCountUp(track.plays);
  const badge = track.trend ? trendConfig[track.trend] : null;

  return (
    <div className="group relative">
      <Link
        to="/tracks/$slug"
        params={{ slug: slugify(track.title) }}
        className="block"
      >
        {/* Cover with hover overlay */}
        <div className="cover-3d relative aspect-square overflow-hidden glass transition-all duration-500 group-hover:-translate-y-1">
          <img
            src={track.cover}
            alt={track.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />


          {/* Gradient veil */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Trend badge */}
          {badge && (
            <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-full bg-gradient-to-r ${badge.gradient} text-white shadow-lg`}>
              <badge.icon className="w-3 h-3" />
              {badge.label}
            </span>
          )}

          {/* Like button */}
          <button
            onClick={(e) => { e.preventDefault(); }}
            className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full glass-strong text-white/80 hover:text-primary hover:scale-110 transition opacity-0 group-hover:opacity-100"
            aria-label="Favorite"
          >
            <Heart className="w-4 h-4" />
          </button>

          {/* Mini equalizer at bottom (hover) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end gap-0.5 h-6 opacity-0 group-hover:opacity-100 transition-opacity">
            {[8, 14, 10, 18, 12, 20, 9, 15, 11, 17, 8, 13, 16, 10, 14].map((h, i) => (
              <span
                key={i}
                className="flex-1 bg-gradient-to-t from-amber-500 to-primary rounded-full eq-bar"
                style={{ height: `${h * 4}%`, animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>

          {/* Big play button center */}
          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={(e) => { e.preventDefault(); }}
              className="grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-primary text-white shadow-glow scale-90 group-hover:scale-100 transition-transform duration-300"
              aria-label="Lire"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-3 px-1">
          <p className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-gradient-primary transition">
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{track.artist}</p>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Play className="w-3 h-3 fill-current text-amber-400" />
              {formatPlays(plays)}
            </span>
            {track.duration && <span className="tabular-nums">{track.duration}</span>}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function TrackGrid({ tracks }: { tracks: Track[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {tracks.map((t) => (
        <TrackCard key={t.title + t.artist} track={t} />
      ))}
    </div>
  );
}
