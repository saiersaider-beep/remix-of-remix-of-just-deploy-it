import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Eye, GripVertical, Loader2, Lock, Music2, Pause, Pencil, Play, Plus, Search, Share2, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate, EmptyState, gradientFor } from "@/components/PageScaffold";
import { unslug } from "@/components/DetailView";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, currentTrack as currentTrackSelector } from "@/stores/player";
import {
  getPlaylistBySlug,
  getPlaylistCollaborators,
  getPlaylistTracks,
  inviteCollaborator,
  removeCollaborator,
  removePlaylistTrack,
  searchUsersByName,
  updateCollaboratorRole,
  type PlaylistRole,
} from "@/lib/playlist-collab";

export const Route = createFileRoute("/playlists/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${unslug(params.slug)} — Playlist — VinaSound` },
      { name: "description", content: `Listen to the playlist ${unslug(params.slug)} on VinaSound.` },
    ],
  }),
  component: PlaylistDetail,
});

function formatDuration(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function PlaylistDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.toggle);
  const playerCurrent = usePlayerStore(currentTrackSelector);
  const playerIsPlaying = usePlayerStore((s) => s.isPlaying);

  const { data: playlist, isLoading } = useQuery({
    queryKey: ["playlist", slug, user?.id],
    queryFn: () => getPlaylistBySlug(slug),
  });

  const { data: tracks = [] } = useQuery({
    queryKey: ["playlist-tracks", playlist?.id],
    enabled: !!playlist?.id,
    queryFn: () => getPlaylistTracks(playlist!.id),
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ["playlist-collaborators", playlist?.id],
    enabled: !!playlist?.id,
    queryFn: () => getPlaylistCollaborators(playlist!.id),
  });

  // Realtime: refresh on any related change
  useEffect(() => {
    if (!playlist?.id) return;
    const channel = supabase
      .channel(`playlist:${playlist.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_tracks", filter: `playlist_id=eq.${playlist.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["playlist-tracks", playlist.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_collaborators", filter: `playlist_id=eq.${playlist.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["playlist-collaborators", playlist.id] });
        qc.invalidateQueries({ queryKey: ["playlist", slug, user?.id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "playlists", filter: `id=eq.${playlist.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["playlist", slug, user?.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playlist?.id, qc, slug, user?.id]);

  const canEdit = playlist?.my_role === "owner" || playlist?.my_role === "editor";
  const canManage = playlist?.my_role === "owner";

  const removeTrackMutation = useMutation({
    mutationFn: removePlaylistTrack,
    onSuccess: () => {
      toast.success("Piste retirée");
      qc.invalidateQueries({ queryKey: ["playlist-tracks", playlist?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.track.duration_seconds || 0), 0),
    [tracks],
  );

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const queue = tracks.map((t) => ({
      id: t.track.id,
      artist_id: t.track.artist_id,
      title: t.track.title,
      slug: t.track.slug,
      audio_url: t.track.audio_url,
      cover_url: t.track.cover_url,
      artist_name: t.track.artist_name,
      artist_slug: t.track.artist_slug,
      duration_seconds: t.track.duration_seconds,
      genre: t.track.genre,
      pricing_model: t.track.pricing_model,
      price_amount: t.track.price_amount,
      price_currency: t.track.price_currency,
      preview_seconds: t.track.preview_seconds,
    }));
    const isCurrentInQueue = playerCurrent && queue.some((q) => q.id === playerCurrent.id);
    if (isCurrentInQueue) {
      togglePlay();
      return;
    }
    playQueue(queue, 0);
  };

  const sharePlaylist = async () => {
    const url = `${window.location.origin}/playlists/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  if (isLoading) {
    return (
      <AuthGate>
        <div className="space-y-6 animate-pulse">
          <div className="h-48 rounded-xl bg-surface/40 border border-border" />
          <div className="h-64 rounded-xl bg-surface/40 border border-border" />
        </div>
      </AuthGate>
    );
  }

  if (!playlist) {
    return (
      <AuthGate>
        <EmptyState title="Playlist introuvable" hint="Le lien est invalide ou tu n'as pas accès à cette playlist." />
      </AuthGate>
    );
  }

  if (!playlist.my_role) {
    return (
      <AuthGate>
        <EmptyState title="Accès privé" hint="Cette playlist est privée. Demande à son propriétaire de t'inviter." />
      </AuthGate>
    );
  }

  const grad = gradientFor(playlist.title);
  const isPlayingThis = playerIsPlaying && tracks.some((t) => t.track.id === playerCurrent?.id);

  return (
    <AuthGate>
      <div className="space-y-6">
        {/* Hero */}
        <section className={`relative rounded-xl overflow-hidden border border-border bg-gradient-to-br ${grad}`}>
          <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
          <div className="relative p-6 md:p-8 grid gap-6 md:grid-cols-[200px_1fr] items-end">
            <div className={`aspect-square rounded-xl bg-gradient-to-br ${grad} grid place-items-center shadow-xl`}>
              <Music2 className="w-20 h-20 text-primary-foreground/80" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                {playlist.is_owner ? (
                  <span className="inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-primary" /> Ta playlist</span>
                ) : playlist.my_role === "editor" ? (
                  <span className="inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5 text-primary" /> Co-éditeur</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Lecteur</span>
                )}
                <span>·</span>
                <span>par {playlist.owner_name}</span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-[1.1] tracking-tight">{playlist.title}</h1>
              {playlist.description && <p className="text-sm text-muted-foreground max-w-2xl">{playlist.description}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>{tracks.length} morceau{tracks.length > 1 ? "x" : ""}</span>
                <span>{formatDuration(totalDuration)}</span>
                <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {collaborators.length + 1} membre{collaborators.length ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handlePlayAll}
                  disabled={tracks.length === 0}
                  className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-primary text-primary-foreground px-5 text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {isPlayingThis ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  {isPlayingThis ? "Pause" : "Lire tout"}
                </button>
                <button onClick={sharePlaylist} className="inline-flex items-center gap-2 h-11 rounded-full border border-border bg-background/60 px-4 text-sm font-semibold hover:bg-surface transition-colors">
                  <Share2 className="w-4 h-4" /> Partager
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {/* Tracks */}
          <div className="border border-border rounded-xl bg-surface/40 overflow-hidden">
            <header className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold tracking-tight">Morceaux</h2>
              {!canEdit && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Lecture seule</span>}
            </header>
            {tracks.length === 0 ? (
              <div className="p-8 text-sm text-muted-foreground">
                {canEdit
                  ? "Aucun morceau pour le moment. Ouvre la page d'un morceau et ajoute-le ici via le bouton « Ajouter à une playlist »."
                  : "L'auteur n'a pas encore ajouté de morceaux."}
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {tracks.map((row, idx) => (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-background/40 transition-colors">
                    <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                      {row.track.cover_url ? (
                        <img src={row.track.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center"><Music2 className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to="/tracks/$slug" params={{ slug: row.track.slug }} className="font-semibold text-sm truncate hover:underline block">
                        {row.track.title}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        <Link to="/artists/$slug" params={{ slug: row.track.artist_slug }} className="hover:underline">{row.track.artist_name}</Link>
                        <span className="mx-1.5">·</span>
                        ajouté par {row.added_by_name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDuration(row.track.duration_seconds)}</span>
                    {canEdit && (
                      <button
                        onClick={() => removeTrackMutation.mutate(row.id)}
                        disabled={removeTrackMutation.isPending}
                        className="grid place-items-center w-8 h-8 rounded text-muted-foreground hover:text-destructive hover:bg-background/60 transition-colors"
                        aria-label="Retirer de la playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Collaborators */}
          <CollaboratorsPanel
            playlistId={playlist.id}
            ownerId={playlist.user_id}
            ownerName={playlist.owner_name}
            collaborators={collaborators}
            canManage={canManage}
            currentUserId={user?.id ?? null}
          />
        </section>
      </div>
    </AuthGate>
  );
}

function CollaboratorsPanel({
  playlistId, ownerId, ownerName, collaborators, canManage, currentUserId,
}: {
  playlistId: string;
  ownerId: string;
  ownerName: string;
  collaborators: Awaited<ReturnType<typeof getPlaylistCollaborators>>;
  canManage: boolean;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<PlaylistRole>("editor");

  const excludeIds = useMemo(
    () => [ownerId, ...collaborators.map((c) => c.user_id)],
    [ownerId, collaborators],
  );

  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["user-search", search, excludeIds],
    enabled: canManage && search.trim().length >= 2,
    queryFn: () => searchUsersByName(search, excludeIds),
  });

  const inviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentUserId) throw new Error("Connecte-toi pour inviter.");
      await inviteCollaborator(playlistId, userId, role, currentUserId);
    },
    onSuccess: () => {
      toast.success("Invitation envoyée");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["playlist-collaborators", playlistId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlaylistRole }) => updateCollaboratorRole(id, role),
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["playlist-collaborators", playlistId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeCollaborator,
    onSuccess: () => {
      toast.success("Collaborateur retiré");
      qc.invalidateQueries({ queryKey: ["playlist-collaborators", playlistId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-xl bg-surface/40 p-6 space-y-5 h-fit">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-extrabold tracking-tight">Collaborateurs</h2>
      </div>

      {canManage && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur par nom…"
              className="w-full pl-9 pr-3 h-10 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("editor")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-semibold border transition-colors ${
                role === "editor" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-background/60"
              }`}
            >
              <Pencil className="w-3.5 h-3.5" /> Éditeur
            </button>
            <button
              type="button"
              onClick={() => setRole("viewer")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-semibold border transition-colors ${
                role === "viewer" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-background/60"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Lecteur
            </button>
          </div>
          {search.trim().length >= 2 && (
            <div className="rounded-lg border border-border bg-background/70 max-h-60 overflow-auto divide-y divide-border">
              {searching && <p className="p-3 text-xs text-muted-foreground">Recherche…</p>}
              {!searching && results.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Aucun utilisateur trouvé.</p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => inviteMutation.mutate(r.id)}
                  disabled={inviteMutation.isPending}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface/50 transition-colors disabled:opacity-60"
                >
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden grid place-items-center text-xs">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.display_name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-semibold truncate">{r.display_name || "Utilisateur"}</span>
                  <UserPlus className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2">
        <li className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 grid place-items-center"><Crown className="w-4 h-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{ownerName}</p>
            <p className="text-[11px] text-muted-foreground">Propriétaire</p>
          </div>
        </li>
        {collaborators.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-muted overflow-hidden grid place-items-center text-xs shrink-0">
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : (c.display_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{c.display_name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{c.role === "editor" ? "Éditeur" : "Lecteur"}</p>
            </div>
            {canManage && (
              <>
                <select
                  value={c.role}
                  onChange={(e) => roleMutation.mutate({ id: c.id, role: e.target.value as PlaylistRole })}
                  className="h-8 rounded-md border border-border bg-background text-xs px-2 outline-none focus:border-primary"
                >
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecteur</option>
                </select>
                <button
                  onClick={() => removeMutation.mutate(c.id)}
                  className="grid place-items-center w-8 h-8 rounded text-muted-foreground hover:text-destructive hover:bg-background/60"
                  aria-label="Retirer"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {collaborators.length === 0 && !canManage && (
          <li className="text-xs text-muted-foreground px-1">Aucun collaborateur invité.</li>
        )}
      </ul>
    </div>
  );
}

// silence unused import warning for icons reserved for future drag-handle UX
void GripVertical; void Plus;
