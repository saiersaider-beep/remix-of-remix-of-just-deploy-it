import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

type Row = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
};

const STATUSES = ["all", "open", "reviewing", "resolved", "dismissed"] as const;

function ReportsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("open");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: async () => {
      let q = db
        .from("reports")
        .select(
          "id, reporter_id, target_type, target_id, reason, details, status, resolution, created_at",
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
      status: string;
      resolution?: string | null;
    }) => {
      const { error } = await db
        .from("reports")
        .update({
          status: vars.status,
          resolution: vars.resolution ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signalement traité");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Signalements"
        description={`${data?.length ?? 0} entrée(s).`}
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
          empty="Aucun signalement."
          columns={[
            {
              key: "target",
              label: "Cible",
              render: (r) => (
                <div className="text-xs">
                  <div className="font-bold capitalize flex items-center gap-1">
                    <Flag className="w-3 h-3" /> {r.target_type}
                  </div>
                  <code className="text-[11px] text-muted-foreground">
                    {r.target_id.slice(0, 8)}…
                  </code>
                </div>
              ),
            },
            {
              key: "reason",
              label: "Motif",
              render: (r) => (
                <div className="text-xs">
                  <div className="font-semibold capitalize">
                    {r.reason.replace("_", " ")}
                  </div>
                  {r.details && (
                    <div className="text-muted-foreground line-clamp-2 max-w-xs">
                      {r.details}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "reporter",
              label: "Signalé par",
              render: (r) => (
                <code className="text-[11px] text-muted-foreground">
                  {r.reporter_id.slice(0, 8)}…
                </code>
              ),
            },
            {
              key: "status",
              label: "Statut",
              render: (r) => {
                const map: Record<string, string> = {
                  open: "bg-amber-500/20 text-amber-300",
                  reviewing: "bg-sky-500/20 text-sky-300",
                  resolved: "bg-emerald-500/20 text-emerald-300",
                  dismissed: "bg-muted text-muted-foreground",
                };
                return (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${
                      map[r.status] ?? map.open
                    }`}
                  >
                    {r.status}
                  </span>
                );
              },
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
              render: (r) =>
                r.status === "open" || r.status === "reviewing" ? (
                  <div className="flex gap-1.5 justify-end">
                    {r.status === "open" && (
                      <button
                        onClick={() =>
                          update.mutate({ id: r.id, status: "reviewing" })
                        }
                        className="text-[11px] font-bold rounded px-2 py-1 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                      >
                        Prendre
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const note = window.prompt("Résolution :");
                        if (note !== null)
                          update.mutate({
                            id: r.id,
                            status: "resolved",
                            resolution: note,
                          });
                      }}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    >
                      Résoudre
                    </button>
                    <button
                      onClick={() => update.mutate({ id: r.id, status: "dismissed" })}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-muted text-muted-foreground hover:bg-muted/80"
                    >
                      Rejeter
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
