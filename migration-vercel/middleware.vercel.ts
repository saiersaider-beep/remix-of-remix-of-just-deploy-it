// Remplace src/integrations/supabase/auth-middleware.ts après migration.
// Pattern : middleware TanStack Start qui valide le bearer token Supabase
// et injecte un client supabase scopé sur l'utilisateur dans le context.
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[auth-middleware] Supabase URL/anon key missing at module init");
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      throw new Response("Unauthorized: missing bearer token", { status: 401 });
    }
    const token = authHeader.slice(7).trim();

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // getUser() re-valide le JWT auprès du serveur Auth (vs getSession() qui
    // lit le cache cookie sans validation).
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Response("Unauthorized: invalid token", { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user,
      },
    });
  },
);

// Le bearer attacher client-side reste identique à src/integrations/supabase/auth-attacher.ts :
// il lit supabase.auth.getSession() et pose Authorization: Bearer <token> sur
// chaque appel de server fn. À garder tel quel dans src/start.ts :
//
//   import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
//   export const startInstance = createStart(() => ({
//     functionMiddleware: [attachSupabaseAuth],
//   }));
