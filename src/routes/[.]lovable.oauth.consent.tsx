import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: { client?: { name?: string } | null; redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id manquant");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-bold mb-2">Autorisation impossible</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "une application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune redirection retournée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8">
        <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">
          Connexion externe
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Connecter {clientName} à votre compte VinaSound
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {clientName} pourra utiliser les outils VinaSound en votre nom : rechercher des morceaux,
          consulter votre catalogue d'artiste et votre solde. Vous pouvez révoquer l'accès à tout
          moment depuis vos paramètres.
        </p>
        {error && (
          <div role="alert" className="mb-4 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-primary text-primary-foreground rounded-full px-5 py-2.5 font-bold hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Autoriser"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 border border-border rounded-full px-5 py-2.5 font-semibold hover:border-primary disabled:opacity-50"
          >
            Refuser
          </button>
        </div>
      </div>
    </main>
  );
}
