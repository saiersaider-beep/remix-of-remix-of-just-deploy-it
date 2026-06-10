import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { BrandLoader } from "@/components/BrandLoader";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Re-use data across page navigations for instant rendering. Pages
        // still revalidate in the background when stale.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Re-use preloaded route data for 30s so back/forward & repeat nav is instant.
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPendingComponent: () => <BrandLoader label="Chargement…" />,
  });


  return router;
};
