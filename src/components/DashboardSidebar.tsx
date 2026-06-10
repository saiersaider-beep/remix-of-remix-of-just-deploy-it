import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Home, Compass, TrendingUp, Disc3, Mic2,
  ListMusic, Award, Menu, X, Search,
  Upload, Bell, MessageSquare, Heart, History,
  BarChart3, Sparkles, Shield, LogOut, Music2,
  Crown, Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuth } from "@/hooks/use-auth";
import { avatarOrDefault } from "@/lib/default-avatar";
import { fetchRecentlyPlayed } from "@/lib/listening-history";
import { BrandMark } from "@/components/BrandMark";


type Item = { icon: any; label: string; to: string };

const mainNav: Item[] = [
  { icon: Home, label: "Accueil", to: "/" },
  { icon: Compass, label: "Explorer", to: "/discover" },
  { icon: TrendingUp, label: "Tendances", to: "/top_music" },
  { icon: Sparkles, label: "Nouveautés", to: "/new_music" },
];

const libraryNav: Item[] = [
  { icon: Music2, label: "Ma musique", to: "/my-songs" },
  { icon: ListMusic, label: "Playlists", to: "/my_playlists" },
  { icon: Disc3, label: "Albums", to: "/my-albums" },
  { icon: Mic2, label: "Artistes", to: "/following" },
  { icon: Heart, label: "Titres aimés", to: "/favourites" },
  { icon: History, label: "Historique", to: "/recently_played" },
];

const creatorNav: Item[] = [
  { icon: BarChart3, label: "Tableau de bord", to: "/dashboard" },
  { icon: Upload, label: "Uploader", to: "/upload-song" },
  { icon: Award, label: "Hall of Fame", to: "/fame" },
];

const adminItems: Item[] = [
  { icon: Shield, label: "Admin", to: "/admin" },
];

function NavItem({ item, collapsed, onNavigate }: { item: Item; collapsed: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      data-active={active}
      className={`group relative flex items-center gap-3 ${collapsed ? "justify-center px-0" : "px-4"} py-2.5 rounded-2xl transition-all duration-300 hover:translate-x-1 ${
        active
          ? "text-white"
          : "text-[rgba(255,255,255,0.72)] hover:text-white hover:bg-white/[0.03]"
      }`}
    >
      {/* Left amber indicator bar — appears on active */}
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-full bg-[#FFB000] shadow-[0_0_12px_rgba(255,176,0,0.7)]"
        />
      )}
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-2xl bg-[linear-gradient(90deg,rgba(255,170,0,0.18),rgba(255,90,0,0.04))] border border-[rgba(255,170,0,0.25)]"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={`relative w-[18px] h-[18px] shrink-0 transition-colors ${active ? "text-[#FFB000]" : "group-hover:text-white"}`} />
      {!collapsed && <span className="relative text-sm font-semibold truncate">{item.label}</span>}
      {active && !collapsed && (
        <span className="relative ml-auto w-1.5 h-1.5 rounded-full bg-[#FFB000] shadow-[0_0_10px_rgba(255,176,0,0.8)]" />
      )}
    </Link>
  );
}


function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const { data: recent = [] } = useQuery({
    queryKey: ["sidebar-recent", user?.id],
    enabled: !!user?.id && !collapsed,
    queryFn: () => fetchRecentlyPlayed(3),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-6 px-3 pb-6">
      <div className="space-y-1">
        {mainNav.map((it) => <NavItem key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />)}
      </div>

      {!collapsed && (
        <p className="px-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold">Bibliothèque</p>
      )}
      <div className={`space-y-1 ${collapsed ? "-mt-3" : ""}`}>
        {libraryNav.map((it) => <NavItem key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />)}
      </div>

      {!collapsed && (
        <p className="px-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold">Créateur</p>
      )}
      <div className={`space-y-1 ${collapsed ? "-mt-3" : ""}`}>
        {creatorNav.map((it) => <NavItem key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />)}
      </div>

      {isAdmin && (
        <div className="space-y-1">
          {adminItems.map((it) => <NavItem key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />)}
        </div>
      )}

      {/* ─── Récents ─── (same disposition as the reference: small cover + title + meta) */}
      {!collapsed && recent.length > 0 && (
        <div className="space-y-2">
          <p className="px-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold">
            Récents
          </p>
          <ul className="space-y-1.5 px-1">
            {recent.slice(0, 3).map((t) => (
              <li key={t.id}>
                <Link
                  to="/tracks/$slug"
                  params={{ slug: t.slug }}
                  onClick={onNavigate}
                  className="group flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-white/[0.05] transition-colors"
                >
                  {t.cover_url ? (
                    <img
                      src={t.cover_url}
                      alt=""
                      loading="lazy"
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-cyan grid place-items-center shrink-0">
                      <Music2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      Épisode ·{" "}
                      {Math.max(1, Math.round((t.duration_seconds ?? 0) / 60))} min
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!collapsed && (
        <Link
          to="/go-pro"
          onClick={onNavigate}
          className="btn-passer-pro mt-3 mx-3 justify-center"
        >
          <span className="btn-passer-pro__icon"><Star /></span>
          Passer à Pro
        </Link>
      )}

    </div>
  );
}


export function DashboardSidebar({ collapsed = false }: { collapsed?: boolean } = {}) {
  return (
    <aside
      className={`${collapsed ? "w-[88px]" : "w-[260px]"} shrink-0 sticky top-4 h-[calc(100vh-2rem)] hidden lg:flex flex-col ml-4 my-4 rounded-3xl backdrop-blur-2xl bg-[rgba(10,10,10,0.88)] border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.55),0_0_80px_rgba(255,170,0,0.06)] transition-all duration-300 overflow-hidden`}
    >

      <div className={`flex items-center ${collapsed ? "justify-center px-0" : "px-5"} pt-6 pb-4 shrink-0`}>
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={40} />
          {!collapsed && (
            <span className="font-display text-xl font-extrabold tracking-tight">
              Vina<span className="text-gradient-primary">Sound</span>
            </span>
          )}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SidebarBody collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function DashboardTopbar({ onToggleSidebar }: { onToggleSidebar?: () => void } = {}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  const avatarSrc = avatarOrDefault(
    (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    user?.id ?? user?.email ?? null,
  );
  const handleName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "Compte";

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    navigate({ to: "/search", search: { q: v } });
  };

  return (
    <>
      <header className="sticky top-0 z-30 backdrop-blur-2xl bg-background/40 border-b border-white/5">
        <div className="flex min-w-0 items-center gap-3 px-4 lg:px-8 py-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden grid place-items-center w-10 h-10 rounded-2xl hover:bg-white/5 transition"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="hidden lg:grid place-items-center w-10 h-10 rounded-2xl hover:bg-white/5 transition text-muted-foreground hover:text-foreground"
              aria-label="Replier la sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="lg:hidden flex items-center gap-2">
            <BrandMark size={36} />
            <span className="font-display font-extrabold">Vina<span className="text-gradient-primary">Sound</span></span>
          </Link>

          <form onSubmit={onSearch} className="hidden min-w-0 flex-1 md:flex md:max-w-none lg:mx-auto lg:max-w-2xl">
            <div className="group flex min-w-0 items-center w-full bg-white/[0.04] hover:bg-white/[0.06] focus-within:bg-white/[0.08] border border-white/[0.06] focus-within:border-primary/40 rounded-full px-5 py-3 transition-all">
              <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Rechercher un titre, un artiste, une playlist..."
              />
              <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-white/5 px-2 py-1 rounded">⌘K</kbd>
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              to="/go-pro"
              className="btn-passer-pro hidden lg:inline-flex"
            >
              <span className="btn-passer-pro__icon"><Star /></span>
              Passer à Pro
            </Link>

            <Link to="/upload-song" className="hidden sm:grid place-items-center w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition" aria-label="Publier">
              <Upload className="w-4 h-4" />
            </Link>
            <Link to="/messages" search={{ c: undefined }} className="hidden sm:grid place-items-center w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition" aria-label="Messages">
              <MessageSquare className="w-4 h-4" />
            </Link>
            <Link to="/notifications" className="relative grid place-items-center w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition" aria-label="Notifications">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500 shadow-glow-pink" />
            </Link>
            <Link to="/profile" className="flex items-center gap-0 lg:gap-2 pl-1 pr-1 lg:pr-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] transition">
              <span className="grid place-items-center w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
              </span>
              <span className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-xs font-bold truncate max-w-[110px]">{handleName}</span>
                <span className="text-[10px] text-primary-glow">Abonné</span>
              </span>
            </Link>
            <button
              onClick={() => signOut()}
              className="hidden sm:grid place-items-center w-10 h-10 rounded-2xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 bottom-0 w-[280px] glass-strong overflow-y-auto py-4">
            <div className="flex items-center justify-between px-6 mb-4">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                <BrandMark size={36} />
                <span className="font-display font-extrabold">Vina<span className="text-gradient-primary">Sound</span></span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="grid place-items-center w-9 h-9 rounded-2xl hover:bg-white/5" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex relative overflow-hidden">
      {/* Ambient gradients */}
      <div className="ambient-blob w-[500px] h-[500px] -top-20 -left-32 bg-primary/30 animate-float-slow" />
      <div className="ambient-blob w-[600px] h-[600px] top-1/3 -right-40 bg-accent-cyan/20 animate-float-slow" style={{ animationDelay: "2s" }} />

      <DashboardSidebar collapsed={collapsed} />
      <div className="flex-1 min-w-0 relative z-10">
        <DashboardTopbar onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="px-4 sm:px-6 lg:px-8 py-6 pb-40">{children}</main>
      </div>
    </div>
  );
}
