import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Headphones,
  Music2,
  Sparkles,
} from "lucide-react";

type Tx = {
  id: string;
  kind:
    | "credit_purchase"
    | "bonus"
    | "debit_listen"
    | "debit_stream"
    | "debit_download"
    | "refund";
  points: number;
  created_at: string;
};

const META: Record<Tx["kind"], { label: string; Icon: typeof Sparkles }> = {
  credit_purchase: { label: "Recharge wallet", Icon: ArrowUpRight },
  bonus: { label: "Bonus", Icon: Sparkles },
  refund: { label: "Remboursement", Icon: ArrowUpRight },
  debit_listen: { label: "Écoute", Icon: Headphones },
  debit_stream: { label: "Streaming premium", Icon: Music2 },
  debit_download: { label: "Téléchargement", Icon: Download },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PointTransactionsList({ transactions }: { transactions: Tx[] }) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground bg-surface/40 border border-border rounded-md p-6">
        Aucune transaction de points pour l'instant.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface/40">
      {transactions.map((t) => {
        const isCredit = t.points > 0;
        const { label, Icon } = META[t.kind] ?? {
          label: t.kind,
          Icon: isCredit ? ArrowUpRight : ArrowDownLeft,
        };
        return (
          <li key={t.id} className="flex items-center gap-4 px-4 py-3">
            <div
              className={`grid place-items-center w-9 h-9 rounded-full shrink-0 ${
                isCredit ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{label}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
            </div>
            <p
              className={`text-sm font-bold tabular-nums ${
                isCredit ? "text-emerald-400" : "text-foreground"
              }`}
            >
              {isCredit ? "+" : ""}
              {t.points} pts
            </p>
          </li>
        );
      })}
    </ul>
  );
}
