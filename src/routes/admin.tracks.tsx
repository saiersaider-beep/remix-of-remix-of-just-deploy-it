import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Play, Heart, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/tracks")({
  component: TracksPage,
});

type Track = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  plays: number;
  likes: number;
  is_published: boolean;
  pricing_model: string;
  price_amount: number;
  price_currency: string;
  created_at: string;
  artists: { name: string; slug: string } | null;
};

function TracksPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, slug, cover_url, plays, likes, is_published, pricing_model, price_amount, price_currency, created_at, artists(name, slug)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Track[];
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter(
      (r) => r.title.toLowerCase().includes(t) || r.artists?.name.toLowerCase().includes(t),
    );
  }, [data, q]);

  return (
    <>
      <AdminPageHeader
        title="Pistes"
        description={`${data?.length ?? 0} morceaux publiés sur la plateforme.`}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Titre ou artiste…"
              className="bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary w-64"
            />
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Track>
          keyOf={(r) => r.id}
          empty="Aucune piste."
          columns={[
            {
              key: "track",
              label: "Piste",
              render: (r) => (
                <div className="flex items-center gap-3">
                  {r.cover_url ? (
                    <img src={r.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/20" />
                  )}
                  <div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.artists?.name ?? "—"}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "plays",
              label: "Écoutes",
              render: (r) => (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Play className="w-3 h-3" /> {r.plays.toLocaleString()}
                </span>
              ),
            },
            {
              key: "likes",
              label: "Likes",
              render: (r) => (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Heart className="w-3 h-3" /> {r.likes.toLocaleString()}
                </span>
              ),
            },
            {
              key: "price",
              label: "Prix",
              render: (r) =>
                r.pricing_model === "free" ? (
                  <span className="text-xs text-emerald-400 font-bold">Gratuit</span>
                ) : (
                  <span className="text-xs">
                    {r.price_amount.toLocaleString()} {r.price_currency}
                  </span>
                ),
            },
            {
              key: "status",
              label: "Statut",
              render: (r) =>
                r.is_published ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 rounded px-2 py-0.5">
                    Publié
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground rounded px-2 py-0.5">
                    Brouillon
                  </span>
                ),
            },
            {
              key: "actions",
              label: "",
              render: (r) =>
                r.artists ? (
                  <Link
                    to="/tracks/$slug"
                    params={{ slug: r.slug }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Voir <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : null,
              className: "text-right",
            },
          ]}
          rows={rows}
        />
      )}
    </>
  );
}