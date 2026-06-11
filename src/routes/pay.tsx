import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { PublicShell } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getMobileMoneySettings,
  submitMobileMoneyPayment,
} from "@/lib/mobile-money.functions";
import {
  getPaygateStatus,
  initPaygatePayment,
  checkPaygateStatus,
} from "@/lib/paygate.functions";
import {
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Upload as UploadIcon,
  Zap,
} from "lucide-react";

const searchSchema = z.object({
  purpose: z
    .enum(["pro-basic", "pro-premium", "pro-vip", "track", "album", "wallet"])
    .default("pro-basic"),
  target_id: z.string().uuid().optional(),
  amount: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/pay")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Paiement Mobile Money — VinaSound" }] }),
  component: PayPage,
});

const PLAN_LABELS: Record<string, string> = {
  "pro-basic": "Abonnement Basic",
  "pro-premium": "Abonnement Premium",
  "pro-vip": "Abonnement VIP",
  track: "Achat d'une chanson",
  album: "Achat d'un album",
  wallet: "Recharge du portefeuille",
};

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function buildUssd(operator: "flooz" | "yas", number: string, amount: number) {
  // Flooz Togo : *155*1*1*NUMERO*MONTANT*CODE_SECRET#
  // Yas (Y'ello / Mixx) Togo : *145*1*1*MONTANT*NUMERO*2*CODE_SECRET#
  if (operator === "flooz") return `*155*1*1*${number}*${amount}*CODE_SECRET#`;
  return `*145*1*1*${amount}*${number}*2*CODE_SECRET#`;
}

function PayPage() {
  const { purpose, target_id, amount: amountFromUrl } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const getSettings = useServerFn(getMobileMoneySettings);
  const submitFn = useServerFn(submitMobileMoneyPayment);
  const getPaygate = useServerFn(getPaygateStatus);
  const initPaygate = useServerFn(initPaygatePayment);
  const checkPaygate = useServerFn(checkPaygateStatus);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["mm-settings"],
    queryFn: () => getSettings(),
  });

  const { data: paygate } = useQuery({
    queryKey: ["paygate-status"],
    queryFn: () => getPaygate(),
  });

  const [mode, setMode] = useState<"auto" | "manual">("manual");
  useEffect(() => {
    if (paygate?.enabled) setMode("auto");
  }, [paygate?.enabled]);

  const computedAmount = useMemo(() => {
    if (!settings) return amountFromUrl ?? 0;
    if (purpose === "pro-basic") return settings.plan_basic_xof;
    if (purpose === "pro-premium") return settings.plan_premium_xof;
    if (purpose === "pro-vip") return settings.plan_vip_xof;
    return amountFromUrl ?? 0;
  }, [settings, purpose, amountFromUrl]);

  const [operator, setOperator] = useState<"flooz" | "yas">("flooz");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [txRef, setTxRef] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // PayGate (auto) flow state
  const [autoPaymentId, setAutoPaymentId] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");

  useEffect(() => {
    if (!autoPaymentId || autoStatus !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await checkPaygate({ data: { payment_id: autoPaymentId } });
        if (res.status === "approved") {
          setAutoStatus("approved");
          toast.success("Paiement confirmé !");
          setTimeout(() => navigate({ to: "/dashboard" }), 1500);
        } else if (res.status === "rejected") {
          setAutoStatus("rejected");
          toast.error("Paiement annulé ou expiré");
        }
      } catch {
        // continue polling
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPaymentId, autoStatus, checkPaygate, navigate]);

  const handleAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Renseigne ton nom et ton numéro");
      return;
    }
    if (computedAmount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSubmitting(true);
    try {
      const res = await initPaygate({
        data: {
          purpose,
          target_id: target_id ?? null,
          amount_xof: computedAmount,
          network: operator === "flooz" ? "FLOOZ" : "TMONEY",
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });
      setAutoPaymentId(res.payment_id);
      setAutoStatus("pending");
      toast.success("Demande envoyée — valide sur ton téléphone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (user?.user_metadata) {
      const meta = user.user_metadata as Record<string, unknown>;
      const first = (meta.first_name as string) || "";
      const last = (meta.last_name as string) || "";
      const full = `${first} ${last}`.trim();
      if (full) setFullName(full);
    }
  }, [user]);

  const merchantNumber =
    operator === "flooz" ? settings?.flooz_number : settings?.yas_number;
  const ussd =
    settings && computedAmount > 0 && merchantNumber
      ? buildUssd(operator, merchantNumber, computedAmount)
      : "";

  const handleCopy = async () => {
    if (!ussd) return;
    try {
      await navigator.clipboard.writeText(ussd);
      setCopied(true);
      toast.success("Code USSD copié");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("mm-receipts")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setScreenshotUrl(path);
      toast.success("Capture envoyée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Connecte-toi d'abord");
      navigate({ to: "/login" });
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Renseigne ton nom et ton numéro");
      return;
    }
    if (computedAmount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSubmitting(true);
    try {
      await submitFn({
        data: {
          purpose,
          target_id: target_id ?? null,
          amount_xof: computedAmount,
          operator,
          full_name: fullName.trim(),
          phone: phone.trim(),
          transaction_ref: txRef.trim() || null,
          screenshot_url: screenshotUrl || null,
        },
      });
      toast.success("Paiement soumis ! Tu seras notifié dès validation.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Soumission échouée");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <PublicShell>
        <div className="max-w-md mx-auto py-20 text-center">
          <h1 className="font-display text-2xl font-bold mb-3">Connexion requise</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Connecte-toi pour effectuer un paiement.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-3 text-sm font-bold"
          >
            Se connecter
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <Link
          to="/go-pro"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="bg-gradient-to-br from-primary via-fuchsia-600 to-indigo-700 text-white p-6">
            <div className="text-xs uppercase tracking-widest font-bold opacity-80">
              Paiement Mobile Money
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">
              {PLAN_LABELS[purpose]}
            </h1>
            <div className="mt-3 text-3xl font-black">
              {settingsLoading ? "…" : formatXOF(computedAmount)}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Mode selector — only if PayGate is enabled */}
            {paygate?.enabled && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/30">
                <button
                  type="button"
                  onClick={() => setMode("auto")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
                    mode === "auto"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Zap className="w-4 h-4" /> Automatique
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
                    mode === "manual"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> Manuel (USSD)
                </button>
              </div>
            )}

            {/* Operator picker */}
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                1. Choisis ton opérateur
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["flooz", "yas"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperator(op)}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      operator === op
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <span className="font-bold uppercase">
                        {op === "flooz" ? "Flooz (Moov)" : "Yas (Mixx by Yas)"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {op === "flooz" ? "*155*1*1#" : "*145*1#"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {mode === "manual" && (
            <>
            {/* USSD instructions */}
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                2. Compose ce code sur ton téléphone
              </div>
              <div className="rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Numéro marchand :{" "}
                  <span className="font-mono font-bold text-foreground">
                    {merchantNumber ?? "…"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <code className="font-mono text-base sm:text-lg font-bold text-primary break-all">
                    {ussd || "…"}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copié" : "Copier"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Remplace <span className="font-mono font-bold">CODE_SECRET</span> par
                  ton code secret Mobile Money. Le montant ({formatXOF(computedAmount)})
                  est déjà inclus dans le code.
                </p>
              </div>
            </div>

            {/* Confirmation form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  3. Confirme ton paiement
                </div>

                <label className="block text-sm mb-1 font-medium">Nom complet *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={120}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 font-medium">
                  Numéro de téléphone payeur *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  maxLength={20}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="Ex: 97000000"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 font-medium">
                  ID de transaction (reçu par SMS)
                </label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="Ex: CI250611.1423.A12345"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommandé : accélère la validation par l'équipe.
                </p>
              </div>

              <div>
                <label className="block text-sm mb-1 font-medium">
                  Capture de paiement (optionnel)
                </label>
                <label
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition ${
                    screenshotUrl
                      ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
                      : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : screenshotUrl ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <UploadIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {uploading
                      ? "Envoi…"
                      : screenshotUrl
                        ? "Capture envoyée"
                        : "Choisir une image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </label>
              </div>

              <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Après envoi, ton paiement passe en <strong>validation manuelle</strong>{" "}
                  (généralement sous 24 h). Tu recevras une notification dès activation.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || settingsLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold hover:opacity-90 transition disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                  </>
                ) : (
                  <>J'ai payé — Soumettre</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
