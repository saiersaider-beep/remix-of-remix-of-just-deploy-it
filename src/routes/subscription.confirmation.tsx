import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Crown, Calendar, Receipt } from "lucide-react";
import { AuthGate } from "@/components/PageScaffold";
import {
  verifyGeniusPayPayment,
  getMyProSubscription,
  cancelMyProSubscription,
} from "@/lib/geniuspay.functions";

type Search = { transaction_id?: string; status?: string };

export const Route = createFileRoute("/subscription/confirmation")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    transaction_id: typeof s.transaction_id === "string" ? s.transaction_id : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Abonnement PRO confirmé — VinaSound" },
      {
        name: "description",
        content:
          "Confirmation de votre abonnement VinaSound PRO : plan actif, date de renouvellement et désabonnement en un clic.",
      },
      { property: "og:title", content: "Abonnement PRO confirmé — VinaSound" },
      {
        property: "og:description",
        content: "Votre abonnement PRO est actif : consultez sa période et désabonnez-vous à tout moment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionConfirmationPage,
});

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SubscriptionConfirmationPage() {
  const search = useSearch({ from: "/subscription/confirmation" });
  const verify = useServerFn(verifyGeniusPayPayment);
  const getSub = useServerFn(getMyProSubscription);
  const cancelFn = useServerFn(cancelMyProSubscription);
  const qc = useQueryClient();
  const [state, setState] = useState<"loading" | "success" | "failed">("loading");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!search.transaction_id || search.status === "cancelled") {
      setState("failed");
      return;
    }
    verify({ data: { transaction_id: search.transaction_id } })
      .then((r) => setState(r.success ? "success" : "failed"))
      .catch(() => setState("failed"))
      .finally(() => void qc.invalidateQueries({ queryKey: ["my-pro-subscription"] }));
  }, [search.transaction_id, search.status, verify, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-pro-subscription"],
    queryFn: () => getSub(),
    enabled: state !== "loading",
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-pro-subscription"] }),
  });

  const sub = data?.subscription ?? null;

  return (
    <AuthGate>
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h1 className="font-display text-2xl font-extrabold mt-6">
              Confirmation de l'abonnement…
            </h1>
            <p className="text-muted-foreground text-sm mt-2">Ne ferme pas cette page.</p>
          </>
        )}

        {state === "failed" && (
          <>
            <div className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="font-display text-2xl font-extrabold mt-6">Abonnement non confirmé</h1>
            <p className="text-muted-foreground text-sm mt-3">
              Le paiement a été annulé ou n'est pas encore validé par GeniusPay. Si le montant a été
              débité, l'abonnement s'activera dès réception de la confirmation.
            </p>
            <Link
              to="/go-pro"
              className="inline-flex mt-8 items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-bold hover:border-primary transition"
            >
              Revoir les plans PRO
            </Link>
          </>
        )}

        {state === "success" && (
          <>
            <div className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="font-display text-3xl font-extrabold mt-6 inline-flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" /> Abonnement PRO actif
            </h1>
            <p className="text-muted-foreground text-sm mt-3">
              Paiement GeniusPay confirmé. Tes avantages PRO sont activés immédiatement.
            </p>

            {isLoading ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement de l'abonnement…
              </div>
            ) : sub ? (
              <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                      Plan actif
                    </p>
                    <p className="font-display text-xl font-extrabold mt-1">{sub.planName}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-500">
                    Actif
                  </span>
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Montant</dt>
                    <dd className="ml-auto font-bold">
                      {sub.amount.toLocaleString("fr-FR")} {sub.currency}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Début</dt>
                    <dd className="ml-auto font-bold">{formatDate(sub.periodStart)}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Fin de période</dt>
                    <dd className="ml-auto font-bold">{formatDate(sub.periodEnd)}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/discover"
                    className="flex-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-bold hover:bg-primary/90 transition"
                  >
                    Explorer VinaSound
                  </Link>
                  <Link
                    to="/subscription"
                    className="flex-1 inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-bold hover:border-primary transition"
                  >
                    Mon abonnement
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirmer le désabonnement ? Tes avantages PRO seront désactivés.",
                      )
                    )
                      cancelMut.mutate();
                  }}
                  disabled={cancelMut.isPending}
                  className="mt-4 w-full text-xs font-bold text-muted-foreground underline hover:text-destructive transition disabled:opacity-50"
                >
                  {cancelMut.isPending ? "Désabonnement…" : "Se désabonner de PRO"}
                </button>
                {cancelMut.isError && (
                  <p className="mt-2 text-xs text-destructive">
                    Le désabonnement a échoué, réessaie.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Aucun abonnement actif pour le moment.
                <div className="mt-4">
                  <Link
                    to="/subscription"
                    className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-xs font-bold hover:border-primary transition"
                  >
                    Voir mes abonnements
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGate>
  );
}
