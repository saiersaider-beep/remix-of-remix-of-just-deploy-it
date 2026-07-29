import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_tracks",
  title: "Mes morceaux",
  description:
    "Liste les morceaux de l'artiste connecté (publiés et brouillons). Renvoie titre, statut, lectures et likes.",
  inputSchema: {
    include_drafts: z.boolean().default(true).describe("Inclure les brouillons non publiés."),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_drafts, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const sb = userClient(ctx);
    const { data: artist } = await sb
      .from("artists")
      .select("id,name,slug")
      .eq("owner_id", ctx.getUserId())
      .maybeSingle();
    if (!artist)
      return {
        content: [{ type: "text", text: "Aucun profil artiste trouvé pour cet utilisateur." }],
        structuredContent: { tracks: [] },
      };
    let q = sb
      .from("tracks")
      .select("id,title,slug,genre,plays,likes,is_published,released_at")
      .eq("artist_id", artist.id)
      .order("released_at", { ascending: false })
      .limit(limit);
    if (!include_drafts) q = q.eq("is_published", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ artist, tracks: data ?? [] }) }],
      structuredContent: { artist, tracks: data ?? [] },
    };
  },
});
