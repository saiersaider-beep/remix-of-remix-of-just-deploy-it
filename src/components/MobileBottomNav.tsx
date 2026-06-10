import { Link, useLocation } from "@tanstack/react-router";
import { Home, Compass, Search, Wallet, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const items = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/discover", label: "Explorer", icon: Compass },
  { to: "/search", label: "Recherche", icon: Search },
  { to: "/wallet", label: "Portefeuille", icon: Wallet },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const profileTo = session ? "/dashboard" : "/login";

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 text-[10px] font-semibold uppercase tracking-wider">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            to={profileTo}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              pathname.startsWith(profileTo) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-5 h-5" />
            <span>{session ? "Moi" : "Connexion"}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}