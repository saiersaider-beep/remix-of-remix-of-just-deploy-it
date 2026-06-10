import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";

type Item = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — VinaSound" },
      {
        name: "description",
        content:
          "Questions fréquentes sur VinaSound : streaming, abonnement Pro, ventes d'artistes, paiements et plus.",
      },
      { property: "og:title", content: "FAQ — VinaSound" },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-faq"],
    queryFn: async () => {
      const { data, error } = await db
        .from("faq_items")
        .select("id, category, question, answer")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const grouped = items.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  // JSON-LD for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-primary">
            <HelpCircle className="w-4 h-4" /> Aide
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold mt-2">
            Questions fréquentes
          </h1>
          <p className="text-muted-foreground mt-3">
            Tout ce qu'il faut savoir pour profiter à fond de VinaSound.
          </p>
        </header>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune question disponible pour le moment.
          </p>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mb-10">
              <h2 className="font-display text-xl font-bold mb-4 capitalize">{cat}</h2>
              <ul className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
                {list.map((it) => {
                  const isOpen = !!open[it.id];
                  return (
                    <li key={it.id}>
                      <button
                        onClick={() =>
                          setOpen((s) => ({ ...s, [it.id]: !s[it.id] }))
                        }
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition"
                      >
                        <span className="font-bold">{it.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-sm text-muted-foreground whitespace-pre-line">
                          {it.answer}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {items.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
