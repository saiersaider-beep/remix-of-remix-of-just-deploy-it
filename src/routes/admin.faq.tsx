import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HelpCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/faq")({
  component: FaqAdmin,
});

type Item = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
};

function FaqAdmin() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Item>>>({});
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newCat, setNewCat] = useState("general");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-faq"],
    queryFn: async () => {
      const { data, error } = await db
        .from("faq_items")
        .select("id, category, question, answer, sort_order, is_published")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!newQ.trim() || !newA.trim()) throw new Error("Question et réponse requises");
      const { error } = await db.from("faq_items").insert({
        category: newCat.trim() || "general",
        question: newQ.trim(),
        answer: newA.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("FAQ ajoutée");
      setNewQ("");
      setNewA("");
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (id: string) => {
      const d = drafts[id];
      if (!d) return;
      const { error } = await db
        .from("faq_items")
        .update({
          ...(d.category !== undefined ? { category: d.category } : {}),
          ...(d.question !== undefined ? { question: d.question } : {}),
          ...(d.answer !== undefined ? { answer: d.answer } : {}),
          ...(d.sort_order !== undefined ? { sort_order: d.sort_order } : {}),
          ...(d.is_published !== undefined ? { is_published: d.is_published } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      toast.success("Mis à jour");
      setDrafts((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("faq_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = items.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return (
    <>
      <AdminPageHeader
        title="FAQ"
        description={`${items.length} question(s). Organisées par catégorie.`}
      />

      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <h3 className="font-display font-bold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle question
        </h3>
        <div className="grid sm:grid-cols-[140px_1fr] gap-3">
          <input
            placeholder="Catégorie"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Question"
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Réponse"
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            rows={3}
            className="sm:col-span-2 bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune FAQ.</p>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-6">
            <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2 text-primary">
              <HelpCircle className="w-4 h-4" /> {cat}
            </h2>
            <ul className="space-y-3">
              {list.map((it) => {
                const d = drafts[it.id] ?? {};
                const m = { ...it, ...d };
                const dirty = Object.keys(d).length > 0;
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border border-border bg-card p-4 space-y-2"
                  >
                    <input
                      value={m.question}
                      onChange={(e) =>
                        setDrafts((s) => ({
                          ...s,
                          [it.id]: { ...s[it.id], question: e.target.value },
                        }))
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-bold"
                    />
                    <textarea
                      value={m.answer}
                      onChange={(e) =>
                        setDrafts((s) => ({
                          ...s,
                          [it.id]: { ...s[it.id], answer: e.target.value },
                        }))
                      }
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <input
                        value={m.category}
                        onChange={(e) =>
                          setDrafts((s) => ({
                            ...s,
                            [it.id]: { ...s[it.id], category: e.target.value },
                          }))
                        }
                        className="bg-background border border-border rounded px-2 py-1 w-32"
                        placeholder="Catégorie"
                      />
                      <label className="flex items-center gap-1.5">
                        Ordre
                        <input
                          type="number"
                          value={m.sort_order}
                          onChange={(e) =>
                            setDrafts((s) => ({
                              ...s,
                              [it.id]: {
                                ...s[it.id],
                                sort_order: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-16 bg-background border border-border rounded px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={m.is_published}
                          onChange={(e) =>
                            setDrafts((s) => ({
                              ...s,
                              [it.id]: {
                                ...s[it.id],
                                is_published: e.target.checked,
                              },
                            }))
                          }
                        />
                        Publiée
                      </label>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (confirm("Supprimer cette question ?"))
                              remove.mutate(it.id);
                          }}
                          className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                        <button
                          onClick={() => save.mutate(it.id)}
                          disabled={!dirty || save.isPending}
                          className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground font-bold px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
                        >
                          <Save className="w-3.5 h-3.5" /> Enregistrer
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </>
  );
}
