import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PointsBalanceBadge } from "@/components/PointsBalanceBadge";
import { Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownToLine,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  getWalletSummary,
  creditWallet,
  requestWithdrawal,
} from "@/lib/wallet.functions";


export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Wallet — VinaSound" }] }),
  component: () => (
    <AuthGate>
      <WalletPage />
    </AuthGate>
  ),
});

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000];

function fmtXof(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XOF";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tx = {
  id: string;
  kind: "credit" | "debit" | "withdrawal" | "purchase" | "refund";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amount_xof: number;
  description: string | null;
  reference: string | null;
  created_at: string;
  settled_at: string | null;
};




function WalletPage() {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getWalletSummary);
  const creditFn = useServerFn(creditWallet);
  const withdrawFn = useServerFn(requestWithdrawal);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["wallet-summary"],
    queryFn: () => fetchSummary(),
  });


  const [creditOpen, setCreditOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(2500);

  const [withdrawAmount, setWithdrawAmount] = useState<number>(5000);
  const [withdrawMethod, setWithdrawMethod] =
    useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const creditMut = useMutation({
    mutationFn: (amount: number) =>
      creditFn({ data: { amountXof: amount } }),
    onSuccess: ({ link }) => {
      window.location.href = link;
    },
    onError: (e: Error) => setErr(e.message),
  });


  const withdrawMut = useMutation({
    mutationFn: (input: {
      amountXof: number;
      method: "mobile_money" | "bank_transfer";
      destination: string;
    }) => withdrawFn({ data: input }),
    onSuccess: () => {
      setWithdrawOpen(false);
      setWithdrawDest("");
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const balance = data?.balance_xof ?? 0;
  const txs = (data?.transactions ?? []) as unknown as Tx[];

  return (
    <main className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Finances"
        accent="Mon"
        title="wallet"
        description="Crédite ton solde, achète plus rapidement et retire tes gains."
      />

      {/* Solde card */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 mb-8 bg-gradient-to-br from-primary via-primary to-accent-cyan text-primary-foreground shadow-glow">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 text-sm opacity-90">
            <WalletIcon className="w-5 h-5" /> Solde disponible
          </div>
          <p className="font-display text-4xl sm:text-5xl font-extrabold mt-2 tabular-nums">
            {isLoading ? "…" : fmtXof(balance)}
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => { setErr(null); setCreditOpen(true); }}
              className="bg-white text-primary rounded-full px-4 py-2 text-sm font-bold inline-flex items-center gap-2 hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> Créditer
            </button>
            <button
              onClick={() => { setErr(null); setWithdrawOpen(true); }}
              className="border border-white/50 rounded-full px-4 py-2 text-sm font-bold inline-flex items-center gap-2 hover:bg-white/10 transition"
            >
              <ArrowDownToLine className="w-4 h-4" /> Retirer
            </button>
          </div>
        </div>
      </div>




      {/* Points : crédités automatiquement à chaque recharge (100 FCFA = 10 pts) */}
      <Link
        to="/point-system"
        className="flex items-center justify-between gap-4 mb-8 rounded-xl border border-border bg-surface/40 hover:bg-surface/60 transition px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-primary/15 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Mes points
            </p>
            <p className="text-sm text-foreground">
              100 FCFA rechargés ={" "}
              <span className="font-bold">10 pts</span> · sert à écouter / télécharger
            </p>
          </div>
        </div>
        <PointsBalanceBadge />
      </Link>

      {err && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {/* Modals */}
      {creditOpen && (
        <Modal title="Créditer mon wallet" onClose={() => setCreditOpen(false)}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setCreditAmount(a)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  creditAmount === a
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {fmtXof(a)}
              </button>
            ))}
          </div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Ou montant personnalisé
          </label>
          <input
            type="number"
            min={500}
            step={100}
            value={creditAmount}
            onChange={(e) => setCreditAmount(Number(e.target.value) || 0)}
            className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary mb-4"
          />
          <p className="text-xs text-muted-foreground mb-4">
            Mobile Money (Flooz, Mixx by Yas, Wave, Orange, MTN) ou carte bancaire.
            Ton solde est crédité automatiquement dès la confirmation du paiement.
          </p>
          <button
            disabled={creditMut.isPending || creditAmount < 500}
            onClick={() => creditMut.mutate(creditAmount)}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold disabled:opacity-60 hover:opacity-90"
          >
            {creditMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Payer {fmtXof(creditAmount)}
          </button>
        </Modal>
      )}


      {withdrawOpen && (
        <Modal title="Demander un retrait" onClose={() => setWithdrawOpen(false)}>
          <p className="text-sm text-muted-foreground mb-4">
            Solde disponible : <span className="font-bold text-foreground">{fmtXof(balance)}</span>
          </p>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Montant (XOF)
          </label>
          <input
            type="number"
            min={1000}
            step={100}
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
            className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary mb-4"
          />
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Méthode
          </label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { id: "mobile_money", label: "Mobile Money" },
              { id: "bank_transfer", label: "Virement" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setWithdrawMethod(m.id as "mobile_money" | "bank_transfer")}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  withdrawMethod === m.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
            {withdrawMethod === "mobile_money" ? "Numéro de téléphone" : "IBAN / N° de compte"}
          </label>
          <input
            value={withdrawDest}
            onChange={(e) => setWithdrawDest(e.target.value)}
            placeholder={withdrawMethod === "mobile_money" ? "+228 90 00 00 00" : "TG XX XXXX..."}
            className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary mb-4"
          />
          <button
            disabled={
              withdrawMut.isPending ||
              withdrawAmount < 1000 ||
              withdrawAmount > balance ||
              withdrawDest.trim().length < 4
            }
            onClick={() =>
              withdrawMut.mutate({
                amountXof: withdrawAmount,
                method: withdrawMethod,
                destination: withdrawDest.trim(),
              })
            }
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold disabled:opacity-60 hover:opacity-90"
          >
            {withdrawMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Demander le retrait
          </button>
        </Modal>
      )}




      {/* Historique */}
      <h2 className="font-display text-xl font-extrabold uppercase mb-4">Historique</h2>

      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          Impossible de charger les transactions.{" "}
          <button onClick={() => refetch()} className="underline font-bold">
            Réessayer
          </button>
        </div>
      )}

      {!isError && txs.length === 0 && !isLoading && (
        <EmptyState
          title="Aucune transaction"
          hint="Tes paiements et retraits apparaîtront ici."
        />
      )}

      {txs.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface/40">
          {txs.map((t) => (
            <TxRow key={t.id} tx={t} />
          ))}
        </ul>
      )}
    </main>
  );
}

function TxRow({ tx }: { tx: Tx }) {
  const isCredit = tx.kind === "credit" || tx.kind === "refund";
  const Icon =
    tx.kind === "purchase"
      ? ShoppingBag
      : tx.kind === "withdrawal"
        ? ArrowDownLeft
        : isCredit
          ? ArrowUpRight
          : ArrowDownLeft;

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div
        className={`grid place-items-center w-10 h-10 rounded-full shrink-0 ${
          isCredit ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {tx.description ?? tx.kind}
        </p>
        <p className="text-xs text-muted-foreground">{fmtDate(tx.created_at)}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-bold tabular-nums ${
            isCredit ? "text-emerald-400" : "text-foreground"
          }`}
        >
          {isCredit ? "+" : "−"}
          {fmtXof(tx.amount_xof)}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Tx["status"] }) {
  const map = {
    succeeded: { label: "Réussi", Icon: CheckCircle2, cls: "text-emerald-400" },
    pending: { label: "En attente", Icon: Clock, cls: "text-amber-400" },
    failed: { label: "Échoué", Icon: XCircle, cls: "text-destructive" },
    cancelled: { label: "Annulé", Icon: XCircle, cls: "text-muted-foreground" },
  } as const;
  const { label, Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-glow"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-extrabold">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

