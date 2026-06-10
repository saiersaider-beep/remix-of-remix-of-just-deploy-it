import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  meta_description: string | null;
  updated_at: string;
};

async function fetchPage(slug: string): Promise<Page | null> {
  const { data, error } = await db
    .from("cms_pages")
    .select("id, slug, title, body, meta_description, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Page | null) ?? null;
}

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {
    const page = await fetchPage(params.slug);
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.page;
    if (!p) return { meta: [{ title: "Page — VinaSound" }] };
    return {
      meta: [
        { title: `${p.title} — VinaSound` },
        ...(p.meta_description
          ? [{ name: "description", content: p.meta_description }]
          : []),
        { property: "og:title", content: `${p.title} — VinaSound` },
        ...(p.meta_description
          ? [{ property: "og:description", content: p.meta_description }]
          : []),
      ],
    };
  },
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">{error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-bold"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold mb-2">404</h1>
        <p className="text-sm text-muted-foreground mb-4">Cette page n'existe pas.</p>
        <Link
          to="/"
          className="inline-flex rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-bold"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  ),
  component: PageView,
});

function renderMarkdown(src: string): string {
  // tiny safe-ish markdown → html for headings, bold, italics, links, lists, paragraphs
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = escape(src).split(/\r?\n/);
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      const lvl = h[1].length;
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

function PageView() {
  const { page } = Route.useLoaderData();
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold mb-2">
          {page.title}
        </h1>
        <p className="text-xs text-muted-foreground mb-8">
          Mis à jour le {new Date(page.updated_at).toLocaleDateString()}
        </p>
        <article
          className="max-w-none text-foreground [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:text-xl [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-bold [&_h3]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_li]:mb-1 [&_li]:text-foreground [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body || "") }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
