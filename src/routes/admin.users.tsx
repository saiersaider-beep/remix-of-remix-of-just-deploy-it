import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";
import { avatarOrDefault } from "@/lib/default-avatar";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

function UsersPage() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter((u) =>
      [u.display_name, u.first_name, u.last_name, u.id]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t)),
    );
  }, [data, q]);

  return (
    <>
      <AdminPageHeader
        title="Utilisateurs"
        description={`${data?.length ?? 0} comptes au total.`}
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
        <DataTable<Profile>
          keyOf={(r) => r.id}
          empty="Aucun utilisateur."
          columns={[
            {
              key: "user",
              label: "Utilisateur",
              render: (r) => (
                <div className="flex items-center gap-3">
                  <img
                    src={avatarOrDefault(r.avatar_url, r.id)}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-foreground">
                      {r.display_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Sans nom"}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.id.slice(0, 8)}…</div>
                  </div>
                </div>
              ),
            },
            {
              key: "joined",
              label: "Inscrit le",
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
          ]}
          rows={rows}
        />
      )}
    </>
  );
}