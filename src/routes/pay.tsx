import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { PublicShell } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { initGeniusPayPayment } from "@/lib/geniuspay.functions";
import {
  ShieldCheck,
  Loader2,
  ArrowLeft,
  CreditCard,
  Smartphone,
  Lock,
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
  head: () => ({
    meta: [
      { title: "Paiement sécurisé — VinaSound" },
      {
        name: "description",
        content:
          "Payez votre abonnement PRO, vos chansons ou votre recharge en Mobile Money ou carte bancaire, avec activation instantanée.",
      },
      { property: "og:title", content: "Paiement sécurisé — VinaSound" },
      {
        property: "og:description",
        content: "Paiement instantané par Mobile Money ou carte bancaire sur VinaSound.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

/** Doit rester aligné avec PLANS dans src/lib/geniuspay.server.ts */
const PLAN_PRICES: Record<string, number> = {
  "pro-basic": 1000,
  "pro-premium": 3000,
  "pro-vip": 5000,
};

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function PayPage() {
  const { purpose, target_id, amount: amountFromUrl } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const initPayment = useServerFn(initGeniusPayPayment);

  const [submitting, setSubmitting] = useState(false);

  // Prix de la piste (affichage) — le montant réel est recalculé côté serveur.
  const { data: trackPrice, isLoading: priceLoading } = useQuery({
    queryKey: ["pay-track-price", target_id],
    enabled: purpose === "track" && !!target_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tracks")
        .select("price_amount, title")
        .eq("id", target_id!)
        .maybeSingle();
      return data;
    },
  });

  const computedAmount = useMemo(() => {
    if (purpose in PLAN_PRICES) return PLAN_PRICES[purpose]!;
    if (purpose === "track") return trackPrice?.price_amount ?? 0;
    return amountFromUrl ?? 0;
  }, [purpose, amountFromUrl, trackPrice]);

  const handlePay = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await initPayment({
        data: {
          purpose,
          ...(target_id ? { target_id } : {}),
          ...(purpose === "wallet" ? { amount_xof: computedAmount } : {}),
        },
      });
      // La page de paiement GeniusPay refuse d'être affichée dans une iframe
      // (X-Frame-Options: DENY). On l'ouvre donc dans un nouvel onglet ; si le
      // navigateur bloque la popup, on tente la fenêtre parente puis la page.
      setCheckoutUrl(res.payment_url);
      const win = window.open(res.payment_url, "_blank", "noopener,noreferrer");
      if (!win) {
        try {
          if (window.top && window.top !== window.self) {
            window.top.location.href = res.payment_url;
          } else {
            window.location.assign(res.payment_url);
          }
        } catch {
          toast.error("Ouvre le lien de paiement affiché ci-dessous.");
        }
      }
      setSubmitting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'initialisation du paiement");
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
      <div className="max-w-xl mx-auto py-8 px-4">
        <Link
          to="/go-pro"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="bg-gradient-to-br from-primary via-fuchsia-600 to-indigo-700 text-white p-6">
            <div className="text-xs uppercase tracking-widest font-bold opacity-80">
              Paiement sécurisé
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">
              {PLAN_LABELS[purpose]}
            </h1>
            <div className="mt-3 text-3xl font-black">
              {priceLoading ? "…" : formatXOF(computedAmount)}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <Smartphone className="w-5 h-5 text-primary mb-2" />
                <div className="text-sm font-bold">Mobile Money</div>
                <div className="text-xs text-muted-foreground">
                  Flooz, Mixx by Yas, Wave, Orange, MTN
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <CreditCard className="w-5 h-5 text-primary mb-2" />
                <div className="text-sm font-bold">Carte bancaire</div>
                <div className="text-xs text-muted-foreground">Visa, Mastercard</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Tu seras redirigé vers la page de paiement sécurisée GeniusPay. Les moyens
              de paiement disponibles s'affichent automatiquement selon ton pays.
            </p>


            <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p>
                Paiement <strong>instantané</strong> : dès la confirmation, ton accès est
                débloqué automatiquement. Aucune capture d'écran ni validation manuelle.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={submitting || computedAmount <= 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Redirection…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Payer {formatXOF(computedAmount)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
