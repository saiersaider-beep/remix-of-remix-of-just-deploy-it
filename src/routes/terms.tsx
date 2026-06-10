import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — VinaSound" },
      { name: "description", content: "Conditions générales d'utilisation de la plateforme VinaSound." },
      { property: "og:title", content: "Conditions d'utilisation — VinaSound" },
      { property: "og:description", content: "Les règles qui encadrent l'usage de VinaSound." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Légal</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">
          Conditions <span className="text-primary">d'utilisation</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-12">Dernière mise à jour : 29 mai 2026</p>

        <article className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">
          <Section title="1. Acceptation des conditions">
            En accédant à VinaSound, tu acceptes les présentes conditions. Si tu n'es pas d'accord avec un point, merci de ne pas utiliser la plateforme.
          </Section>

          <Section title="2. Compte utilisateur">
            Tu es responsable de la confidentialité de tes identifiants et de toutes les activités effectuées depuis ton compte. Un compte par personne — pas de partage commercial sans autorisation écrite.
          </Section>

          <Section title="3. Contenus publiés">
            Tu conserves la propriété des œuvres que tu publies. Tu garantis détenir tous les droits nécessaires (auteur, compositeur, interprète, label). Tout contenu enfreignant les droits d'autrui sera retiré sans préavis.
          </Section>

          <Section title="4. Monétisation & paiements">
            Les revenus issus des écoutes, dons et achats sont versés selon les modalités décrites dans l'espace artiste. Les paiements sont traités via CinetPay. VinaSound prélève une commission de service annoncée publiquement.
          </Section>

          <Section title="5. Comportements interdits">
            Spam, fraude aux écoutes, usurpation d'identité, contenus haineux ou illégaux entraînent la suspension immédiate du compte et le gel des revenus.
          </Section>

          <Section title="6. Suspension & résiliation">
            VinaSound peut suspendre ou supprimer un compte qui enfreint ces conditions. Tu peux fermer ton compte à tout moment depuis tes paramètres.
          </Section>

          <Section title="7. Limitation de responsabilité">
            VinaSound est fournie « telle quelle ». Nous faisons de notre mieux pour assurer la disponibilité du service mais ne garantissons pas l'absence d'interruption ou d'erreur.
          </Section>

          <Section title="8. Droit applicable">
            Les présentes conditions sont régies par le droit togolais. Tout litige relèvera des tribunaux compétents de Lomé.
          </Section>

          <Section title="9. Contact">
            Pour toute question : <a className="text-primary hover:underline" href="mailto:legal@vinasound.app">legal@vinasound.app</a>.
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
