import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

type Row = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  flw_tx_ref: string;
  created_at: string;
  paid_at: string | null;
};

function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, amount, currency, status, flw_tx_ref, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <>
      <AdminPageHeader title="Paiements" description={`${data?.length ?? 0} transactions.`} />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Row>
          keyOf={(r) => r.id}
          empty="Aucune transaction."
          columns={[
            { key: "ref", label: "Référence", render: (r) => <code className="text-xs">{r.flw_tx_ref}</code> },
            { key: "amount", label: "Montant", render: (r) => `${r.amount.toLocaleString()} ${r.currency}` },
            {
              key: "status",
              label: "Statut",
              render: (r) => {
                const cls =
                  r.status === "successful"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : r.status === "failed"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-amber-500/20 text-amber-300";
                return (
                  <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${cls}`}>
                    {r.status}
                  </span>
                );
              },
            },
            { key: "date", label: "Date", render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
          rows={data ?? []}
        />
      )}
    </>
  );
}