import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Sun, Moon, LogOut, User, MessageSquare, Menu, X, ShieldCheck } from "lucide-react";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { avatarOrDefault } from "@/lib/default-avatar";

export function SiteHeader() {
  const { session, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { logoUrl } = useSiteLogo();
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const avatarSrc = avatarOrDefault(
    (session?.user?.user_metadata?.avatar_url as string | undefined) ?? null,
    session?.user?.id ?? session?.user?.email ?? null,
  );

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    navigate({ to: "/search", search: { q: v } });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        scrolled || mobileOpen
          ? "backdrop-blur-xl bg-background/95 border-b border-border/60 shadow-lg shadow-black/20 py-2"
          : "bg-transparent py-4"
      }`}
      style={{ WebkitBackdropFilter: (scrolled || mobileOpen) ? "blur(16px)" : undefined }}
    >
      <div className="mx-auto max-w-[1400px] px-6 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="VinaSound home">
          <span className="grid place-items-center w-11 h-11 shrink-0">
            <img src={logoUrl} alt="VinaSound" loading="eager" decoding="async" fetchPriority="high" className="w-full h-full object-contain drop-shadow-lg" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            Vina<span className="text-gradient-primary">Sound</span>
          </span>
        </Link>


        <nav className="hidden md:flex items-center gap-7 ml-6 text-sm font-semibold uppercase tracking-wider">
          <Link to="/" className="text-primary relative after:content-[''] after:absolute after:left-0 after:-bottom-1.5 after:w-full after:h-0.5 after:bg-primary after:rounded-full">Accueil</Link>
          <Link to="/discover" className="text-foreground/80 hover:text-foreground transition-colors">Explorer</Link>
          <Link to="/interest" className="text-foreground/80 hover:text-foreground transition-colors">Centres d'intérêt</Link>
          <Link to="/go-pro" className="text-foreground/80 hover:text-primary transition-colors">Passer Pro</Link>
          <Link to="/about" className="text-foreground/80 hover:text-foreground transition-colors">À propos</Link>
        </nav>

        <form onSubmit={onSearch} className="flex-1 hidden lg:flex items-center max-w-md mx-auto">
          <div className="flex items-center w-full bg-surface/60 backdrop-blur border border-border/60 rounded-full overflow-hidden focus-within:border-primary transition">
            <Search className="w-4 h-4 text-muted-foreground ml-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher artistes, titres..."
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <div className="flex items-center gap-3 ml-auto text-sm font-semibold">
          <button
            onClick={toggle}
            className="grid place-items-center w-9 h-9 rounded-full border border-border/60 hover:border-primary hover:text-primary transition hover:rotate-12"
            aria-label={mounted ? `Passer en mode ${theme === "dark" ? "clair" : "sombre"}` : "Changer de thème"}
            title={mounted ? `Passer en mode ${theme === "dark" ? "clair" : "sombre"}` : "Changer de thème"}
          >
            {mounted ? (
              theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 opacity-0" />
            )}
          </button>
          {session ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition text-xs font-semibold"
                  title="Panneau admin"
                >
                  <ShieldCheck className="w-4 h-4" /> Panneau admin
                </Link>
              )}
              <Link
                to="/messages"
                search={{ c: undefined }}
                className="grid place-items-center w-9 h-9 rounded-full border border-border/60 hover:border-primary hover:text-primary transition"
                aria-label="Messages"
                title="Messages"
              >
                <MessageSquare className="w-4 h-4" />
              </Link>
              <Link
                to="/discover"
                className="hidden sm:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border/60 hover:border-primary transition"
              >
                <span className="grid place-items-center w-7 h-7 rounded-full overflow-hidden ring-1 ring-border/60">
                  <img src={avatarSrc} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </span>

                <span className="text-xs">Ma musique</span>
              </Link>
              <button
                onClick={() => signOut()}
                className="hidden sm:grid place-items-center w-9 h-9 rounded-full border border-border/60 hover:border-destructive hover:text-destructive transition"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:text-primary transition">
                <User className="w-4 h-4" /> Connexion
              </Link>
              <Link
                to="/signup"
                className="hidden sm:inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition shadow-lg shadow-primary/30"
              >
                S'inscrire
              </Link>
            </>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden grid place-items-center w-9 h-9 rounded-full border border-border/60"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden mx-auto max-w-[1400px] px-6 mt-3 pb-4 flex flex-col gap-3 border-t border-border/60 pt-4 bg-background">
          <form onSubmit={onSearch} className="flex items-center gap-2 bg-surface/60 border border-border/60 rounded-full px-4 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <Link to="/" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm font-semibold">Accueil</Link>
          <Link to="/discover" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm font-semibold">Explorer</Link>
          <Link to="/interest" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm font-semibold">Centres d'intérêt</Link>
          <Link to="/go-pro" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm font-semibold">Passer Pro</Link>
          <Link to="/about" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm font-semibold">À propos</Link>
          {!session && (
            <div className="flex gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-3 py-2 rounded-full border border-border">Connexion</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-3 py-2 rounded-full bg-primary text-primary-foreground">S'inscrire</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
