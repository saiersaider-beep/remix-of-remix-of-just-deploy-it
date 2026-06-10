import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { StickyMiniPlayer } from "@/components/StickyMiniPlayer";
import { PlayerProvider } from "@/components/PlayerProvider";
import { PaywallModal } from "@/components/PaywallModal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";
import { AmbientPulse } from "@/components/AmbientPulse";
import { MotionGovernor } from "@/components/MotionGovernor";

import { RewardOverlay } from "@/components/RewardOverlay";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CommandPalette } from "@/components/CommandPalette";
import { InstallPrompt } from "@/components/InstallPrompt";
import { installServerFnAuth } from "@/lib/server-fn-auth";

if (typeof window !== "undefined") {
  installServerFnAuth();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  // Always log the full error to the server console for debugging — never to
  // the browser. Stack traces in the DOM leak internal file paths, module
  // names, and sometimes DB / API error fragments to anyone who can trigger
  // an error (attacker reconnaissance vector).
  console.error("[VinaSound ErrorBoundary]", error);
  const router = useRouter();
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {isDev && error?.message && (
          <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface/40 p-3 text-left text-xs text-rose-300">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Prevent browser auto-translators (Google Translate, etc.) from wrapping
      // React-managed text nodes — that mutation breaks reconciliation and
      // throws "NotFoundError: Failed to execute 'insertBefore' on 'Node'".
      { name: "google", content: "notranslate" },
      { httpEquiv: "Content-Language", content: "en" },
      { title: "VinaSound — La plateforme musicale #1 pour artistes africains" },
      {
        name: "description",
        content:
          "Stream, upload et partage la musique des artistes africains. Afrobeat, Amapiano, Drill, et bien plus.",
      },
      { name: "author", content: "VinaSound" },
      {
        property: "og:title",
        content: "VinaSound — La plateforme musicale #1 pour artistes africains",
      },
      {
        property: "og:description",
        content: "Stream, upload et partage la musique des artistes africains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/brand/logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const THEME_BOOT = `(function(){try{var k='vinasound-theme';var p=localStorage.getItem(k);var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=(p==='dark'||p==='light')?p:sys;var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.classList.toggle('light',t==='light');r.style.colorScheme=t;r.setAttribute('data-theme',t);}catch(e){}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="notranslate" translate="no">
        <div className="mobile-frame">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (!isAuthRoute) return;
    document.documentElement.classList.add("auth-route-root");
    document.body.classList.add("auth-route-body");
    return () => {
      document.documentElement.classList.remove("auth-route-root");
      document.body.classList.remove("auth-route-body");
    };
  }, [isAuthRoute]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionGovernor />
        {!isAuthRoute && <AmbientBackdrop />}
        {!isAuthRoute && <AmbientPulse />}
        {!isAuthRoute && <div className="app-vignette" aria-hidden />}
        {!isAuthRoute && <div className="app-noise" aria-hidden />}
        {!isAuthRoute && <AnnouncementBanner />}
        {!isAuthRoute && <ScrollReveal />}
        <div className={isAuthRoute ? "bg-black text-white" : "pb-28 md:pb-28"}>
          <div key={pathname} className={isAuthRoute ? "auth-route-page" : "gs-page"}>
            <Outlet />
          </div>
        </div>
        {!isAuthRoute && <PlayerProvider />}
        {!isAuthRoute && <StickyMiniPlayer />}
        {!isAuthRoute && <MobileBottomNav />}
        {!isAuthRoute && <PaywallModal />}
        {!isAuthRoute && <RewardOverlay />}
        {!isAuthRoute && <CommandPalette />}
        {!isAuthRoute && <InstallPrompt />}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
