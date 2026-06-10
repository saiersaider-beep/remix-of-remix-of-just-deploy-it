import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Compass,
  Music2,
  Users,
  Heart,
  ListMusic,
  Upload,
  Wallet,
  Bell,
  Settings,
  TrendingUp,
  Headphones,
  Search,
  User,
  Star,
} from "lucide-react";

type Action = {
  label: string;
  icon: typeof Home;
  to: string;
  keywords?: string;
  shortcut?: string;
};

const NAV: Action[] = [
  { label: "Accueil", icon: Home, to: "/", keywords: "home" },
  { label: "Découvrir", icon: Compass, to: "/discover", keywords: "explore discover" },
  { label: "Recherche", icon: Search, to: "/search" },
  { label: "Top musique", icon: TrendingUp, to: "/top_music", keywords: "trending charts" },
  { label: "Nouveautés", icon: Music2, to: "/new_music", keywords: "new releases" },
  { label: "Genres", icon: Headphones, to: "/genres" },
  { label: "Spotlight", icon: Star, to: "/spotlight" },
  { label: "Albums", icon: Music2, to: "/albums" },
  { label: "Playlists", icon: ListMusic, to: "/playlists" },
];

const LIBRARY: Action[] = [
  { label: "Mes favoris", icon: Heart, to: "/favourites" },
  { label: "Mes playlists", icon: ListMusic, to: "/my_playlists" },
  { label: "Mes sons", icon: Music2, to: "/my-songs" },
  { label: "Mes albums", icon: Music2, to: "/my-albums" },
  { label: "Récemment écouté", icon: Headphones, to: "/recently_played" },
  { label: "Abonnements", icon: Users, to: "/following" },
];

const ACCOUNT: Action[] = [
  { label: "Profil", icon: User, to: "/profile" },
  { label: "Wallet", icon: Wallet, to: "/wallet" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Paramètres", icon: Settings, to: "/settings" },
  { label: "Passer Pro", icon: Star, to: "/go-pro", keywords: "premium upgrade" },
];

const ACTIONS: Action[] = [
  { label: "Publier un titre", icon: Upload, to: "/upload-song", keywords: "new upload" },
  { label: "Publier un album", icon: Upload, to: "/upload-album" },
  { label: "Devenir artiste", icon: Star, to: "/become", keywords: "creator" },
];

/**
 * Global command palette (Cmd+K / Ctrl+K). Mounted once at the root.
 * Use to fuzzy-jump to any major section.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    // Tanstack navigate is typed-strict; we cast since destinations come from a static list.
    navigate({ to: to as never });
  };

  const renderGroup = (title: string, items: Action[]) => (
    <CommandGroup heading={title}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <CommandItem
            key={it.to}
            value={`${it.label} ${it.keywords ?? ""} ${it.to}`}
            onSelect={() => go(it.to)}
            className="gap-3"
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span>{it.label}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono">{it.to}</span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command shouldFilter>
        <CommandInput placeholder="Cherche une page, une action…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          {renderGroup("Navigation", NAV)}
          <CommandSeparator />
          {renderGroup("Bibliothèque", LIBRARY)}
          <CommandSeparator />
          {renderGroup("Compte", ACCOUNT)}
          <CommandSeparator />
          {renderGroup("Actions", ACTIONS)}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/**
 * Tiny button to open the palette — render in a header.
 * Optional; the keyboard shortcut works without it.
 */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
        window.dispatchEvent(ev);
      }}
      className="hidden md:inline-flex items-center gap-2 rounded-full bg-surface/60 hover:bg-surface ring-1 ring-white/10 px-3 py-1.5 text-xs text-muted-foreground transition"
      aria-label="Ouvrir la recherche rapide"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Recherche rapide</span>
      <CommandShortcut className="ml-2">⌘K</CommandShortcut>
    </button>
  );
}
