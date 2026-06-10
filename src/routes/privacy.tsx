import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — VinaSound" },
      { name: "description", content: "Comment VinaSound collecte, utilise et protège tes données personnelles." },
      { property: "og:title", content: "Politique de confidentialité — VinaSound" },
      { property: "og:description", content: "Notre engagement sur la protection de tes données." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Légal</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
          Politique de <span className="text-primary">confidentialité</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-12">Dernière mise à jour : 29 mai 2026</p>

        <article className="space-y-8 text-muted-foreground leading-relaxed">
          <Section title="1. Données collectées">
            Nous collectons : nom, email, mot de passe (chiffré), photo de profil, contenus que tu publies, statistiques d'écoute, informations de paiement (traitées par CinetPay, nous ne stockons jamais ton numéro de carte).
          </Section>

          <Section title="2. Pourquoi nous collectons ces données">
            Pour faire fonctionner ton compte, te recommander de la musique, te verser tes revenus d'artiste, lutter contre la fraude et améliorer le service.
          </Section>

          <Section title="3. Partage des données">
            Nous ne vendons jamais tes données. Nous les partageons uniquement avec nos prestataires techniques (hébergement, paiement, email) liés par des accords stricts de confidentialité.
          </Section>

          <Section title="4. Cookies">
            VinaSound utilise des cookies pour maintenir ta session, mémoriser tes préférences et mesurer l'audience. Tu peux les désactiver depuis ton navigateur.
          </Section>

          <Section title="5. Sécurité">
            Tes données sont stockées sur des serveurs sécurisés, chiffrées en transit (HTTPS) et au repos. Les mots de passe sont hachés.
          </Section>

          <Section title="6. Tes droits">
            Tu peux à tout moment consulter, modifier, exporter ou supprimer tes données depuis tes paramètres, ou en écrivant à <a className="text-primary hover:underline" href="mailto:privacy@vinasound.app">privacy@vinasound.app</a>.
          </Section>

          <Section title="7. Conservation">
            Tes données sont conservées tant que ton compte est actif. À la suppression, elles sont effacées sous 30 jours, sauf obligations légales (factures, droits voisins).
          </Section>

          <Section title="8. Mineurs">
            VinaSound est destinée aux personnes de 13 ans et plus. Les moins de 18 ans doivent avoir l'accord d'un parent pour les fonctions de monétisation.
          </Section>

          <Section title="9. Modifications">
            En cas de changement important, nous t'en informerons par email et sur la plateforme.
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-extrabold text-foreground mb-2">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
