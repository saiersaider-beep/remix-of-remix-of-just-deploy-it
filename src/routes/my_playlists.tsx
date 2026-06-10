import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { Plus, Loader2, Crown, Users, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { createPlaylist } from "@/lib/track-social";
import { getPlaylistsForUser } from "@/lib/playlist-collab";

export const Route = createFileRoute("/my_playlists")({
  head: () => ({
    meta: [
      { title: "My Playlists — VinaSound" },
      { name: "description", content: "Playlists you've created or collaborate on." },
    ],
  }),
  component: MyPlaylistsPage,
});

function MyPlaylistsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"all" | "owned" | "shared">("all");

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists-for-user", user?.id],
    enabled: !!user?.id,
    queryFn: () => getPlaylistsForUser(user!.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Connecte-toi pour créer une playlist.");
      const value = title.trim();
      if (!value) throw new Error("Donne un nom à la playlist.");
      return createPlaylist(user.id, value);
    },
    onSuccess: () => {
      setTitle("");
      toast.success("Playlist créée");
      qc.invalidateQueries({ queryKey: ["playlists-for-user", user?.id] });
    },
    onError: (error: any) => {
      console.error("[createPlaylist] failed:", error);
      const msg = error?.message || error?.error_description || "Impossible de créer la playlist.";
      toast.error(msg);
    },
  });

  const submitCreate = () => {
    if (createMutation.isPending || !title.trim()) return;
    createMutation.mutate();
  };

  const filtered = playlists.filter((p) => tab === "all" || (tab === "owned" ? p.is_owner : !p.is_owner));

  return (
    <AuthGate>
      <PageHeader
        eyebrow="Your Music"
        accent="My"
        title="Playlists"
        actions={
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }}
              placeholder="Nouvelle playlist"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button onClick={submitCreate} disabled={createMutation.isPending || !title.trim()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nouvelle playlist
            </button>
          </div>
        }
      />


      <div className="flex items-center gap-2 mb-6">
        {([
          { key: "all", label: "Toutes" },
          { key: "owned", label: "Mes playlists" },
          { key: "shared", label: "Partagées avec moi" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 h-9 rounded-full text-sm font-semibold border transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des playlists…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "shared" ? "Aucune playlist partagée" : "No playlists yet"}
          hint={tab === "shared" ? "Quand un ami t'invitera comme collaborateur, sa playlist apparaîtra ici." : "Create your first playlist to start organising your music."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((playlist) => (
            <Link key={playlist.id} to="/playlists/$slug" params={{ slug: playlist.slug }} className="border border-border rounded-md bg-surface/40 p-5 hover:bg-surface transition flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-xl font-extrabold truncate flex-1">{playlist.title}</p>
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold rounded-full px-2 py-1 ${
                  playlist.is_owner ? "bg-primary/15 text-primary" : playlist.my_role === "editor" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                }`}>
                  {playlist.is_owner ? <><Crown className="w-3 h-3" /> Owner</> : playlist.my_role === "editor" ? <><Pencil className="w-3 h-3" /> Editor</> : <><Eye className="w-3 h-3" /> Viewer</>}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2 flex-1">{playlist.description || "Playlist personnelle"}</p>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{playlist.track_count} morceau{playlist.track_count > 1 ? "x" : ""}</span>
                {playlist.collaborator_count > 0 && (
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {playlist.collaborator_count + 1}</span>
                )}
                <span className="ml-auto">{new Date(playlist.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AuthGate>
  );
}
