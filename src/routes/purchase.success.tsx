import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Music2 } from "lucide-react";
import { AuthGate } from "@/components/PageScaffold";
import { getPurchaseConfirmation, reconcileGeniusPayPurchase } from "@/lib/geniuspay.functions";

type Search = { transaction_id?: string; status?: string };

export const Route = createFileRoute("/purchase/success")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    transaction_id: typeof s.transaction_id === "string" ? s.transaction_id : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Merci pour votre achat — VinaSound" },
      {
        name: "description",
        content:
          "Confirmation de paiement GeniusPay : votre piste VinaSound est débloquée et disponible à l'écoute.",
      },
      { property: "og:title", content: "Merci pour votre achat — VinaSound" },
      {
        property: "og:description",
        content: "Votre paiement GeniusPay est confirmé et votre piste est débloquée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PurchaseSuccessPage,
});

function PurchaseSuccessPage() {
  const search = useSearch({ from: "/purchase/success" });
  const confirm = useServerFn(getPurchaseConfirmation);
  const reconcile = useServerFn(reconcileGeniusPayPurchase);
  const [state, setState] = useState<"loading" | "success" | "failed">("loading");
  const [track, setTrack] = useState<{ title: string; slug: string } | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [amount, setAmount] = useState<{ value: number; currency: string } | null>(null);

  useEffect(() => {
    const txId = search.transaction_id;
    if (!txId || search.status === "cancelled") {
      setState("failed");
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const r = await confirm({ data: { transaction_id: txId } });
        if (cancelled) return;
        if (r.state === "paid") {
          setTrack(r.track);
          setReference(r.reference);
          setAmount({ value: r.amount, currency: r.currency });
          setState("success");
          return;
        }
        if (r.state === "not_found" || r.state === "failed" || attempts >= 5) {
          setState("failed");
          return;
        }
        // Le webhook n'est pas encore arrivé : on demande au serveur de
        // revérifier le statut directement auprès de GeniusPay.
        attempts += 1;
        await reconcile({ data: { transaction_id: txId } }).catch(() => null);
        if (!cancelled) setTimeout(poll, 2500);
      } catch {
        if (!cancelled) setState("failed");
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [search.transaction_id, search.status, confirm, reconcile]);


  return (
    <AuthGate>
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h1 className="font-display text-2xl font-extrabold mt-6">
              Confirmation du paiement…
            </h1>
            <p className="text-muted-foreground text-sm mt-2">Ne ferme pas cette page.</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
            <h1 className="font-display text-3xl font-extrabold mt-6">Merci pour votre achat</h1>
            <p className="text-muted-foreground text-sm mt-3">
              Ton paiement GeniusPay est confirmé
              {amount ? ` (${amount.value.toLocaleString("fr-FR")} ${amount.currency})` : ""}. La
              piste est débloquée sur ton compte.
            </p>
            {reference && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Référence : {reference}
              </p>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              {track?.slug ? (
                <Link
                  to="/tracks/$slug"
                  params={{ slug: track.slug }}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold hover:bg-primary/90 transition"
                >
                  <Music2 className="w-4 h-4" /> Écouter « {track.title} »
                </Link>
              ) : null}
              <Link
                to="/purchased"
                className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-bold hover:border-primary transition"
              >
                Mes achats
              </Link>
            </div>
          </>
        )}

        {state === "failed" && (
          <>
            <XCircle className="w-14 h-14 mx-auto text-destructive" />
            <h1 className="font-display text-2xl font-extrabold mt-6">Paiement non confirmé</h1>
            <p className="text-muted-foreground text-sm mt-3">
              Le paiement a été annulé ou n'a pas encore été validé par GeniusPay. Si le montant a
              été débité, la piste se débloquera automatiquement dès réception de la confirmation.
            </p>
            <Link
              to="/discover"
              className="inline-flex mt-8 items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-bold hover:border-primary transition"
            >
              Retour à la découverte
            </Link>
          </>
        )}
      </div>
    </AuthGate>
  );
}
