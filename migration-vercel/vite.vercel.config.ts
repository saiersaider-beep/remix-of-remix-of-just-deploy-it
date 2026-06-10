// Remplace ton vite.config.ts actuel après l'export GitHub.
// Renomme ce fichier en `vite.config.ts` à la racine du projet.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    // TanStack Start avec preset Nitro "vercel" → génère .output/ compatible Vercel
    tanstackStart({
      target: "vercel",
      customViteReactPlugin: true,
      server: {
        entry: "./src/server.ts",
      },
    }),
    react(),
  ],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-start",
      "@tanstack/react-query",
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: true,
    target: "es2022",
  },
});
