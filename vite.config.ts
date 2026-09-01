// Nitro preset is chosen per environment:
// - sur Vercel (VERCEL=1) ou avec NITRO_PRESET=vercel -> build Vercel (.vercel/output)
// - sinon -> preset par défaut, requis par l'aperçu/le build Lovable (dist/)

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig(({ mode }) => {
  // Load .env (all vars, not only VITE_) into process.env so that
  // server functions / SSR middleware (e.g. requireSupabaseAuth) can read
  // SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in dev. Vite normally only
  // exposes VITE_* vars via import.meta.env and does NOT populate process.env.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    mcpPlugin(),
    nitro(
      process.env.VERCEL || process.env.NITRO_PRESET === "vercel"
        ? { preset: "vercel" }
        : { preset: "cloudflare_module", output: { dir: "dist" } },
    ),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: /^cloudflare:workers$/,
        replacement: new URL("./src/lib/shims/cloudflare-workers.ts", import.meta.url).pathname,
      },
    ],
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-start",
      "@tanstack/react-query",
    ],
  },
  server: { port: 5173, host: true },
  build: { sourcemap: true, target: "es2022" },
  };
});
