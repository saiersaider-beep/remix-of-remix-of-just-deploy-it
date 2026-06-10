import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Eye, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/artist-verification")({
  head: () => ({ meta: [{ title: "Admin — Artist verification" }] }),
  component: () => (
    <AuthGate>
      <AdminPage />
    </AuthGate>
  ),
});

type Status = "pending" | "approved" | "rejected";

function AdminPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      // Stay on page but show forbidden — don't redirect silently
    }
  }, [loading, isAdmin, navigate]);

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!isAdmin) {
    return (
      <>
        <PageHeader eyebrow="Admin" accent="Forbidden" title="" />
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-6 max-w-xl">
          <div className="flex items-center gap-2 text-destructive font-bold mb-2"><ShieldAlert className="w-5 h-5" /> Admin access required</div>
          <p className="text-sm text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </>
    );
  }
  return <RequestsTable />;
}

function RequestsTable() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status>("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-verif-requests", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_verification_requests")
        .select("*, artists(slug, name, avatar_url)")
        .eq("status", filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function approve(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("approve_artist_verification", { _request_id: id });
    setBusy(null);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-verif-requests"] });
  }

  async function reject(id: string) {
    const reason = prompt("Reason for rejection?") || "";
    setBusy(id);
    const { error } = await supabase.rpc("reject_artist_verification", { _request_id: id, _reason: reason });
    setBusy(null);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-verif-requests"] });
  }

  return (
    <>
      <PageHeader eyebrow="Admin" accent="Artiste" title="Verification" description="Review PRO upgrade applications." />
      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !requests?.length ? (
        <p className="text-sm text-muted-foreground">No {filter} requests.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Artiste</th>
                <th className="text-left p-3">Display name</th>
                <th className="text-left p-3">Genre / Country</th>
                <th className="text-left p-3">Links</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r: any) => {
                const links = (r.social_links ?? {}) as Record<string, string | null>;
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {r.artists?.avatar_url ? (
                          <img src={r.artists.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/10" />
                        )}
                        <span className="font-bold">{r.artists?.name}</span>
                      </div>
                    </td>
                    <td className="p-3">{r.display_name}</td>
                    <td className="p-3 text-muted-foreground">
                      {r.genre || "—"}<br />{r.country || "—"}
                    </td>
                    <td className="p-3 text-xs space-y-1">
                      {(["instagram", "tiktok", "youtube"] as const).map((k) =>
                        links[k] ? (
                          <a key={k} href={links[k]!} target="_blank" rel="noreferrer" className="block text-primary hover:underline truncate max-w-[200px]">
                            {k}
                          </a>
                        ) : null
                      )}
                    </td>
                    <td className="p-3 max-w-xs text-xs text-muted-foreground line-clamp-4">{r.reason}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        {r.artists?.slug && (
                          <Link to="/artists/$slug" params={{ slug: r.artists.slug }} className="grid place-items-center w-8 h-8 rounded-full hover:bg-surface" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                        {filter === "pending" && (
                          <>
                            <button onClick={() => approve(r.id)} disabled={busy === r.id} className="grid place-items-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50" title="Approuver">
                              {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => reject(r.id)} disabled={busy === r.id} className="grid place-items-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50" title="Rejeter">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
