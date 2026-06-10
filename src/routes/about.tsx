import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Music2, Users, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "À propos — VinaSound" },
      { name: "description", content: "VinaSound, la plateforme musicale des Voix du Togo. Notre mission : mettre en lumière les talents de Mango et de tout le pays." },
      { property: "og:title", content: "À propos — VinaSound" },
      { property: "og:description", content: "Découvre l'équipe et la mission derrière VinaSound, la plateforme musicale qui porte haut les couleurs de Mango et du Togo." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">À propos</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-6">
          Les <span className="text-primary">Voix du Togo</span>, amplifiées.
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-12 max-w-2xl">
          VinaSound est la plateforme musicale dédiée aux artistes du Togo. De <strong className="text-foreground">Mango</strong> à Lomé, en passant par Kara, Sokodé et Atakpamé, nous mettons en lumière les talents qui font vibrer le 228. Notre cœur bat d'abord pour Mango.
        </p>

        <div className="grid sm:grid-cols-2 gap-5 mb-16">
          <Card icon={Music2} title="Notre mission" text="Donner aux artistes togolais les outils pour publier, monétiser et faire grandir leur audience — sans intermédiaire." />
          <Card icon={Users} title="Notre communauté" text="Une scène vivante : artistes, fans, DJs, labels et journalistes réunis autour d'une même passion." />
          <Card icon={Heart} title="Nos valeurs" text="Transparence sur les revenus, respect des droits d'auteur, soutien réel aux créateurs locaux." />
          <Card icon={Sparkles} title="Notre ambition" text="Faire rayonner les sons du Togo bien au-delà des frontières — Afrobeat, Rap 228, Coupé Décalé et tradition." />
        </div>

        <section className="glass rounded-2xl p-8">
          <h2 className="font-display text-2xl font-extrabold mb-3">L'équipe</h2>
          <p className="text-muted-foreground leading-relaxed">
            VinaSound est portée par une petite équipe passionnée de musique et de tech, avec des racines profondes à <strong className="text-foreground">Mango</strong> et des connexions dans tout le Togo. Nous travaillons main dans la main avec les artistes pour construire la plateforme qu'ils méritent.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ icon: Icon, title, text }: { icon: typeof Music2; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-4">
        <Icon className="w-5 h-5" />
      </span>
      <h3 className="font-display text-lg font-extrabold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
