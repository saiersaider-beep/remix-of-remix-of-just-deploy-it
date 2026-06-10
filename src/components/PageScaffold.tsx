import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/DashboardSidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandLoader } from "@/components/BrandLoader";
import { Play, MoreHorizontal } from "lucide-react";

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export type MediaKind = "album" | "playlist" | "track";

const detailRoute = {
  album: "/albums/$slug",
  playlist: "/playlists/$slug",
  track: "/tracks/$slug",
} as const;

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);
  if (loading || !session) {
    return <BrandLoader label="Chargement…" />;
  }
  return <DashboardShell>{children}</DashboardShell>;
}

/**
 * PublicShell — wraps a route in the public site chrome (SiteHeader +
 * SiteFooter) WITHOUT requiring authentication. Use for any page that
 * should be crawlable / shareable to visitors (discover, search, go-pro,
 * landing-style routes). If a logged-in user opens it, show the same
 * shell as anonymous — they can still navigate.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 pt-24 pb-12">
        <div className="mx-auto max-w-[1400px] px-6">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl font-extrabold">
          {accent && <span className="text-primary">{accent} </span>}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

const palette = [
  "from-rose-500 to-primary",
  "from-sky-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-fuchsia-500 to-purple-700",
  "from-amber-500 to-orange-700",
  "from-violet-500 to-indigo-800",
  "from-cyan-500 to-blue-700",
  "from-pink-500 to-rose-700",
  "from-lime-500 to-emerald-700",
  "from-red-500 to-rose-800",
];

export function gradientFor(seed: string | number) {
  const s = typeof seed === "string"
    ? seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    : seed;
  return palette[s % palette.length];
}

export function MediaCard({
  title,
  subtitle,
  badge,
  index,
  kind = "album",
  slug,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  index: number;
  kind?: MediaKind;
  slug?: string;
}) {
  return (
    <Link
      to={detailRoute[kind]}
      params={{ slug: slug ?? slugify(title) }}
      className="group min-w-0"
    >
      <div className={`relative aspect-square rounded-md overflow-hidden bg-gradient-to-br ${gradientFor(index + title)} shadow-md`}>
        {badge && (
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold bg-black/40 text-white rounded px-2 py-0.5">
            {badge}
          </span>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition grid place-items-center">
          <span className="grid place-items-center w-12 h-12 rounded-full bg-primary text-primary-foreground">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </span>
        </div>
      </div>
      <p className="mt-3 font-bold text-sm truncate group-hover:text-primary transition">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
    </Link>
  );
}

export function MediaGrid({
  items,
  kind = "album",
}: {
  items: { title: string; subtitle?: string; badge?: string; slug?: string }[];
  kind?: MediaKind;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
      {items.map((it, i) => (
        <MediaCard key={it.title + i} index={i} kind={kind} {...it} />
      ))}
    </div>
  );
}

export function TrackList({ rows }: { rows: { title: string; artist: string; time: string; slug?: string }[] }) {
  return (
    <ul className="divide-y divide-border bg-surface/40 border border-border rounded-md">
      {rows.map((row, i) => (
        <li key={row.title + i} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition group">
          <span className="font-display text-lg font-extrabold text-muted-foreground w-6 tabular-nums">
            {i + 1}
          </span>
          <div className={`w-10 h-10 rounded bg-gradient-to-br ${gradientFor(row.title)} shrink-0`} />
          <Link
            to="/tracks/$slug"
            params={{ slug: row.slug ?? slugify(row.title) }}
            className="flex-1 min-w-0"
          >
            <p className="font-bold text-sm truncate group-hover:text-primary transition">{row.title}</p>
            <p className="text-xs text-muted-foreground truncate">{row.artist}</p>
          </Link>
          <span className="text-xs text-muted-foreground tabular-nums">{row.time}</span>
          <button className="text-muted-foreground hover:text-foreground" aria-label="More">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-border rounded-md p-12 text-center">
      <p className="font-bold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}
