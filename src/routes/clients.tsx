import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PublicShell, PageHeader } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { initGeniusPayPayment } from "@/lib/geniuspay.functions";
import {
  Crown,
  Star,
  Zap,
  Wallet,
  FileText,
  ShieldCheck,
  Lock,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Smartphone,
} from "lucide-react";

type OfferId = "pro-basic" | "pro-premium" | "pro-vip" | "wallet";

type Offer = {
  id: OfferId;
  name: string;
  price: number;
  unit: string;
  tagline: string;
  icon: typeof Star;
  highlight?: boolean;
  includes: string[];
};

/** Doit rester aligné avec PLANS côté serveur (src/lib/geniuspay.server.ts). */
const OFFERS: Offer[] = [
  {
    id: "pro-basic",
    name: "Abonnement Basic",
    price: 1000,
    unit: "/ mois",
    tagline: "L'essentiel pour démarrer sur VinaSound.",
    icon: Zap,
    includes: ["Uploads illimités", "Écoute sans publicité", "Badge PRO vérifié"],
  },
  {
    id: "pro-premium",
    name: "Abonnement Premium",
    price: 3000,
    unit: "/ mois",
    tagline: "Pour faire grandir ton audience.",
    icon: Star,
    highlight: true,
    includes: ["Audio 320 kbps", "Statistiques avancées", "Mise en avant 2×/mois"],
  },
  {
    id: "pro-vip",
    name: "Abonnement VIP",
    price: 5000,
    unit: "/ mois",
    tagline: "L'expérience complète des artistes confirmés.",
    icon: Crown,
    includes: ["Audio Lossless", "Spotlight mensuel", "Support WhatsApp 7j/7"],
  },
  {
    id: "wallet",
    name: "Recharge du portefeuille",
    price: 2000,
    unit: "au choix",
    tagline: "Crédite ton wallet pour acheter des sons à l'unité.",
    icon: Wallet,
    includes: ["Montant libre dès 500 FCFA", "Achat instantané de pistes", "Solde toujours disponible"],
  },
];

const WALLET_PRESETS = [1000, 2000, 5000, 10000];

const formatXOF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Espace client — Facture & paiement VinaSound" },
      {
        name: "description",
        content:
          "Choisissez votre offre VinaSound, vérifiez votre facture détaillée puis payez en Mobile Money ou carte bancaire en toute sécurité.",
      },
      { property: "og:title", content: "Espace client — Facture & paiement VinaSound" },
      {
        property: "og:description",
        content:
          "Aperçu de votre facture avant paiement : offre, montant, total et moyen de paiement, sans surprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsHomePage,
});

function ClientsHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initPayment = useServerFn(initGeniusPayPayment);

  const [selected, setSelected] = useState<OfferId>("pro-premium");
  const [walletAmount, setWalletAmount] = useState<number>(2000);
  const [showInvoice, setShowInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offer = OFFERS.find((o) => o.id === selected)!;
  const amount = selected === "wallet" ? walletAmount : offer.price;

  const invoiceNumber = useMemo(
    () => `VS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    // Un numéro par ouverture d'aperçu de facture.
    [showInvoice],
  );

  const invalidWallet = selected === "wallet" && (walletAmount < 500 || walletAmount > 2_000_000);

  const openInvoice = () => {
    if (invalidWallet) {
      toast.error("Le montant doit être compris entre 500 et 2 000 000 FCFA.");
      return;
    }
    setShowInvoice(true);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() =>
        document.getElementById("facture")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const handlePay = async () => {
    if (!user) {
      toast.error("Connecte-toi pour finaliser le paiement.");
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await initPayment({
        data:
          selected === "wallet"
            ? { purpose: "wallet" as const, amount_xof: walletAmount }
            : { purpose: selected },
      });
      if (!res?.payment_url) throw new Error("Lien de paiement indisponible.");
      window.location.href = res.payment_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir le paiement.");
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Espace client"
        accent="Votre"
        title="facture avant paiement"
        description="Choisissez votre offre, vérifiez le détail de la facture, puis réglez en Mobile Money ou par carte. Aucun montant n'est débité avant votre validation."
      />

      {/* Offres */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {OFFERS.map((o) => {
          const Icon = o.icon;
          const active = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setSelected(o.id);
                setShowInvoice(false);
              }}
              className={`text-left rounded-2xl border p-5 transition ${
                active
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border bg-surface/40 hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-6 h-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {o.highlight && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Populaire
                  </span>
                )}
              </div>
              <h2 className="font-display text-lg font-extrabold mt-3">{o.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{o.tagline}</p>
              <p className="mt-3 font-display text-2xl font-extrabold">
                {formatXOF(o.price)}
                <span className="ml-1 text-xs font-bold text-muted-foreground">{o.unit}</span>
              </p>
              <ul className="mt-3 space-y-1">
                {o.includes.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </section>

      {/* Montant libre pour la recharge */}
      {selected === "wallet" && (
        <section className="mb-10 max-w-xl rounded-2xl border border-border bg-surface/40 p-5">
          <h3 className="font-display text-lg font-extrabold mb-3">Montant de la recharge</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {WALLET_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setWalletAmount(p);
                  setShowInvoice(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  walletAmount === p
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {formatXOF(p)}
              </button>
            ))}
          </div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
            Autre montant (FCFA)
          </label>
          <input
            type="number"
            min={500}
            max={2000000}
            step={500}
            value={walletAmount}
            onChange={(e) => {
              setWalletAmount(Number(e.target.value));
              setShowInvoice(false);
            }}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm"
          />
          {invalidWallet && (
            <p className="mt-2 text-xs font-bold text-destructive">
              Montant autorisé : entre 500 et 2 000 000 FCFA.
            </p>
          )}
        </section>
      )}

      {/* Bouton d'affichage de la facture */}
      {!showInvoice && (
        <section className="mb-16 rounded-2xl border border-border bg-surface/40 p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between max-w-3xl">
          <div>
            <p className="font-display text-xl font-extrabold">
              {offer.name} — {formatXOF(amount)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              La facture détaillée s'affiche avant tout paiement.
            </p>
          </div>
          <button
            type="button"
            onClick={openInvoice}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition"
          >
            <FileText className="w-4 h-4" /> Voir ma facture
          </button>
        </section>
      )}

      {/* Facture */}
      {showInvoice && (
        <section id="facture" className="mb-16 max-w-3xl">
          <div className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                  Facture
                </p>
                <h2 className="font-display text-2xl font-extrabold mt-1">{invoiceNumber}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Émise le {new Date().toLocaleDateString("fr-FR")} · Statut :{" "}
                  <span className="font-bold text-amber-500">à payer</span>
                </p>
              </div>
              <div className="text-sm text-right">
                <p className="font-display font-extrabold text-lg">VinaSound</p>
                <p className="text-muted-foreground">Mango, Togo</p>
                <p className="text-muted-foreground">Devise : XOF (FCFA)</p>
              </div>
            </header>

            <div className="grid sm:grid-cols-2 gap-4 border-b border-border p-6 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">
                  Client
                </p>
                <p className="font-bold">{user?.email ?? "Non connecté"}</p>
                {!user && (
                  <p className="text-muted-foreground mt-1">
                    Connectez-vous pour rattacher cette facture à votre compte.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">
                  Moyens de paiement
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone className="w-4 h-4" /> Mobile Money (Flooz, Mixx by Yas)
                </p>
                <p className="flex items-center gap-2 text-muted-foreground mt-1">
                  <CreditCard className="w-4 h-4" /> Carte bancaire
                </p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-background/60 text-left">
                <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="p-4 font-bold">Désignation</th>
                  <th className="p-4 font-bold text-center">Qté</th>
                  <th className="p-4 font-bold text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-4">
                    <p className="font-bold">{offer.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">{offer.tagline}</p>
                  </td>
                  <td className="p-4 text-center">1</td>
                  <td className="p-4 text-right font-mono">{formatXOF(amount)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="p-4 text-muted-foreground" colSpan={2}>
                    Sous-total
                  </td>
                  <td className="p-4 text-right font-mono">{formatXOF(amount)}</td>
                </tr>
                <tr>
                  <td className="px-4 pb-4 text-muted-foreground" colSpan={2}>
                    Frais de service
                  </td>
                  <td className="px-4 pb-4 text-right font-mono">0 FCFA</td>
                </tr>
                <tr className="border-t border-border bg-primary/10">
                  <td className="p-4 font-display font-extrabold" colSpan={2}>
                    Total à payer
                  </td>
                  <td className="p-4 text-right font-display text-xl font-extrabold">
                    {formatXOF(amount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="border-t border-border p-6">
              <p className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                Paiement traité par GeniusPay. Le montant final est recalculé côté serveur : rien
                n'est débité avant votre confirmation chez l'opérateur.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Ouverture du paiement…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Payer {formatXOF(amount)}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoice(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-bold hover:border-primary/50 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Modifier ma commande
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Besoin d'un autre achat ? Parcourez le{" "}
            <Link to="/discover" className="text-primary font-bold hover:underline">
              catalogue
            </Link>{" "}
            ou consultez vos{" "}
            <Link to="/purchased" className="text-primary font-bold hover:underline">
              achats
            </Link>
            .
          </p>
        </section>
      )}
    </PublicShell>
  );
}
