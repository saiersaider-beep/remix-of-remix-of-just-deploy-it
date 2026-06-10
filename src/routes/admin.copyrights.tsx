import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/copyrights")({
  component: CopyrightPage,
});

type Row = {
  id: string;
  claimant_name: string;
  claimant_email: string;
  claimant_company: string | null;
  track_id: string | null;
  track_url: string | null;
  original_work: string;
  evidence_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const STATUSES = ["all", "open", "reviewing", "accepted", "rejected", "withdrawn"] as const;

function CopyrightPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("open");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-copyright", filter],
    queryFn: async () => {
      let q = db
        .from("copyright_claims")
        .select(
          "id, claimant_name, claimant_email, claimant_company, track_id, track_url, original_work, evidence_url, status, admin_note, created_at",
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
      status: string;
      admin_note?: string | null;
    }) => {
      const { error } = await db
        .from("copyright_claims")
        .update({
          status: vars.status,
          admin_note: vars.admin_note ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plainte mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-copyright"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Plaintes copyright"
        description={`${data?.length ?? 0} plainte(s).`}
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
          empty="Aucune plainte."
          columns={[
            {
              key: "claimant",
              label: "Plaignant",
              render: (r) => (
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-1">
                    <Scale className="w-3 h-3" /> {r.claimant_name}
                  </div>
                  <div className="text-muted-foreground">{r.claimant_email}</div>
                  {r.claimant_company && (
                    <div className="text-muted-foreground italic">
                      {r.claimant_company}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "work",
              label: "Œuvre originale",
              render: (r) => (
                <div className="text-xs max-w-xs">
                  <div className="font-semibold">{r.original_work}</div>
                  {r.evidence_url && (
                    <a
                      href={r.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Preuve <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ),
            },
            {
              key: "track",
              label: "Piste visée",
              render: (r) => (
                <div className="text-xs">
                  {r.track_url ? (
                    <a
                      href={r.track_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Voir <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <code className="text-[11px] text-muted-foreground">
                      {r.track_id?.slice(0, 8) ?? "—"}
                    </code>
                  )}
                </div>
              ),
            },
            {
              key: "status",
              label: "Statut",
              render: (r) => {
                const map: Record<string, string> = {
                  open: "bg-amber-500/20 text-amber-300",
                  reviewing: "bg-sky-500/20 text-sky-300",
                  accepted: "bg-rose-500/20 text-rose-300",
                  rejected: "bg-muted text-muted-foreground",
                  withdrawn: "bg-muted text-muted-foreground",
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
              key: "actions",
              label: "",
              render: (r) =>
                r.status === "open" || r.status === "reviewing" ? (
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => {
                        const note = window.prompt("Note (optionnel) :");
                        review.mutate({
                          id: r.id,
                          status: "accepted",
                          admin_note: note,
                        });
                      }}
                      className="text-[11px] font-bold rounded px-2 py-1 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                    >
                      Accepter (retirer)
                    </button>
                    <button
                      onClick={() => {
                        const note = window.prompt("Motif du rejet :");
                        if (note !== null)
                          review.mutate({
                            id: r.id,
                            status: "rejected",
                            admin_note: note,
                          });
                      }}
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
