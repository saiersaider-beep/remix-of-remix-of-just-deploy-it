import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Banknote, Wallet, Clock, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";

export const Route = createFileRoute("/artist/withdraw")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: WithdrawPage,
});

type Balance = {
  currency: string;
  total_earned: number;
  available: number;
  pending_clearance: number;
  paid_out: number;
  locked_in_requests: number;
  withdrawable: number;
};

type Request = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  account_number: string;
  status: string;
  admin_note: string | null;
  payout_reference: string | null;
  created_at: string;
};

function WithdrawPage() {
  const qc = useQueryClient();

  const { data: balances } = useQuery({
    queryKey: ["artist-balance"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as Balance[];
      const { data, error } = await db.rpc("get_artist_balance", {
        p_artist: u.user.id,
      });
      if (error) throw error;
      return (data ?? []) as Balance[];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const { data, error } = await db
        .from("withdrawal_requests")
        .select(
          "id, amount, currency, method, account_number, status, admin_note, payout_reference, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Request[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("withdrawal_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande annulée");
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["artist-balance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const primary = balances?.[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            ← Tableau de bord
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">
            Retirer mes gains
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vos revenus nets par vente sont versés sur le compte indiqué après
            validation par l'équipe.
          </p>
        </div>

        {/* Balances */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <BalanceCard
            label="Disponible"
            amount={primary?.withdrawable ?? 0}
            currency={primary?.currency ?? "XOF"}
            icon={Wallet}
            accent="emerald"
          />
          <BalanceCard
            label="En attente"
            amount={
              (primary?.pending_clearance ?? 0) +
              (primary?.locked_in_requests ?? 0)
            }
            currency={primary?.currency ?? "XOF"}
            icon={Clock}
            accent="amber"
          />
          <BalanceCard
            label="Déjà versé"
            amount={primary?.paid_out ?? 0}
            currency={primary?.currency ?? "XOF"}
            icon={Banknote}
            accent="primary"
          />
        </div>

        {/* New request */}
        <NewRequestForm
          maxAmount={primary?.withdrawable ?? 0}
          currency={primary?.currency ?? "XOF"}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
            qc.invalidateQueries({ queryKey: ["artist-balance"] });
          }}
        />

        {/* History */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold mb-4">Mes demandes</h2>
          {!requests?.length ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Aucune demande pour l'instant.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold">Date</th>
                      <th className="text-left px-4 py-3 font-bold">Montant</th>
                      <th className="text-left px-4 py-3 font-bold">Méthode</th>
                      <th className="text-left px-4 py-3 font-bold">Statut</th>
                      <th className="text-right px-4 py-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-3 text-xs">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {r.amount.toLocaleString()} {r.currency}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="capitalize">
                            {r.method.replace("_", " ")}
                          </div>
                          <div className="text-muted-foreground">
                            {r.account_number}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} note={r.admin_note} />
                          {r.payout_reference && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Réf : {r.payout_reference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === "pending" && (
                            <button
                              onClick={() => cancel.mutate(r.id)}
                              className="text-[11px] font-bold text-rose-400 hover:underline"
                            >
                              Annuler
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  amount,
  currency,
  icon: Icon,
  accent,
}: {
  label: string;
  amount: number;
  currency: string;
  icon: typeof Wallet;
  accent: "primary" | "emerald" | "amber";
}) {
  const ring = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
  }[accent];
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="font-display text-3xl font-bold mt-2">
            {amount.toLocaleString()}{" "}
            <span className="text-base text-muted-foreground">{currency}</span>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-lg grid place-items-center ${ring}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function NewRequestForm({
  maxAmount,
  currency,
  onCreated,
}: {
  maxAmount: number;
  currency: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<"bank" | "mobile_money" | "paypal">(
    "bank",
  );
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error("Montant invalide");
      if (amount > maxAmount)
        throw new Error("Montant supérieur au solde disponible");
      if (!accountNumber) throw new Error("Numéro de compte requis");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non connecté");
      const { error } = await db.from("withdrawal_requests").insert({
        artist_id: u.user.id,
        amount,
        currency,
        method,
        account_holder: accountHolder || null,
        account_number: accountNumber,
        bank_name: bankName || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée");
      setOpen(false);
      setAmount(0);
      setAccountHolder("");
      setAccountNumber("");
      setBankName("");
      setNotes("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={maxAmount <= 0}
        className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
      >
        <ArrowDownToLine className="w-4 h-4" />
        Demander un retrait
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-lg font-bold mb-4">Nouvelle demande</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={`Montant (max ${maxAmount.toLocaleString()} ${currency})`}>
          <input
            type="number"
            min={1}
            max={maxAmount}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Méthode">
          <select
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as "bank" | "mobile_money" | "paypal")
            }
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="bank">Virement bancaire</option>
            <option value="mobile_money">Mobile money</option>
            <option value="paypal">PayPal</option>
          </select>
        </Field>
        <Field label="Titulaire du compte">
          <input
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field
          label={
            method === "paypal"
              ? "Email PayPal"
              : method === "mobile_money"
                ? "Numéro mobile money"
                : "IBAN / Numéro de compte"
          }
        >
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        {method === "bank" && (
          <Field label="Nom de la banque" full>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        )}
        <Field label="Notes (facultatif)" full>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={() => setOpen(false)}
          className="text-sm font-semibold px-4 py-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          Annuler
        </button>
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="text-sm font-bold px-5 py-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {submit.isPending ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-muted-foreground block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({
  status,
  note,
}: {
  status: string;
  note?: string | null;
}) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300",
    approved: "bg-sky-500/20 text-sky-300",
    processing: "bg-sky-500/20 text-sky-300",
    paid: "bg-emerald-500/20 text-emerald-300",
    rejected: "bg-rose-500/20 text-rose-300",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <div>
      <span
        className={`inline-flex text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${
          map[status] ?? map.pending
        }`}
      >
        {status}
      </span>
      {note && status === "rejected" && (
        <div className="text-[10px] text-rose-300 mt-1 italic">{note}</div>
      )}
    </div>
  );
}
