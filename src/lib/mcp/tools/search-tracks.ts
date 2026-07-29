import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function anonClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_tracks",
  title: "Rechercher des morceaux",
  description:
    "Recherche des morceaux publiés sur VinaSound par titre, genre ou nom d'artiste. Retourne les métadonnées publiques.",
  inputSchema: {
    query: z.string().trim().min(1).optional().describe("Texte à chercher dans le titre du morceau."),
    genre: z.string().trim().min(1).optional().describe("Filtrer par genre exact."),
    limit: z.number().int().min(1).max(50).default(20).describe("Nombre maximum de résultats."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, genre, limit }) => {
    const sb = anonClient();
    let q = sb
      .from("tracks")
      .select(
        "id,title,slug,genre,plays,likes,released_at,cover_url,artists(name,slug)",
      )
      .eq("is_published", true)
      .order("plays", { ascending: false })
      .limit(limit);
    if (query) q = q.ilike("title", `%${query}%`);
    if (genre) q = q.eq("genre", genre);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tracks: data ?? [] },
    };
  },
});
