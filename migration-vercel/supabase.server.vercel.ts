// Remplace src/integrations/supabase/client.server.ts après migration.
// Sur Lovable Cloud ce fichier est auto-généré et NON éditable. Hors Lovable,
// tu le possèdes complètement.
//
// Sur Vercel : process.env.* est disponible directement dans les functions
// Node.js. Pas besoin de Cloudflare bindings.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. " +
      "Configure them in Vercel → Project Settings → Environment Variables.",
  );
}

/**
 * Admin client — BYPASSES RLS. Ne JAMAIS importer côté client.
 * Utiliser uniquement dans :
 *   - server functions (`createServerFn`)
 *   - server routes (`src/routes/api/...`)
 *   - webhooks
 */
export const supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
