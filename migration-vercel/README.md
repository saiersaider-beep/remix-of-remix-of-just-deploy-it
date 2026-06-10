# Migration Kit : Lovable Cloud (Cloudflare Workers) → Vercel (Node.js)

Ce dossier est **autonome** et n'affecte pas le projet Lovable actif. Il contient les versions Vercel des fichiers à remplacer après export GitHub.

## Contenu

| Fichier | Destination après export | Rôle |
|---|---|---|
| `vercel.json` | `vercel.json` (racine) | Config déploiement Vercel |
| `.env.example` | `.env.example` (racine) | Liste des variables d'env requises |
| `package.vercel.json` | fusionner dans `package.json` | Dépendances nettoyées (Cloudflare/Lovable retirés) |
| `vite.vercel.config.ts` | `vite.config.ts` | Config Vite avec preset Nitro `vercel` |
| `server.vercel.ts` | `src/server.ts` | Handler SSR sans `export { fetch }` Workers |
| `supabase.server.vercel.ts` | `src/integrations/supabase/client.server.ts` | Admin client Supabase (Node.js) |
| `middleware.vercel.ts` | `src/integrations/supabase/auth-middleware.ts` | Middleware auth bearer token |
| `flutterwave-webhook.vercel.ts` | `src/routes/api/public/flutterwave-webhook.ts` | Webhook Flutterwave Node-compatible |
| `MIGRATION_GUIDE.md` | (lecture) | Guide pas-à-pas complet |

## Démarrage rapide

1. Lis **`MIGRATION_GUIDE.md`** en entier avant de commencer.
2. Exporte le projet vers GitHub (bouton GitHub dans Lovable).
3. Clone le repo en local.
4. Copie les fichiers de ce dossier aux destinations indiquées.
5. `npm install` → `npm run build` → `vercel deploy`.

## Pourquoi ce kit existe

Lovable Cloud déploie sur Cloudflare Workers via des plugins propriétaires :
- `@cloudflare/vite-plugin`
- `@lovable.dev/vite-tanstack-config`
- `wrangler.jsonc`
- runtime Workers avec `export default { fetch }`

Vercel utilise Node.js (ou Edge Runtime) avec une architecture serverless différente. Ce kit fait la traduction.
