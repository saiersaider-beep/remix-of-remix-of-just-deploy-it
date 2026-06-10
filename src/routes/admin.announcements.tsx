import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Plus, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";
import { AdminPageHeader } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/announcements")({
  component: AnnouncementsPage,
});

type Row = {
  id: string;
  title: string;
  body: string | null;
  level: string;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
};

const LEVELS = ["info", "success", "warning", "error", "promo"] as const;

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await db
        .from("announcements")
        .select(
          "id, title, body, level, link_url, link_label, is_active, starts_at, ends_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Titre requis");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("announcements").insert({
        title: title.trim(),
        body: body.trim() || null,
        level,
        link_url: linkUrl.trim() || null,
        link_label: linkLabel.trim() || null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Annonce publiée");
      setOpen(false);
      setTitle("");
      setBody("");
      setLinkUrl("");
      setLinkLabel("");
      setEndsAt("");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; is_active: boolean }) => {
      const { error } = await db
        .from("announcements")
        .update({ is_active: vars.is_active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Annonce supprimée");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });

  const levelColor: Record<string, string> = {
    info: "bg-sky-500/20 text-sky-300",
    success: "bg-emerald-500/20 text-emerald-300",
    warning: "bg-amber-500/20 text-amber-300",
    error: "bg-rose-500/20 text-rose-300",
    promo: "bg-primary/20 text-primary",
  };

  return (
    <>
      <AdminPageHeader
        title="Annonces"
        description={`${data?.length ?? 0} annonce(s).`}
        actions={
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2"
          >
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        }
      />

      {open && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <h3 className="font-display font-bold mb-3 flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Nouvelle annonce
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <textarea
              placeholder="Message (optionnel)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              placeholder="Expire le"
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="URL de lien (optionnel)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Libellé du lien"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2 disabled:opacity-50"
          >
            Publier
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !data?.length ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune annonce.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4 ${
                a.is_active ? "" : "opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 ${
                      levelColor[a.level] ?? levelColor.info
                    }`}
                  >
                    {a.level}
                  </span>
                  <h3 className="font-display font-bold text-base truncate">
                    {a.title}
                  </h3>
                </div>
                {a.body && (
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                )}
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  {a.ends_at
                    ? `Jusqu'au ${new Date(a.ends_at).toLocaleString()}`
                    : "Sans expiration"}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    toggle.mutate({ id: a.id, is_active: !a.is_active })
                  }
                  className={`text-[11px] font-bold rounded px-2 py-1 ${
                    a.is_active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Power className="w-3 h-3 inline mr-1" />
                  {a.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Supprimer cette annonce ?")) remove.mutate(a.id);
                  }}
                  className="text-[11px] font-bold rounded px-2 py-1 bg-muted text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
