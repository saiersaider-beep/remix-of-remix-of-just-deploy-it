import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle, Crown } from "lucide-react";
import { listGeniusPayTransactions } from "@/lib/geniuspay.functions";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/geniuspay-transactions")({
  head: () => ({
    meta: [
      { title: "Transactions GeniusPay — Admin VinaSound" },
      {
        name: "description",
        content:
          "Toutes les transactions GeniusPay de VinaSound : achats, abonnements, recharges wallet et frais artiste avec statut, montant, date et déblocage.",
      },
      { property: "og:title", content: "Transactions GeniusPay — Admin VinaSound" },
      {
        property: "og:description",
        content: "Statut, montant, date et déblocage de chaque transaction GeniusPay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGeniusPayTransactions,
});

type Kind = "all" | "purchase" | "subscription" | "wallet" | "artist_fee";
type StatusFilter = "all" | "pending" | "paid" | "failed";

const KIND_LABELS: Record<Kind, string> = {
  all: "Tous types",
  purchase: "Achats",
  subscription: "Abonnements",
  wallet: "Wallet",
  artist_fee: "Frais artiste",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tous statuts",
  paid: "Payés",
  pending: "En attente",
  failed: "Échoués",
};

function AdminGeniusPayTransactions() {
  const listFn = useServerFn(listGeniusPayTransactions);
  const [kind, setKind] = useState<Kind>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["geniuspay-transactions", kind, status],
    queryFn: () => listFn({ data: { kind, status, limit: 200 } }),
  });

  const rows = data?.transactions ?? [];

  return (
    <>
      <AdminPageHeader
        title="Transactions GeniusPay"
        description="Toutes les transactions GeniusPay (achats, abonnements, recharges wallet, frais artiste) avec statut, montant, date et état du déblocage."
        actions={
          <Link
            to="/admin/geniuspay-pro"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-bold hover:text-primary hover:border-primary transition"
          >
            <Crown className="w-3.5 h-3.5" /> Paiements PRO
          </Link>
        }
      />


      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              kind === k
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              status === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-bold hover:border-primary transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune transaction GeniusPay pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left font-bold px-4 py-3">Référence MTX</th>
                <th className="text-left font-bold px-4 py-3">Type</th>
                <th className="text-left font-bold px-4 py-3">Objet</th>
                <th className="text-left font-bold px-4 py-3">Utilisateur</th>
                <th className="text-left font-bold px-4 py-3">Montant</th>
                <th className="text-left font-bold px-4 py-3">Statut</th>
                <th className="text-left font-bold px-4 py-3">Piste débloquée</th>
                <th className="text-left font-bold px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.reference ?? <span className="text-muted-foreground">—</span>}
                    <div className="text-[10px] text-muted-foreground">{r.transactionId ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold">{KIND_LABELS[r.kind]}</td>
                  <td className="px-4 py-3">
                    {r.trackSlug ? (
                      <Link
                        to="/tracks/$slug"
                        params={{ slug: r.trackSlug }}
                        className="text-primary hover:underline"
                      >
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="px-4 py-3">{r.buyer}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.amount.toLocaleString("fr-FR")} {r.currency}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.unlocked === null ? (
                      <span className="text-xs text-muted-foreground">n/a</span>
                    ) : r.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Oui
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.date).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (["paid", "completed", "succeeded", "active"].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
        <CheckCircle2 className="w-3.5 h-3.5" /> Payé
      </span>
    );
  }
  if (status === "failed" || status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
        <XCircle className="w-3.5 h-3.5" /> {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
      <Clock className="w-3.5 h-3.5" /> En attente
    </span>
  );
}
