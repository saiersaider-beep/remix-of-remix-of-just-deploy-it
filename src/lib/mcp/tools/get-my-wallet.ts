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
  name: "get_my_wallet",
  title: "Mon portefeuille",
  description:
    "Retourne le solde du portefeuille et les points de fidélité de l'utilisateur connecté sur VinaSound.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const sb = userClient(ctx);
    const uid = ctx.getUserId();
    const [walletRes, pointsRes] = await Promise.all([
      sb.from("wallets").select("balance,currency").eq("user_id", uid).maybeSingle(),
      sb.from("user_points").select("balance").eq("user_id", uid).maybeSingle(),
    ]);
    const payload = {
      wallet: walletRes.data ?? { balance: 0, currency: "XOF" },
      points: pointsRes.data?.balance ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
