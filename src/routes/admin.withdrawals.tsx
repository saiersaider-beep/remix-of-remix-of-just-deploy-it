import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Banknote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/withdrawals")({
  component: WithdrawalsPage,
});

type Row = {
  id: string;
  artist_id: string;
  amount: number;
  currency: string;
  method: string;
  account_holder: string | null;
  account_number: string;
  bank_name: string | null;
  status: string;
  admin_note: string | null;
  payout_reference: string | null;
  created_at: string;
};

const STATUSES = ["all", "pending", "approved", "processing", "paid", "rejected"] as const;
type Filter = (typeof STATUSES)[number];

function WithdrawalsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", filter],
    queryFn: async () => {
      let q = db
        .from("withdrawal_requests")
        .select(
          "id, artist_id, amount, currency, method, account_holder, account_number, bank_name, status, admin_note, payout_reference, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const update = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: Row["status"];
      payout_reference?: string | null;
      admin_note?: string | null;
    }) => {
      const patch: Record<string, unknown> = {
        status: vars.status,
        reviewed_at: new Date().toISOString(),
      };
      if (vars.payout_reference !== undefined) patch.payout_reference = vars.payout_reference;
      if (vars.admin_note !== undefined) patch.admin_note = vars.admin_note;
      if (vars.status === "paid") patch.paid_at = new Date().toISOString();
      const { error } = await db
        .from("withdrawal_requests")
        .update(patch)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Retraits artistes"
        description={`${data?.length ?? 0} demande(s).`}
        actions={
          <div className="flex gap-1 rounded-full bg-muted/30 p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold capitalize transition ${
                  filter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Row>
          keyOf={(r) => r.id}
          empty="Aucune demande de retrait."
          columns={[
            {
              key: "artist",
              label: "Artiste",
              render: (r) => (
                <code className="text-[11px] text-muted-foreground">
                  {r.artist_id.slice(0, 8)}…
                </code>
              ),
            },
            {
              key: "amount",
              label: "Montant",
              render: (r) => (
                <span className="font-bold">
                  {r.amount.toLocaleString()} {r.currency}
                </span>
              ),
            },
            {
              key: "method",
              label: "Méthode",
              render: (r) => (
                <div className="text-xs">
                  <div className="font-semibold capitalize">
                    {r.method.replace("_", " ")}
                  </div>
                  <div className="text-muted-foreground">{r.account_number}</div>
                  {r.bank_name && (
                    <div className="text-muted-foreground">{r.bank_name}</div>
                  )}
                </div>
              ),
            },
            {
              key: "status",
              label: "Statut",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "date",
              label: "Date",
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (r) => (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() =>
                          update.mutate({ id: r.id, status: "approved" })
                        }
                        className="text-[11px] font-bold rounded px-2 py-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      >
                        Approuver
                      </button>
                      <button
                        onClick={() => {
                          const note = window.prompt("Motif du refus ?");
                          if (note !== null)
                            update.mutate({
                              id: r.id,
                              status: "rejected",
                              admin_note: note,
                            });
                        }}
                        className="text-[11px] font-bold rounded px-2 py-1 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                      >
                        Refuser
                      </button>
                    </>
                  )}
                  {(r.status === "approved" || r.status === "processing") && (
                    <button
                      onClick={() => {
                        const ref = window.prompt("Référence du virement :");
                        if (ref)
                          update.mutate({
                            id: r.id,
                            status: "paid",
                            payout_reference: ref,
                          });
                      }}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30"
                    >
                      Marquer payé
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={data ?? []}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
    pending: { cls: "bg-amber-500/20 text-amber-300", icon: Clock },
    approved: { cls: "bg-sky-500/20 text-sky-300", icon: CheckCircle2 },
    processing: { cls: "bg-sky-500/20 text-sky-300", icon: Clock },
    paid: { cls: "bg-emerald-500/20 text-emerald-300", icon: Banknote },
    rejected: { cls: "bg-rose-500/20 text-rose-300", icon: XCircle },
    cancelled: { cls: "bg-muted text-muted-foreground", icon: XCircle },
  };
  const m = map[status] ?? map.pending;
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${m.cls}`}
    >
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
}
