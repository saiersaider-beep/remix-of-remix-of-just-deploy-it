import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/banned-ips")({
  component: BannedIpsPage,
});

type Row = {
  id: string;
  ip_address: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
};

function BannedIpsPage() {
  const qc = useQueryClient();
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banned-ips"],
    queryFn: async () => {
      const { data, error } = await db
        .from("banned_ips")
        .select("id, ip_address, reason, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!ip.trim()) throw new Error("IP requise");
      const { error } = await db.from("banned_ips").insert({
        ip_address: ip.trim(),
        reason: reason.trim() || null,
        expires_at: expires ? new Date(expires).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IP bannie");
      setIp("");
      setReason("");
      setExpires("");
      qc.invalidateQueries({ queryKey: ["admin-banned-ips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("banned_ips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IP débloquée");
      qc.invalidateQueries({ queryKey: ["admin-banned-ips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="IPs bannies"
        description={`${data?.length ?? 0} adresse(s) bloquée(s).`}
      />

      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <h3 className="font-display font-bold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Bannir une nouvelle IP
        </h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            placeholder="192.168.1.10"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Motif (optionnel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-500/20 text-rose-300 font-bold text-sm px-4 py-2 hover:bg-rose-500/30 disabled:opacity-50"
        >
          <Ban className="w-4 h-4" /> Bannir
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Row>
          keyOf={(r) => r.id}
          empty="Aucune IP bannie."
          columns={[
            {
              key: "ip",
              label: "Adresse IP",
              render: (r) => <code className="font-mono text-sm">{r.ip_address}</code>,
            },
            {
              key: "reason",
              label: "Motif",
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {r.reason ?? "—"}
                </span>
              ),
            },
            {
              key: "expires",
              label: "Expire",
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {r.expires_at ? new Date(r.expires_at).toLocaleString() : "Jamais"}
                </span>
              ),
            },
            {
              key: "created",
              label: "Banni le",
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "act",
              label: "",
              render: (r) => (
                <button
                  onClick={() => {
                    if (confirm(`Débloquer ${r.ip_address} ?`)) remove.mutate(r.id);
                  }}
                  className="text-[11px] font-bold rounded px-2 py-1 bg-muted text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Débloquer
                </button>
              ),
            },
          ]}
          rows={data ?? []}
        />
      )}
    </>
  );
}
