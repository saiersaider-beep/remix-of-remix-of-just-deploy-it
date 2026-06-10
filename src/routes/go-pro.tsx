import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHeader } from "@/components/PageScaffold";
import {
  Check, Star, Crown, Zap, Upload, Music, Shield, BarChart3,
  Headphones, Award, Heart, Sparkles, Loader2, CreditCard,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { initCinetPayPayment } from "@/lib/cinetpay.functions";

type Plan = {
  id: string;
  name: string;
  price: number;
  period: string;
  tagline: string;
  highlight?: boolean;
  ribbon?: string;
  icon: typeof Star;
  gradient: string;
  features: string[];
  extra?: string;
};

const formatXOF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

const STARTER_FEATURES = [
  "Uploads illimités de morceaux",
  "Écoute sans publicité",
  "Qualité audio 192 kbps",
  "Badge PRO vérifié sur ton profil",
  "Statistiques de base (écoutes, likes)",
  "Support par e-mail sous 48h",
];

const AMBASSADEUR_EXTRA = [
  "Tout PRO Starter, et en plus :",
  "Qualité audio 320 kbps (HD)",
  "Uploads d'albums illimités",
  "Statistiques avancées (audience, géo, revenus)",
  "Mise en avant dans « Découvrir » 2× / mois",
  "Thèmes & couleurs de profil personnalisés",
  "Support prioritaire sous 24h",
];

const LEGENDE_EXTRA = [
  "Tout PRO Ambassadeur, et en plus :",
  "Qualité audio Lossless (FLAC)",
  "Mise en avant illimitée + Spotlight mensuel",
  "Badge « Légende » doré exclusif",
  "Accès anticipé à toutes les nouveautés",
  "Page artiste personnalisée (bannière + lien)",
  "Manager dédié & support WhatsApp 7j/7",
  "Commission réduite sur les ventes (-50%)",
];

const plans: Plan[] = [
  {
    id: "pro-month",
    name: "PRO Starter",
    price: 10000,
    period: "/ an",
    tagline: "L'essentiel pour lancer ta carrière.",
    icon: Zap,
    gradient: "from-sky-500 to-indigo-600",
    features: STARTER_FEATURES,
  },
  {
    id: "pro-year",
    name: "PRO Ambassadeur",
    price: 20000,
    period: "/ an",
    tagline: "Pour faire grandir ton audience.",
    icon: Star,
    highlight: true,
    ribbon: "Le plus choisi",
    gradient: "from-primary to-fuchsia-600",
    features: AMBASSADEUR_EXTRA,
    extra: "2× plus d'avantages que Starter",
  },
  {
    id: "pro-life",
    name: "PRO Légende",
    price: 30000,
    period: "/ an",
    tagline: "L'expérience ultime des artistes confirmés.",
    icon: Crown,
    gradient: "from-amber-500 to-rose-600",
    features: LEGENDE_EXTRA,
    extra: "Avantages exclusifs réservés à l'élite",
  },
];

const features = [
  { icon: Upload, title: "Uploads illimités", desc: "Publie autant de sons et d'albums que tu veux, sans limite quotidienne." },
  { icon: Music, title: "Son haute qualité", desc: "Écoute et téléchargement en qualité premium jusqu'au Lossless (FLAC)." },
  { icon: Shield, title: "Sans publicité", desc: "Profite de la plateforme sans aucune interruption." },
  { icon: BarChart3, title: "Statistiques avancées", desc: "Suis tes écoutes, ton audience, ta géographie et tes revenus en détail." },
  { icon: Award, title: "Badge PRO vérifié", desc: "Démarque-toi avec un badge PRO visible sur ton profil et tes morceaux." },
  { icon: Heart, title: "Support prioritaire", desc: "Une équipe dédiée qui te répond plus vite, en français." },
  { icon: Headphones, title: "Contenus exclusifs", desc: "Accès anticipé aux nouveautés et aux sorties réservées aux PRO." },
  { icon: Sparkles, title: "Mise en avant", desc: "Apparais dans la page Découvrir et le Spotlight pour booster ton audience." },
];

const compare = [
  { label: "Prix", free: "0 FCFA", starter: "10 000 / an", ambassadeur: "20 000 / an", legende: "30 000 / an" },
  { label: "Uploads morceaux", free: "10 / jour", starter: "Illimité", ambassadeur: "Illimité", legende: "Illimité" },
  { label: "Uploads albums", free: "1 / jour", starter: "5 / mois", ambassadeur: "Illimité", legende: "Illimité" },
  { label: "Qualité audio", free: "128 kbps", starter: "192 kbps", ambassadeur: "320 kbps", legende: "Lossless (FLAC)" },
  { label: "Publicités", free: "Oui", starter: "Aucune", ambassadeur: "Aucune", legende: "Aucune" },
  { label: "Badge", free: "—", starter: "PRO vérifié", ambassadeur: "PRO vérifié", legende: "Légende doré" },
  { label: "Statistiques", free: "Basiques", starter: "Basiques", ambassadeur: "Avancées", legende: "Avancées + revenus" },
  { label: "Mise en avant Découvrir", free: "—", starter: "—", ambassadeur: "2× / mois", legende: "Illimitée" },
  { label: "Spotlight mensuel", free: "—", starter: "—", ambassadeur: "—", legende: "Inclus" },
  { label: "Page artiste personnalisée", free: "—", starter: "—", ambassadeur: "—", legende: "Inclus" },
  { label: "Commission sur les ventes", free: "15%", starter: "12%", ambassadeur: "10%", legende: "7,5%" },
  { label: "Support", free: "Communauté", starter: "E-mail 48h", ambassadeur: "Prioritaire 24h", legende: "WhatsApp 7j/7" },
];

const faqs = [
  { q: "Comment fonctionne le paiement ?", a: "Tu payes en toute sécurité via CinetPay : Mobile Money (Orange, MTN, Moov, Wave), carte bancaire ou Visa. Le compte PRO est activé dès la confirmation du paiement." },
  { q: "Puis-je changer de plan plus tard ?", a: "Oui, tu peux passer à un plan supérieur à tout moment depuis ton tableau de bord." },
  { q: "Quels moyens de paiement sont acceptés ?", a: "Mobile Money (Orange Money, MTN, Moov, Wave), cartes bancaires Visa et Mastercard — tout est géré par CinetPay." },
  { q: "Mes informations de paiement sont-elles protégées ?", a: "Oui. Tous les paiements passent par CinetPay, certifié PCI-DSS. Aucune donnée bancaire n'est stockée sur nos serveurs." },
];

export const Route = createFileRoute("/go-pro")({
  head: () => ({
    meta: [
      { title: "Passer PRO — VinaSound" },
      { name: "description", content: "Passe PRO sur VinaSound : uploads illimités, son haute qualité, statistiques avancées et badge vérifié. Paiement Mobile Money & carte." },
      { property: "og:title", content: "Passer PRO — VinaSound" },
      { property: "og:description", content: "Débloque toute la puissance de VinaSound avec un abonnement PRO." },
    ],
  }),
  component: GoProPage,
});

function GoProPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>("pro-year");
  const [loading, setLoading] = useState(false);
  const initPay = useServerFn(initCinetPayPayment);

  const currentPlan = plans.find((p) => p.id === selected)!;

  const handlePay = async () => {
    if (!user) {
      toast.error("Connecte-toi d'abord");
      return;
    }
    try {
      setLoading(true);
      const res = await initPay({
        data: { purpose: selected as "pro-month" | "pro-year" | "pro-life" },
      });
      window.location.href = res.payment_url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec du paiement";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Abonnement"
        accent="Passer"
        title="PRO"
        description="Débloque toute l'expérience VinaSound : uploads illimités, son premium, statistiques détaillées et avantages exclusifs réservés aux PRO."
      />

      {/* Hero CTA */}
      <section className="relative overflow-hidden rounded-2xl p-8 md:p-12 bg-gradient-to-br from-primary via-fuchsia-600 to-indigo-700 text-white mb-12 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold rounded-full px-3 py-1 text-slate-800 bg-slate-50">
            <Crown className="lucide lucide-crown w-3.5 h-3.5 text-slate-800" /> Abonnement premium
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold mt-4 text-white">
            Fais décoller ta musique avec PRO.
          </h2>
          <p className="mt-3 text-white/95 text-base md:text-lg">
            Rejoins les artistes africains qui ont choisi VinaSound PRO pour grandir leur audience, monétiser leurs sons et faire sauter toutes les limites.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <a
              href="#plans"
              className="inline-flex items-center gap-2 bg-white text-foreground rounded-full px-5 py-3 text-sm font-bold hover:bg-white/90 transition shadow-md"
            >
              <Sparkles className="w-4 h-4" /> Voir les plans
            </a>
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 border-2 border-white/60 text-white rounded-full px-5 py-3 text-sm font-bold hover:bg-white/10 transition"
            >
              Continuer à explorer
            </Link>
          </div>
        </div>
        <Crown className="absolute -right-8 -bottom-8 w-72 h-72 opacity-10 text-white" />
      </section>

      {/* Plans */}
      <section id="plans" className="mb-16">
        <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-2 text-foreground">
          Choisis <span className="text-primary">ton plan</span>
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Tarifs en FCFA. Paiement sécurisé via Mobile Money ou carte bancaire.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                className={`relative text-left rounded-2xl p-6 border-2 transition bg-card ${
                  isSelected
                    ? "border-primary shadow-xl shadow-primary/20 scale-[1.01]"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {plan.ribbon && (
                  <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[11px] uppercase tracking-widest font-bold rounded-full px-3 py-1 shadow-md">
                    {plan.ribbon}
                  </span>
                )}
                <div
                  className={`inline-grid place-items-center w-12 h-12 rounded-full bg-gradient-to-br ${plan.gradient} text-white mb-4 shadow-md`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-display text-xl font-extrabold text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
                <p className="mt-4 flex items-baseline gap-2 flex-wrap">
                  <span className="font-display text-3xl md:text-4xl font-extrabold text-foreground">
                    {formatXOF(plan.price)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{plan.period}</span>
                </p>
                {plan.extra && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-1">
                    <Sparkles className="w-3 h-3" /> {plan.extra}
                  </p>
                )}
                <ul className="mt-5 space-y-2 text-sm text-foreground">
                  {plan.features.map((f, i) => {
                    const isHeader = f.startsWith("Tout ");
                    return (
                      <li key={f} className={`flex items-start gap-2 ${isHeader ? "font-bold text-primary pt-1" : ""}`}>
                        {!isHeader && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                        <span>{f}</span>
                      </li>
                    );
                  })}
                </ul>
                <span
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                  {isSelected ? "Plan sélectionné" : "Choisir ce plan"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Checkout bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-md">
          <div className="text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
              Plan sélectionné
            </p>
            <p className="font-bold text-base text-foreground">{currentPlan.name}</p>
            <p className="text-foreground font-semibold">
              {formatXOF(currentPlan.price)}{" "}
              <span className="text-muted-foreground font-normal">{currentPlan.period}</span>
            </p>
          </div>
          <button
            onClick={handlePay}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60 shadow-md"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Payer {formatXOF(currentPlan.price)} avec CinetPay
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-center md:text-left">
          Paiement 100% sécurisé · Mobile Money (Orange, MTN, Moov, Wave) · Visa · Mastercard
        </p>
      </section>

      {/* Features */}
      <section className="mb-16">
        <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-6 text-foreground">
          Tout ce que tu obtiens en <span className="text-primary">PRO</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-primary/15 text-primary mb-3">
                <f.icon className="w-4 h-4" />
              </span>
              <p className="font-bold text-sm text-foreground">{f.title}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section className="mb-16">
        <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-6 text-foreground">
          Comparatif <span className="text-primary">complet</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4 font-bold text-foreground">Fonctionnalité</th>
                <th className="text-center p-4 font-bold text-muted-foreground">Gratuit</th>
                <th className="text-center p-4 font-bold text-sky-500">Starter</th>
                <th className="text-center p-4 font-bold text-primary">Ambassadeur</th>
                <th className="text-center p-4 font-bold text-amber-500">Légende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compare.map((row) => (
                <tr key={row.label}>
                  <td className="p-4 font-semibold text-foreground">{row.label}</td>
                  <td className="p-4 text-center text-muted-foreground">{row.free}</td>
                  <td className="p-4 text-center font-semibold text-foreground">{row.starter}</td>
                  <td className="p-4 text-center font-bold text-primary">{row.ambassadeur}</td>
                  <td className="p-4 text-center font-bold text-amber-500">{row.legende}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-6 text-foreground">
          Questions <span className="text-primary">fréquentes</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-bold text-base text-foreground">{f.q}</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
