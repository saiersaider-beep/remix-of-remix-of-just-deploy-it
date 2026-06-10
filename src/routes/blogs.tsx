import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { gradientFor } from "@/components/PageScaffold";

export const Route = createFileRoute("/blogs")({
  head: () => ({
    meta: [
      { title: "Blog — VinaSound" },
      { name: "description", content: "Interviews, sorties et culture musicale africaine." },
    ],
  }),
  component: BlogsPage,
});

type Article = { slug: string; title: string; excerpt: string; date: string; category: string };

function BlogsPage() {
  const articles: Article[] = [];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Magazine</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-12">
          <span className="text-primary">Le blog</span> VinaSound
        </h1>

        {articles.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-12 text-center">
            <p className="font-bold">Aucun article publié pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">Reviens bientôt — la rédaction prépare les premières interviews.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((a) => (
              <Link key={a.slug} to="/articles/$slug" params={{ slug: a.slug }} className="group block">
                <div className={`aspect-[4/3] rounded-md bg-gradient-to-br ${gradientFor(a.title)} mb-4`} />
                <p className="text-xs uppercase tracking-wider text-primary font-bold">{a.category}</p>
                <h2 className="font-display text-xl font-extrabold mt-1 group-hover:text-primary">{a.title}</h2>
                <p className="text-sm text-muted-foreground mt-2">{a.excerpt}</p>
                <p className="text-xs text-muted-foreground mt-3">{a.date}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
