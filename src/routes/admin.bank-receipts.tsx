import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/bank-receipts")({
  component: ReceiptsPage,
});

type Row = {
  id: string;
  user_id: string;
  purpose: string;
  amount: number;
  currency: string;
  receipt_url: string;
  reference: string | null;
  message: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const STATUSES = ["all", "pending", "approved", "rejected"] as const;

function ReceiptsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-receipts", filter],
    queryFn: async () => {
      let q = db
        .from("bank_receipts")
        .select(
          "id, user_id, purpose, amount, currency, receipt_url, reference, message, status, admin_note, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const review = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: "approved" | "rejected";
      admin_note?: string | null;
    }) => {
      const { error } = await db
        .from("bank_receipts")
        .update({
          status: vars.status,
          admin_note: vars.admin_note ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reçu mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-receipts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Reçus bancaires"
        description={`${data?.length ?? 0} reçu(s).`}
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
          empty="Aucun reçu en attente."
          columns={[
            {
              key: "user",
              label: "Utilisateur",
              render: (r) => (
                <code className="text-[11px] text-muted-foreground">
                  {r.user_id.slice(0, 8)}…
                </code>
              ),
            },
            {
              key: "purpose",
              label: "Motif",
              render: (r) => (
                <span className="text-xs font-semibold capitalize">
                  {r.purpose.replace("_", " ")}
                </span>
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
              key: "ref",
              label: "Référence",
              render: (r) => (
                <code className="text-[11px]">{r.reference ?? "—"}</code>
              ),
            },
            {
              key: "receipt",
              label: "Justificatif",
              render: (r) => (
                <a
                  href={r.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir <ExternalLink className="w-3 h-3" />
                </a>
              ),
            },
            {
              key: "status",
              label: "Statut",
              render: (r) => {
                const map = {
                  pending: { c: "bg-amber-500/20 text-amber-300", I: Clock },
                  approved: { c: "bg-emerald-500/20 text-emerald-300", I: CheckCircle2 },
                  rejected: { c: "bg-rose-500/20 text-rose-300", I: XCircle },
                } as const;
                const m = map[r.status as keyof typeof map] ?? map.pending;
                const Icon = m.I;
                return (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${m.c}`}
                  >
                    <Icon className="w-3 h-3" /> {r.status}
                  </span>
                );
              },
            },
            {
              key: "actions",
              label: "",
              render: (r) =>
                r.status === "pending" ? (
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => review.mutate({ id: r.id, status: "approved" })}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    >
                      Approuver
                    </button>
                    <button
                      onClick={() => {
                        const note = window.prompt("Motif du refus ?");
                        if (note !== null)
                          review.mutate({
                            id: r.id,
                            status: "rejected",
                            admin_note: note,
                          });
                      }}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                    >
                      Refuser
                    </button>
                  </div>
                ) : null,
            },
          ]}
          rows={data ?? []}
        />
      )}
    </>
  );
}
