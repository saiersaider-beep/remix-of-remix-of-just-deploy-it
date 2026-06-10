import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { Crown, Clock, CheckCircle2, XCircle, Receipt, CreditCard, Calendar, Loader2 } from "lucide-react";
import { getMyBilling } from "@/lib/billing.functions";

const PLAN_LABELS: Record<string, string> = {
  "pro-month": "PRO Monthly",
  "pro-year": "PRO Yearly",
  "pro-life": "PRO Lifetime",
  premium_user: "Premium",
};

export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "My subscription — VinaSound" },
      { name: "description", content: "Manage your VinaSound PRO subscription, view your renewal date and payment history." },
    ],
  }),
  component: SubscriptionPage,
});

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  return `${currency ?? ""} ${amount}`.trim();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    active: { label: "Active", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", Icon: CheckCircle2 },
    pending: { label: "En attente", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", Icon: Clock },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border", Icon: Clock };
  const Icon = v.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-full border px-2.5 py-1 ${v.cls}`}>
      <Icon className="w-3.5 h-3.5" /> {v.label}
    </span>
  );
}

function SubscriptionPage() {
  const fetchBilling = useServerFn(getMyBilling);
  const { data, isLoading } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => fetchBilling(),
  });

  const subscriptions = data?.subscriptions ?? [];
  const purchases = data?.purchases ?? [];
  const active = subscriptions.find((s) => s.status === "active");
  const current = active ?? subscriptions[0];

  return (
    <AuthGate>
      <PageHeader
        eyebrow="Billing"
        accent="My"
        title="Abonnement"
        description="View your current plan, next renewal date and payment history."
        actions={
          <Link
            to="/go-pro"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-bold hover:bg-primary/90 transition"
          >
            <Crown className="w-4 h-4" /> {active ? "Manage plan" : "Go PRO"}
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Current plan card */}
          <section className="mb-10">
            {current ? (
              <div className="rounded-md border border-border bg-surface/40 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Current plan</p>
                    <div className="flex items-center gap-3">
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-primary/15 text-primary">
                        <Crown className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="font-display text-xl font-extrabold">
                          {PLAN_LABELS[current.plan] ?? current.plan}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(current.amount, current.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={current.status} />
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
                  <Stat
                    icon={Calendar}
                    label="Started"
                    value={formatDate(current.current_period_start ?? current.created_at)}
                  />
                  <Stat
                    icon={Clock}
                    label={current.plan === "pro-life" ? "Validity" : "Next renewal"}
                    value={
                      current.plan === "pro-life"
                        ? "Lifetime"
                        : formatDate(current.current_period_end)
                    }
                  />
                  <Stat
                    icon={Receipt}
                    label="Reference"
                    value={current.flw_tx_ref ?? "—"}
                    mono
                  />
                </div>

                {current.status === "pending" && (
                  <p className="mt-6 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                    Payment is being confirmed. This usually takes a few seconds. Refresh in a moment.
                  </p>
                )}
                {current.cancelled_at && (
                  <p className="mt-6 text-xs text-muted-foreground">
                    Cancelled on {formatDate(current.cancelled_at)}.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-10 text-center">
                <Crown className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-bold">You're on the Free plan</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upgrade to PRO to unlock unlimited uploads, ad-free streaming and more.
                </p>
                <Link
                  to="/go-pro"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold mt-5 hover:bg-primary/90 transition"
                >
                  <Crown className="w-4 h-4" /> Go PRO
                </Link>
              </div>
            )}
          </section>

          {/* Subscription history */}
          {subscriptions.length > 1 && (
            <section className="mb-10">
              <h2 className="font-display text-xl font-extrabold mb-4">Subscription history</h2>
              <div className="overflow-hidden rounded-md border border-border bg-surface/40">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-left">
                    <tr>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th>Period</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td className="p-4 font-semibold">{PLAN_LABELS[s.plan] ?? s.plan}</td>
                        <td className="p-4"><StatusBadge status={s.status} /></td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(s.current_period_start ?? s.created_at)} → {formatDate(s.current_period_end)}
                        </td>
                        <td className="p-4 text-right font-bold">{formatMoney(s.amount, s.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Payment history */}
          <section>
            <h2 className="font-display text-xl font-extrabold mb-4 inline-flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Payment history
            </h2>
            {purchases.length === 0 && subscriptions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No payments yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-surface/40">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-left">
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Reference</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ...subscriptions.map((s) => ({
                        id: `sub-${s.id}`,
                        date: s.current_period_start ?? s.created_at,
                        kind: PLAN_LABELS[s.plan] ?? s.plan,
                        ref: s.flw_tx_ref,
                        status: s.status,
                        amount: s.amount,
                        currency: s.currency,
                      })),
                      ...purchases.map((p) => ({
                        id: `pur-${p.id}`,
                        date: p.paid_at ?? p.created_at,
                        kind: p.album_id ? "Album purchase" : p.track_id ? "Track purchase" : "Purchase",
                        ref: p.flw_tx_ref,
                        status: p.status,
                        amount: p.amount,
                        currency: p.currency,
                      })),
                    ]
                      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
                      .map((row) => (
                        <tr key={row.id}>
                          <td className="p-4 text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="p-4 font-semibold">{row.kind}</td>
                          <td className="p-4 text-xs font-mono text-muted-foreground truncate max-w-[200px]">{row.ref ?? "—"}</td>
                          <td className="p-4"><StatusBadge status={row.status} /></td>
                          <td className="p-4 text-right font-bold">{formatMoney(row.amount, row.currency)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AuthGate>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground ${className}`}>{children}</th>;
}

function Stat({ icon: Icon, label, value, mono }: { icon: typeof Calendar; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1.5 inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className={`font-bold ${mono ? "text-xs font-mono break-all" : ""}`}>{value}</p>
    </div>
  );
}
