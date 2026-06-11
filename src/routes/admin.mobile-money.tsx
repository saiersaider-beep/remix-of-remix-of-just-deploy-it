import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/AdminLayout";
import {
  listMobileMoneyPayments,
  approveMobileMoneyPayment,
  rejectMobileMoneyPayment,
  getMobileMoneySettings,
  updateMobileMoneySettings,
} from "@/lib/mobile-money.functions";
import {
  getPaygateAdminSettings,
  updatePaygateSettings,
} from "@/lib/paygate.functions";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Loader2, ImageIcon, Save, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/mobile-money")({
  head: () => ({ meta: [{ title: "Paiements Mobile Money — Admin" }] }),
  component: MobileMoneyAdminPage,
});

type Row = {
  id: string;
  user_id: string;
  email: string | null;
  purpose: string;
  target_id: string | null;
  amount_xof: number;
  operator: "flooz" | "yas";
  merchant_number: string;
  full_name: string;
  phone: string;
  transaction_ref: string | null;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  created_at: string;
};

function MobileMoneyAdminPage() {
  const listFn = useServerFn(listMobileMoneyPayments);
  const approveFn = useServerFn(approveMobileMoneyPayment);
  const rejectFn = useServerFn(rejectMobileMoneyPayment);
  const getSettings = useServerFn(getMobileMoneySettings);
  const updateSettings = useServerFn(updateMobileMoneySettings);
  const getPaygate = useServerFn(getPaygateAdminSettings);
  const updatePaygate = useServerFn(updatePaygateSettings);

  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettings>> | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [paygate, setPaygate] = useState<{ paygate_api_key: string; paygate_enabled: boolean } | null>(null);
  const [savingPaygate, setSavingPaygate] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listFn({ data: { status: tab } });
      setRows(data as Row[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    void getSettings().then(setSettings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm("Valider ce paiement et débloquer l'accès à l'utilisateur ?")) return;
    setActing(id);
    try {
      await approveFn({ data: { id } });
      toast.success("Paiement validé");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Raison du refus (optionnel) :") ?? undefined;
    setActing(id);
    try {
      await rejectFn({ data: { id, reason } });
      toast.success("Paiement refusé");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActing(null);
    }
  };

  const handleViewScreenshot = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("mm-receipts")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Impossible d'ouvrir la capture");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await updateSettings({
        data: {
          flooz_number: settings.flooz_number,
          yas_number: settings.yas_number,
          plan_basic_xof: settings.plan_basic_xof,
          plan_premium_xof: settings.plan_premium_xof,
          plan_vip_xof: settings.plan_vip_xof,
          plan_basic_days: settings.plan_basic_days,
          plan_premium_days: settings.plan_premium_days,
          plan_vip_days: settings.plan_vip_days,
        },
      });
      toast.success("Paramètres sauvegardés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingSettings(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

  return (
    <>
      <AdminPageHeader
        title="Paiements Mobile Money"
        description="Validation manuelle des paiements Flooz / Yas soumis par les utilisateurs."
        actions={
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-bold hover:bg-muted/30"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
        }
      />

      {/* Settings */}
      {settings && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-display text-lg font-bold mb-4">Paramètres marchand & tarifs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field
              label="Numéro Flooz"
              value={settings.flooz_number}
              onChange={(v) => setSettings({ ...settings, flooz_number: v })}
            />
            <Field
              label="Numéro Yas"
              value={settings.yas_number}
              onChange={(v) => setSettings({ ...settings, yas_number: v })}
            />
            <NumField
              label="Basic (FCFA)"
              value={settings.plan_basic_xof}
              onChange={(v) => setSettings({ ...settings, plan_basic_xof: v })}
            />
            <NumField
              label="Basic (jours)"
              value={settings.plan_basic_days}
              onChange={(v) => setSettings({ ...settings, plan_basic_days: v })}
            />
            <NumField
              label="Premium (FCFA)"
              value={settings.plan_premium_xof}
              onChange={(v) => setSettings({ ...settings, plan_premium_xof: v })}
            />
            <NumField
              label="Premium (jours)"
              value={settings.plan_premium_days}
              onChange={(v) => setSettings({ ...settings, plan_premium_days: v })}
            />
            <NumField
              label="VIP (FCFA)"
              value={settings.plan_vip_xof}
              onChange={(v) => setSettings({ ...settings, plan_vip_xof: v })}
            />
            <NumField
              label="VIP (jours)"
              value={settings.plan_vip_days}
              onChange={(v) => setSettings({ ...settings, plan_vip_days: v })}
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60"
          >
            {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["pending", "approved", "rejected", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t === "pending"
              ? "En attente"
              : t === "approved"
                ? "Validés"
                : t === "rejected"
                  ? "Refusés"
                  : "Tous"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun paiement.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{r.full_name}</span>
                    <span className="text-xs text-muted-foreground">{r.email}</span>
                    <Badge status={r.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString("fr-FR")} ·{" "}
                    <span className="uppercase font-mono">{r.operator}</span> · Tél : {r.phone}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-bold text-primary">{fmt(r.amount_xof)}</span>
                    {" — "}
                    <span className="text-muted-foreground">{r.purpose}</span>
                    {r.target_id && (
                      <span className="text-muted-foreground"> ({r.target_id.slice(0, 8)}…)</span>
                    )}
                  </div>
                  {r.transaction_ref && (
                    <div className="text-xs mt-1">
                      ID SMS :{" "}
                      <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                        {r.transaction_ref}
                      </span>
                    </div>
                  )}
                  {r.admin_notes && (
                    <div className="text-xs text-rose-400 mt-1">Note: {r.admin_notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.screenshot_url && (
                    <button
                      onClick={() => handleViewScreenshot(r.screenshot_url!)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted/30"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Capture
                    </button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={acting === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:opacity-90 disabled:opacity-60"
                      >
                        {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Valider
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={acting === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:opacity-90 disabled:opacity-60"
                      >
                        <X className="w-3.5 h-3.5" /> Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Badge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: "bg-amber-500/20 text-amber-400",
    approved: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-rose-500/20 text-rose-400",
  } as const;
  const label = { pending: "En attente", approved: "Validé", rejected: "Refusé" }[status];
  return (
    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${map[status]}`}>
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground font-medium mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary outline-none"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground font-medium mb-1">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary outline-none"
      />
    </label>
  );
}
