import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Crown, Music2 } from "lucide-react";
import { AuthGate } from "@/components/PageScaffold";
import { verifyCinetPayPayment } from "@/lib/cinetpay.functions";

type Search = { transaction_id?: string; status?: string };

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    transaction_id: typeof s.transaction_id === "string" ? s.transaction_id : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Payment — VinaSound" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const search = useSearch({ from: "/payment/callback" });
  const verify = useServerFn(verifyCinetPayPayment);
  const [state, setState] = useState<"loading" | "success" | "failed">("loading");
  const [kind, setKind] = useState<
    "purchase" | "subscription" | "wallet" | "artist_fee" | null
  >(null);

  useEffect(() => {
    if (!search.transaction_id || search.status === "cancelled") {
      setState("failed");
      return;
    }
    verify({ data: { transaction_id: search.transaction_id } })
      .then((r) => {
        if (r.success) {
          setKind(r.kind ?? null);
          setState("success");
        } else {
          setState("failed");
        }
      })
      .catch(() => setState("failed"));
  }, [search.transaction_id, search.status, verify]);

  const isTrack = kind === "purchase";
  const isSubscription = kind === "subscription";
  const isWallet = kind === "wallet";
  const isFee = kind === "artist_fee";

  return (
    <AuthGate>
      <div className="max-w-lg mx-auto py-16 text-center px-4">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h1 className="font-display text-2xl font-extrabold mt-6">Vérification du paiement…</h1>
            <p className="text-muted-foreground text-sm mt-2">Ne ferme pas cette page.</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            {isTrack ? (
              <>
                <h1 className="font-display text-3xl font-extrabold mt-6 inline-flex items-center gap-2">
                  <Music2 className="w-6 h-6 text-primary" /> Achat confirmé
                </h1>
                <p className="text-muted-foreground mt-3">
                  Paiement validé. La piste est maintenant débloquée dans ta bibliothèque.
                </p>
                <Link
                  to="/purchased"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
                >
                  Voir mes achats
                </Link>
              </>
            ) : isWallet ? (
              <>
                <h1 className="font-display text-3xl font-extrabold mt-6">Wallet rechargé</h1>
                <p className="text-muted-foreground mt-3">
                  Ton solde a été crédité avec succès.
                </p>
                <Link
                  to="/wallet"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
                >
                  Voir mon wallet
                </Link>
              </>
            ) : isFee ? (
              <>
                <h1 className="font-display text-3xl font-extrabold mt-6">Frais payés</h1>
                <p className="text-muted-foreground mt-3">
                  Tu peux maintenant créer ton profil artiste.
                </p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
                >
                  Créer mon profil
                </Link>
              </>
            ) : isSubscription ? (
              <>
                <h1 className="font-display text-3xl font-extrabold mt-6 inline-flex items-center gap-2">
                  <Crown className="w-6 h-6 text-primary" /> Bienvenue dans PRO
                </h1>
                <p className="text-muted-foreground mt-3">
                  Paiement confirmé. Tes avantages PRO sont actifs.
                </p>
                <Link
                  to="/discover"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
                >
                  Explorer
                </Link>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-extrabold mt-6">Paiement confirmé</h1>
                <p className="text-muted-foreground mt-3">Merci !</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
                >
                  Accueil
                </Link>
              </>
            )}
          </>
        )}
        {state === "failed" && (
          <>
            <div className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="font-display text-3xl font-extrabold mt-6">Paiement non finalisé</h1>
            <p className="text-muted-foreground mt-3">
              Ton paiement a été annulé ou n'a pas pu être vérifié. Aucun montant n'a été débité.
            </p>
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold mt-8 hover:bg-primary/90 transition"
            >
              Réessayer plus tard
            </Link>
          </>
        )}
      </div>
    </AuthGate>
  );
}
