import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { listGeniusPayPurchases } from "@/lib/geniuspay.functions";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/geniuspay-purchases")({
  head: () => ({
    meta: [
      { title: "Achats GeniusPay — Admin VinaSound" },
      {
        name: "description",
        content:
          "Suivi des achats GeniusPay : référence MTX, statut du paiement et piste débloquée pour chaque acheteur.",
      },
      { property: "og:title", content: "Achats GeniusPay — Admin VinaSound" },
      {
        property: "og:description",
        content: "Références MTX, statuts de paiement et pistes débloquées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGeniusPayPurchases,
});

type StatusFilter = "all" | "pending" | "completed" | "failed";

function AdminGeniusPayPurchases() {
  const listFn = useServerFn(listGeniusPayPurchases);
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["geniuspay-purchases", status],
    queryFn: () => listFn({ data: { status, limit: 100 } }),
  });

  const rows = data?.purchases ?? [];

  return (
    <>
      <AdminPageHeader
        title="Achats GeniusPay"
        description="Chaque paiement GeniusPay avec sa référence MTX, son statut et la piste débloquée pour l'acheteur."
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["all", "completed", "pending", "failed"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              status === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all"
              ? "Tous"
              : s === "completed"
                ? "Payés"
                : s === "pending"
                  ? "En attente"
                  : "Échoués"}
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
          Aucun achat GeniusPay pour ce filtre.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left font-bold px-4 py-3">Référence MTX</th>
                <th className="text-left font-bold px-4 py-3">Acheteur</th>
                <th className="text-left font-bold px-4 py-3">Piste</th>
                <th className="text-left font-bold px-4 py-3">Montant</th>
                <th className="text-left font-bold px-4 py-3">Statut</th>
                <th className="text-left font-bold px-4 py-3">Débloquée</th>
                <th className="text-left font-bold px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.reference ?? <span className="text-muted-foreground">—</span>}
                    <div className="text-[10px] text-muted-foreground">{r.transactionId}</div>
                  </td>
                  <td className="px-4 py-3">{r.buyer}</td>
                  <td className="px-4 py-3">
                    {r.trackSlug ? (
                      <Link
                        to="/tracks/$slug"
                        params={{ slug: r.trackSlug }}
                        className="text-primary hover:underline"
                      >
                        {r.trackTitle}
                      </Link>
                    ) : (
                      r.trackTitle
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.amount.toLocaleString("fr-FR")} {r.currency}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Oui
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.paidAt ?? r.createdAt).toLocaleString("fr-FR")}
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
  if (status === "completed" || status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
        <CheckCircle2 className="w-3.5 h-3.5" /> Payé
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
        <Clock className="w-3.5 h-3.5" /> En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
      <XCircle className="w-3.5 h-3.5" /> {status}
    </span>
  );
}
