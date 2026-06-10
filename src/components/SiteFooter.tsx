import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/db-extras";

type FooterPage = { slug: string; title: string };

export function SiteFooter() {
  const { data: pages = [] } = useQuery({
    queryKey: ["footer-cms-pages"],
    queryFn: async () => {
      const { data, error } = await db
        .from("cms_pages")
        .select("slug, title")
        .eq("published", true)
        .eq("in_footer", true)
        .order("title", { ascending: true })
        .limit(8);
      if (error) return [];
      return (data ?? []) as FooterPage[];
    },
    staleTime: 5 * 60_000,
  });

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/discover" className="hover:text-primary">Explorer</Link>
          <span className="text-border">•</span>
          <Link to="/go-pro" className="hover:text-primary">Passer Pro</Link>
          <span className="text-border">•</span>
          <Link to="/faq" className="hover:text-primary">FAQ</Link>
          <span className="text-border">•</span>
          <Link to="/privacy" className="hover:text-primary">Politique de confidentialité</Link>
          <span className="text-border">•</span>
          <Link to="/terms" className="hover:text-primary">Conditions d'utilisation</Link>
          {pages.map((p) => (
            <span key={p.slug} className="contents">
              <span className="text-border">•</span>
              <Link
                to="/pages/$slug"
                params={{ slug: p.slug }}
                className="hover:text-primary"
              >
                {p.title}
              </Link>
            </span>
          ))}
          <span className="text-border">•</span>
          <Link to="/login" className="hover:text-primary">Connexion</Link>
          <span className="text-border">•</span>
          <Link to="/signup" className="hover:text-primary">S'inscrire</Link>
        </nav>
        <p>© {new Date().getFullYear()} VinaSound</p>
      </div>
    </footer>
  );
}
