import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle, Crown } from "lucide-react";
import { listGeniusPayProPayments } from "@/lib/geniuspay.functions";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/geniuspay-pro")({
  head: () => ({
    meta: [
      { title: "Paiements PRO GeniusPay — Admin VinaSound" },
      {
        name: "description",
        content:
          "Suivi des abonnements PRO payés via GeniusPay : référence MTX, plan, statut du paiement, période et déblocage du badge PRO.",
      },
      { property: "og:title", content: "Paiements PRO GeniusPay — Admin VinaSound" },
      {
        property: "og:description",
        content: "Statut et déblocage de chaque paiement PRO GeniusPay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGeniusPayPro,
});

type PlanFilter = "all" | "pro-month" | "pro-year" | "pro-life";
type StatusFilter = "all" | "pending" | "paid" | "failed";

const PLAN_LABELS: Record<PlanFilter, string> = {
  all: "Tous les plans",
  "pro-month": "Mensuel",
  "pro-year": "Annuel",
  "pro-life": "À vie",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tous statuts",
  paid: "Payés",
  pending: "En attente",
  failed: "Échoués",
};

function AdminGeniusPayPro() {
  const listFn = useServerFn(listGeniusPayProPayments);
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["geniuspay-pro", plan, status],
    queryFn: () => listFn({ data: { plan, status, limit: 200 } }),
  });

  const rows = data?.payments ?? [];

  return (
    <>
      <AdminPageHeader
        title="Paiements PRO GeniusPay"
        description="Abonnements PRO réglés via GeniusPay : référence MTX, plan, statut du paiement, période de validité et déblocage du badge PRO."
        actions={
          <Link
            to="/admin/geniuspay-transactions"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-bold hover:border-primary transition"
          >
            Toutes les transactions
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(PLAN_LABELS) as PlanFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlan(p)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              plan === p
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {PLAN_LABELS[p]}
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
          Aucun paiement PRO GeniusPay pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left font-bold px-4 py-3">Référence MTX</th>
                <th className="text-left font-bold px-4 py-3">Plan</th>
                <th className="text-left font-bold px-4 py-3">Utilisateur</th>
                <th className="text-left font-bold px-4 py-3">Montant</th>
                <th className="text-left font-bold px-4 py-3">Statut paiement</th>
                <th className="text-left font-bold px-4 py-3">PRO débloqué</th>
                <th className="text-left font-bold px-4 py-3">Période</th>
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
                  <td className="px-4 py-3 text-xs font-bold">{r.planLabel}</td>
                  <td className="px-4 py-3">
                    {r.artistSlug ? (
                      <Link
                        to="/artists/$slug"
                        params={{ slug: r.artistSlug }}
                        className="text-primary hover:underline"
                      >
                        {r.buyer}
                      </Link>
                    ) : (
                      r.buyer
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
                        <Crown className="w-3.5 h-3.5" /> Oui
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {r.periodEnd
                      ? `jusqu'au ${new Date(r.periodEnd).toLocaleDateString("fr-FR")}`
                      : "—"}
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
  if (status === "failed" || status === "rejected" || status === "cancelled") {
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
