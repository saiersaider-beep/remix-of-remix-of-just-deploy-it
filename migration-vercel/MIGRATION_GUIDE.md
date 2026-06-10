# Guide de migration Lovable Cloud → Vercel

## 0. Analyse du projet actuel

### Fichiers couplés à Cloudflare (à supprimer ou remplacer)

| Fichier | Action |
|---|---|
| `wrangler.jsonc` | **Supprimer** |
| `vite.config.ts` (actuel) | **Remplacer** par `vite.vercel.config.ts` |
| `src/server.ts` (actuel) | **Remplacer** par `server.vercel.ts` (plus de `export default { fetch }` style Workers) |
| `node_modules/@cloudflare/vite-plugin` | Retiré via `npm uninstall` |

### Fichiers Lovable-spécifiques (à supprimer ou remplacer)

| Fichier | Action | Raison |
|---|---|---|
| `@lovable.dev/vite-tanstack-config` (devDep) | **Supprimer** | Preset qui force Cloudflare |
| `@lovable.dev/cloud-auth-js` (dep) | **Supprimer** | Broker OAuth Lovable, plus dispo hors plateforme |
| `src/integrations/lovable/index.ts` | **Réécrire** | Remplacer `lovable.auth.signInWithOAuth("google", ...)` par `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })` |
| `src/integrations/supabase/client.server.ts` | **Remplacer** par `supabase.server.vercel.ts` | Sur Lovable il était auto-généré ; hors Lovable tu le possèdes |
| `src/integrations/supabase/auth-middleware.ts` | **Remplacer** par `middleware.vercel.ts` | Idem |
| `src/integrations/supabase/auth-attacher.ts` | **Garder tel quel** | Code client standard, déjà compatible |
| `src/integrations/supabase/client.ts` | **Garder tel quel** | Client browser standard |
| `src/integrations/supabase/types.ts` | **Garder** mais régénérer via `npx supabase gen types typescript --project-id <id>` |

### Endpoints API détectés

Tous au format TanStack Start file-route, **compatibles Vercel sans modification structurelle** (juste les imports `supabaseAdmin` à valider) :

- `src/routes/api/public/flutterwave-webhook.ts` → remplacer par version fournie
- `src/routes/api/public/cinetpay-webhook.ts` → adapter sur le même modèle (voir §5)
- `src/routes/api/public/seed-test-accounts.ts` → **supprimer en prod** (route de seed)

### Server functions détectées

Toutes utilisent `createServerFn` de `@tanstack/react-start` → **portables tel quel** une fois `client.server.ts` et `auth-middleware.ts` remplacés :

- `src/lib/artist-fee.functions.ts`
- `src/lib/audio.functions.ts`
- `src/lib/billing.functions.ts`
- `src/lib/cinetpay.functions.ts`
- `src/lib/flutterwave.functions.ts`
- `src/lib/import-track.functions.ts`
- `src/lib/points.functions.ts`
- `src/lib/purchase.functions.ts`
- `src/lib/topup.functions.ts`
- `src/lib/transcribe.functions.ts`
- `src/lib/wallet.functions.ts`

### Variables d'environnement requises sur Vercel

Voir `.env.example` pour la liste complète. Minimum vital :

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_ENCRYPTION_KEY
FLUTTERWAVE_WEBHOOK_HASH
CINETPAY_API_KEY (si utilisé)
CINETPAY_SITE_ID
CINETPAY_SECRET_KEY
OPENAI_API_KEY (remplace LOVABLE_API_KEY)
SESSION_SECRET
PUBLIC_SITE_URL
```

### Incompatibilités Vercel à corriger

| Sujet | Workers (actuel) | Vercel (cible) |
|---|---|---|
| Entrée serveur | `export default { fetch(req, env, ctx) }` | Handler standard (preset nitro `vercel`) |
| Env vars | `env.X` (binding Workers) | `process.env.X` (Node) — déjà utilisé partout dans le projet ✅ |
| Filesystem | virtuel /tmp | `/tmp` Node + 512 MB |
| Timeout | sub-request CPU | 30s Hobby / 300s Pro (config `vercel.json`) |
| `import.meta.env.VITE_*` | OK | OK (identique) |
| Streams | Web Streams | Web Streams + Node Streams |
| `crypto` | Web Crypto | Web Crypto + `node:crypto` (préférer Web Crypto pour portabilité) |
| Cookies | h3 | h3 (identique via TanStack) |

---

## 1. Exporter vers GitHub

1. Dans Lovable, en haut à droite → bouton **GitHub** → **Connect to GitHub** puis **Create Repository**.
2. Clone le repo localement :
   ```bash
   git clone https://github.com/<ton-user>/<ton-repo>.git
   cd <ton-repo>
   ```

## 2. Copier le kit de migration

Depuis ce dossier `migration-vercel/` (à récupérer manuellement avant export, ou via une copie locale) :

```bash
# Depuis la racine du repo cloné :
cp migration-vercel/vercel.json ./vercel.json
cp migration-vercel/.env.example ./.env.example
cp migration-vercel/vite.vercel.config.ts ./vite.config.ts
cp migration-vercel/server.vercel.ts ./src/server.ts
cp migration-vercel/supabase.server.vercel.ts ./src/integrations/supabase/client.server.ts
cp migration-vercel/middleware.vercel.ts ./src/integrations/supabase/auth-middleware.ts
cp migration-vercel/flutterwave-webhook.vercel.ts ./src/routes/api/public/flutterwave-webhook.ts
```

## 3. Nettoyer package.json

Remplace le bloc `dependencies`/`devDependencies` par celui de `package.vercel.json`, puis :

```bash
# Supprimer les packages Cloudflare/Lovable
npm uninstall @cloudflare/vite-plugin @lovable.dev/vite-tanstack-config @lovable.dev/cloud-auth-js

# Ajouter ce qui manque pour Vercel
npm install @supabase/ssr

# Installer le reste
npm install

# Vérifier qu'aucune référence Cloudflare ne traîne
grep -r "@cloudflare\|@lovable.dev\|wrangler" src/ vite.config.ts package.json
# → doit ne rien retourner
```

## 4. Supprimer les fichiers Cloudflare

```bash
rm wrangler.jsonc
rm -rf .wrangler
rm -rf node_modules/.cache
```

## 5. Adapter le webhook CinetPay (même pattern que Flutterwave)

Ouvre `src/routes/api/public/cinetpay-webhook.ts`. La structure est déjà compatible. Vérifie juste que :
- la vérification de signature utilise `timingSafeEqual` (cf. exemple Flutterwave)
- `process.env.CINETPAY_*` sont bien lus
- `supabaseAdmin` est importé depuis le nouveau `client.server.ts`

## 6. Réécrire src/integrations/lovable/index.ts

Le broker `lovable.auth.signInWithOAuth("google", ...)` n'existe plus. Remplace par :

```ts
// src/integrations/lovable/index.ts (à supprimer si plus utilisé)
import { supabase } from "@/integrations/supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "github",
      opts: { redirect_uri?: string } = {},
    ) => {
      return supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: opts.redirect_uri ?? `${window.location.origin}/discover` },
      });
    },
  },
};
```

⚠️ Active aussi le provider Google dans le **dashboard Supabase** → Authentication → Providers → Google (côté Lovable c'était délégué au broker).

## 7. Régénérer les types Supabase

```bash
npx supabase login
npx supabase gen types typescript --project-id <ton-project-id> > src/integrations/supabase/types.ts
```

## 8. Configurer Vercel

```bash
npm install -g vercel
vercel login
vercel link            # lie le repo local au projet Vercel
```

Puis dans le **dashboard Vercel** → Project → **Settings → Environment Variables**, ajoute TOUTES les variables listées dans `.env.example` (pour les 3 environnements : Production, Preview, Development).

Alternative CLI :
```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... etc pour chaque var
```

## 9. Build local + déploiement

```bash
# Build local pour valider
npm run build

# Déploiement preview
vercel

# Déploiement production
vercel deploy --prod
```

## 10. Mettre à jour les webhooks externes

Après obtention de l'URL Vercel finale (ex `https://mon-app.vercel.app`) :

- **Flutterwave dashboard** → Settings → Webhooks :
  `https://mon-app.vercel.app/api/public/flutterwave-webhook`
- **CinetPay dashboard** → Notification URL :
  `https://mon-app.vercel.app/api/public/cinetpay-webhook`
- **Supabase dashboard** → Authentication → URL Configuration :
  - Site URL : `https://mon-app.vercel.app`
  - Redirect URLs : ajouter `https://mon-app.vercel.app/**` et `https://*-mon-app.vercel.app/**` (pour previews)

## 11. AI Gateway

Le projet utilise `LOVABLE_API_KEY` via le AI Gateway Lovable. Sur Vercel ce service n'existe plus. Deux options :

**A.** Appel direct OpenAI / Gemini (recommandé) :
```ts
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ model: "gpt-4o-mini", messages: [...] }),
});
```

**B.** Vercel AI SDK (`npm install ai @ai-sdk/openai`).

Rechercher toutes les références :
```bash
grep -rn "LOVABLE_API_KEY\|ai.gateway.lovable.dev" src/
```

## 12. Différences Node vs Workers (récap)

| Sujet | Workers | Vercel Node 20 |
|---|---|---|
| `fs` complet | ❌ virtuel | ✅ readonly hors `/tmp` |
| `child_process` | ❌ | ✅ |
| `sharp`, `puppeteer` | ❌ | ✅ |
| `Buffer` | partiel | ✅ natif |
| `process.env` | partiel | ✅ natif |
| Web Crypto | ✅ | ✅ |
| Cold start | ~5ms | ~200ms (Node) / ~50ms (Edge) |
| Limite mémoire | 128 MB | 1024 MB (Hobby) / 3008 MB (Pro) |
| Timeout | 30s CPU | 10s Hobby / 60s Pro / 300s Pro+ |

## 13. Adaptations fetch / request / response

TanStack Start utilise déjà les Web standards (`Request`, `Response`, `fetch`) — **rien à changer** dans les server functions ni les server routes. Le seul fichier qui touchait à la signature Workers (`fetch(req, env, ctx)`) est `src/server.ts`, déjà remplacé.

## 14. Structure finale du projet sur Vercel

```
.
├── vercel.json                       ← config déploiement
├── vite.config.ts                    ← preset nitro "vercel"
├── package.json                      ← sans @cloudflare/* ni @lovable.dev/*
├── .env.example
├── src/
│   ├── server.ts                     ← handler Vercel (pas { fetch } Workers)
│   ├── start.ts                      ← inchangé (middleware globaux)
│   ├── router.tsx                    ← inchangé
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── ... (toutes les pages)
│   │   └── api/public/
│   │       ├── flutterwave-webhook.ts
│   │       └── cinetpay-webhook.ts
│   ├── integrations/supabase/
│   │   ├── client.ts                 ← browser (inchangé)
│   │   ├── client.server.ts          ← admin (réécrit)
│   │   ├── auth-middleware.ts        ← réécrit
│   │   ├── auth-attacher.ts          ← inchangé
│   │   └── types.ts                  ← régénéré
│   ├── lib/                          ← *.functions.ts inchangés
│   ├── components/
│   ├── hooks/
│   └── stores/
└── .output/                          ← généré par build (Nitro)
    ├── public/                       ← assets statiques
    └── server/index.mjs              ← function serverless
```

## 15. Commandes récapitulatives

```bash
# Installation
npm uninstall @cloudflare/vite-plugin @lovable.dev/vite-tanstack-config @lovable.dev/cloud-auth-js
npm install @supabase/ssr
npm install

# Dev local
npm run dev

# Build (vérification)
npm run build

# Déploiement
vercel              # preview
vercel deploy --prod
```

## 16. Checklist de validation post-déploiement

- [ ] `https://<app>.vercel.app/` charge la home page
- [ ] Inscription / connexion Supabase fonctionnent
- [ ] Sign-in Google fonctionne (provider activé dans Supabase)
- [ ] Lecture audio fonctionne (server fn `audio.functions.ts`)
- [ ] Achat track → webhook Flutterwave reçu (vérifier table `payment_events`)
- [ ] Achat track → webhook CinetPay reçu
- [ ] `vercel logs <deployment-url>` ne montre pas d'erreur 500
- [ ] Aucune référence `@cloudflare` / `@lovable.dev` dans le bundle :
      `grep -r "@cloudflare\|@lovable" .output/`

---

**Support** : si une server fn casse après migration, vérifie en priorité :
1. La var d'env correspondante est bien dans Vercel.
2. `client.server.ts` est bien la version `supabase.server.vercel.ts`.
3. `src/start.ts` exporte toujours `attachSupabaseAuth` dans `functionMiddleware`.
