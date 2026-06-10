import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import {
  listPendingTopups,
  approveTopup,
  rejectTopup,
  amIAdmin,
} from "@/lib/topup.functions";
import { CheckCircle2, XCircle, Loader2, Smartphone, Clock, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/topups")({
  head: () => ({ meta: [{ title: "Admin · Recharges — VinaSound" }] }),
  component: () => (
    <AuthGate>
      <AdminTopupsPage />
    </AuthGate>
  ),
});

type Row = {
  id: string;
  user_id: string;
  amount_xof: number;
  operator: "tmoney" | "flooz";
  phone: string;
  reference_code: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
  display_name: string | null;
};

function fmtXof(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XOF";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function AdminTopupsPage() {
  const qc = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const list = useServerFn(listPendingTopups);
  const approve = useServerFn(approveTopup);
  const reject = useServerFn(rejectTopup);

  const { data: adminCheck, isLoading: loadingAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => checkAdmin(),
  });

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: () => list() as Promise<Row[]>,
    enabled: !!adminCheck?.isAdmin,
  });

  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { requestId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-topups"] }),
  });
  const rejectMut = useMutation({
    mutationFn: (input: { requestId: string; reason: string }) => reject({ data: input }),
    onSuccess: () => {
      setRejectingId(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-topups"] });
    },
  });

  if (loadingAdmin) {
    return <main className="p-10 text-center text-muted-foreground text-sm">Vérification…</main>;
  }
  if (!adminCheck?.isAdmin) {
    return (
      <main className="p-4 sm:p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h1 className="font-display text-xl font-extrabold mb-2">Accès refusé</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Cette page est réservée aux administrateurs.
          </p>
          <Link to="/wallet" className="text-primary underline font-semibold text-sm">
            Retour au wallet
          </Link>
        </div>
      </main>
    );
  }

  const filtered = (rows ?? []).filter((r) => filter === "all" || r.status === "pending");

  return (
    <main className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Admin"
        accent="Recharges"
        title="à valider"
        description="Valide ou rejette les paiements TMoney / Flooz reçus. Une validation crédite automatiquement le wallet du user."
      />

      <div className="flex gap-2 mb-6">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              filter === f ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "pending" ? "En attente" : "Tout"}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">Erreur : {(error as Error).message}</p>}

      {!isLoading && filtered.length === 0 && (
        <EmptyState title="Aucune recharge" hint="Tout est à jour." />
      )}

      <ul className="space-y-3">
        {filtered.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="font-bold text-lg tabular-nums">{fmtXof(r.amount_xof)}</span>
                  <span className="text-xs uppercase font-bold text-muted-foreground">
                    {r.operator === "tmoney" ? "TMoney" : "Flooz"}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">User : </span>
                  <span className="font-semibold">{r.display_name ?? r.user_id.slice(0, 8)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Téléphone : </span>
                  <span className="font-mono">{r.phone}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Réf : </span>
                  <span className="font-mono font-bold">{r.reference_code}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Créée {fmtDate(r.created_at)}
                  {r.processed_at && ` · Traitée ${fmtDate(r.processed_at)}`}
                </p>
                {r.rejection_reason && (
                  <p className="text-xs text-destructive mt-1">Motif : {r.rejection_reason}</p>
                )}
              </div>

              {r.status === "pending" && (
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <button
                    onClick={() => approveMut.mutate(r.id)}
                    disabled={approveMut.isPending}
                    className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-full px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-60"
                  >
                    {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Valider
                  </button>
                  <button
                    onClick={() => { setRejectingId(r.id); setReason(""); }}
                    className="inline-flex items-center justify-center gap-2 border border-destructive/60 text-destructive rounded-full px-4 py-2 text-sm font-bold hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4" /> Rejeter
                  </button>
                </div>
              )}
            </div>

            {rejectingId === r.id && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
                  Motif du rejet
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Paiement non reçu, montant incorrect…"
                  className="w-full bg-surface border border-border rounded-md px-4 py-2 text-sm outline-none focus:border-primary mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMut.mutate({ requestId: r.id, reason: reason.trim() })}
                    disabled={rejectMut.isPending || reason.trim().length < 1}
                    className="bg-destructive text-destructive-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-60"
                  >
                    {rejectMut.isPending ? "…" : "Confirmer le rejet"}
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  const map = {
    pending: { label: "En attente", Icon: Clock, cls: "bg-amber-500/15 text-amber-400" },
    approved: { label: "Validée", Icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400" },
    rejected: { label: "Rejetée", Icon: XCircle, cls: "bg-destructive/15 text-destructive" },
  } as const;
  const { label, Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}
