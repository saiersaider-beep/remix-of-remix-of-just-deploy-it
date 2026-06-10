import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/pages")({
  component: PagesAdmin,
});

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  meta_description: string | null;
  is_published: boolean;
  show_in_footer: boolean;
  sort_order: number;
  updated_at: string;
};

function PagesAdmin() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Page>>({});

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-cms-pages"],
    queryFn: async () => {
      const { data, error } = await db
        .from("cms_pages")
        .select("id, slug, title, body, meta_description, is_published, show_in_footer, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });

  const current = pages.find((p) => p.id === selected) ?? null;
  const editing = current ? { ...current, ...draft } : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Aucune page sélectionnée");
      if (!editing.slug?.trim() || !editing.title?.trim()) {
        throw new Error("Slug et titre requis");
      }
      const { error } = await db
        .from("cms_pages")
        .update({
          slug: editing.slug.trim(),
          title: editing.title.trim(),
          body: editing.body ?? "",
          meta_description: editing.meta_description?.trim() || null,
          is_published: editing.is_published,
          show_in_footer: editing.show_in_footer,
          sort_order: editing.sort_order ?? 0,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page enregistrée");
      setDraft({});
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const slug = prompt("Slug de la nouvelle page (ex: about, terms) :");
      if (!slug?.trim()) throw new Error("Slug requis");
      const { data, error } = await db
        .from("cms_pages")
        .insert({
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          title: slug.trim(),
          body: "",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Page créée");
      setSelected(id);
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("cms_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page supprimée");
      setSelected(null);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader
        title="Pages CMS"
        description={`${pages.length} page(s). Édite les pages statiques (À propos, CGU, Politique de confidentialité…).`}
        actions={
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Nouvelle page
          </button>
        }
      />

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : pages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune page.</p>
          ) : (
            <ul>
              {pages.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setSelected(p.id);
                      setDraft({});
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-border text-sm flex items-center gap-2 hover:bg-muted/30 ${
                      selected === p.id ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">
                      <span className="font-bold">{p.title}</span>
                      <span className="block text-[11px] opacity-60">/{p.slug}</span>
                    </span>
                    {p.is_published ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rounded-xl border border-border bg-card p-5">
          {!editing ? (
            <p className="text-sm text-muted-foreground">
              Sélectionne une page à gauche ou crée-en une nouvelle.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Titre">
                  <input
                    value={editing.title ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Slug (URL)">
                  <input
                    value={editing.slug ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </Field>
              </div>
              <Field label="Meta description (SEO, ≤160 car.)">
                <input
                  value={editing.meta_description ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, meta_description: e.target.value }))
                  }
                  maxLength={160}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Contenu (Markdown supporté)">
                <textarea
                  value={editing.body ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={18}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editing.is_published}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, is_published: e.target.checked }))
                    }
                  />
                  Publiée
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editing.show_in_footer}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, show_in_footer: e.target.checked }))
                    }
                  />
                  Afficher dans le footer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Ordre
                  <input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))
                    }
                    className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  onClick={() => {
                    if (current && confirm(`Supprimer "${current.title}" ?`))
                      remove.mutate(current.id);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-5 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Enregistrer
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
