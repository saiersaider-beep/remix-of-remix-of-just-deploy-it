import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, RefreshCw, Loader2, CheckCircle2, Clock, Ban } from "lucide-react";
import { listAdminUsers, type AdminUserRow } from "@/lib/admin-users.functions";
import { AdminPageHeader } from "@/components/AdminLayout";
import { avatarOrDefault } from "@/lib/default-avatar";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs — Admin VinaSound" },
      {
        name: "description",
        content:
          "Gestion des comptes VinaSound : statut du compte, rôle, date d'inscription et dernière connexion, avec filtres et actualisation.",
      },
      { property: "og:title", content: "Utilisateurs — Admin VinaSound" },
      {
        property: "og:description",
        content: "Statut, rôle et date d'inscription de chaque compte VinaSound.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type RoleFilter = "all" | "admin" | "moderator" | "user";
type StatusFilter = "all" | "active" | "pending" | "banned";

const ROLE_LABELS: Record<RoleFilter, string> = {
  all: "Tous rôles",
  admin: "Admins",
  moderator: "Modérateurs",
  user: "Membres",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tous statuts",
  active: "Actifs",
  pending: "En attente",
  banned: "Bannis",
};

function UsersPage() {
  const listFn = useServerFn(listAdminUsers);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-users", role, status],
    queryFn: () => listFn({ data: { role, status, limit: 500 } }),
  });

  const rows = useMemo(() => {
    const list = data?.users ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      [u.name, u.email, u.id].filter(Boolean).some((v) => v!.toLowerCase().includes(t)),
    );
  }, [data, q]);

  return (
    <>
      <AdminPageHeader
        title="Utilisateurs"
        description={`${data?.total ?? 0} comptes au total — statut, rôle et date d'inscription.`}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, email…"
              className="bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary w-64"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(ROLE_LABELS) as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              role === r
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition ${
              status === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-bold hover:border-primary transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun utilisateur pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left font-bold px-4 py-3">Utilisateur</th>
                <th className="text-left font-bold px-4 py-3">Email</th>
                <th className="text-left font-bold px-4 py-3">Rôle</th>
                <th className="text-left font-bold px-4 py-3">Statut</th>
                <th className="text-left font-bold px-4 py-3">Inscrit le</th>
                <th className="text-left font-bold px-4 py-3">Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarOrDefault(u.avatarUrl, u.id)}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {u.name}
                          {u.isArtist && (
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                              Artiste
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {u.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("fr-FR") : "Jamais"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RoleBadge({ role }: { role: AdminUserRow["role"] }) {
  const labels: Record<AdminUserRow["role"], string> = {
    super_admin: "Super admin",
    admin: "Admin",
    moderator: "Modérateur",
    user: "Membre",
  };
  const isStaff = role === "admin" || role === "super_admin" || role === "moderator";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        isStaff ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
      }`}
    >
      {labels[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: AdminUserRow["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
        <CheckCircle2 className="w-3.5 h-3.5" /> Actif
      </span>
    );
  }
  if (status === "banned") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
        <Ban className="w-3.5 h-3.5" /> Banni
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
      <Clock className="w-3.5 h-3.5" /> En attente
    </span>
  );
}
