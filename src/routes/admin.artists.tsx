import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, BadgeCheck, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";
import { avatarOrDefault } from "@/lib/default-avatar";

export const Route = createFileRoute("/admin/artists")({
  component: ArtistsPage,
});

type Artist = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  verified: boolean | null;
  pro_badge: string | null;
  monthly_listeners: number | null;
  created_at: string;
};

function ArtistsPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artists")
        .select("id, name, slug, avatar_url, verified, pro_badge, monthly_listeners, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Artist[];
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(t) || a.slug.includes(t));
  }, [data, q]);

  return (
    <>
      <AdminPageHeader
        title="Artistes"
        description={`${data?.length ?? 0} artistes enregistrés.`}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary w-64"
            />
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Artist>
          keyOf={(r) => r.id}
          empty="Aucun artiste."
          columns={[
            {
              key: "artist",
              label: "Artiste",
              render: (r) => (
                <div className="flex items-center gap-3">
                  <img
                    src={avatarOrDefault(r.avatar_url, r.id)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {r.name}
                      {r.verified && <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-500/30" />}
                      {r.pro_badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-600 text-white rounded px-1.5 py-0.5">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">@{r.slug}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "listeners",
              label: "Auditeurs/mois",
              render: (r) => (r.monthly_listeners ?? 0).toLocaleString(),
            },
            {
              key: "joined",
              label: "Créé le",
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
            {
              key: "actions",
              label: "",
              render: (r) => (
                <Link
                  to="/artists/$slug"
                  params={{ slug: r.slug }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir <ExternalLink className="w-3 h-3" />
                </Link>
              ),
              className: "text-right",
            },
          ]}
          rows={rows}
        />
      )}
    </>
  );
}