import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { gradientFor } from "@/components/PageScaffold";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/articles/$slug")({
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const title = slug.replace(/-/g, " ");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/blogs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="w-4 h-4" /> Retour au blog
        </Link>
        <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Article</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-6 capitalize">{title}</h1>
        <div className={`aspect-[16/9] rounded-md bg-gradient-to-br ${gradientFor(slug)} mb-8`} />
        <article className="prose prose-neutral max-w-none">
          <p className="text-muted-foreground">
            Cet article n'est pas encore publié. Reviens bientôt pour lire l'analyse complète.
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
