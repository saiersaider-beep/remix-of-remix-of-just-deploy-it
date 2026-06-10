import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtNumber, getMyArtist, uploadToBucket, removeStorageObjects } from "@/lib/artist-helpers";
import { Dropzone } from "@/components/Dropzone";
import {
  Pencil, Trash2, Eye, EyeOff, Headphones, Plus, Loader2, Check, X, Image as ImageIcon, ExternalLink, Disc3, Music2,
} from "lucide-react";

export const Route = createFileRoute("/my-albums")({
  head: () => ({
    meta: [
      { title: "My Albums — VinaSound" },
      { name: "description", content: "Manage your album releases and drafts." },
    ],
  }),
  component: () => (
    <AuthGate>
      <MyAlbumsPage />
    </AuthGate>
  ),
});

type Album = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  description: string | null;
  plays: number;
  is_published: boolean;
  released_at: string;
};

type Filter = "all" | "published" | "draft";

function MyAlbumsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Album | null>(null);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});

  const { data: artist } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["my-albums", artist?.id],
    enabled: !!artist?.id,
    queryFn: async (): Promise<Album[]> => {
      const { data } = await supabase
        .from("albums")
        .select("id,title,slug,cover_url,description,plays,is_published,released_at")
        .eq("artist_id", artist!.id)
        .order("released_at", { ascending: false });
      return (data ?? []) as Album[];
    },
  });

  // Count tracks per album
  useEffect(() => {
    if (albums.length === 0) return;
    const ids = albums.map((a) => a.id);
    supabase
      .from("album_tracks")
      .select("album_id")
      .in("album_id", ids)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r: any) => {
          counts[r.album_id] = (counts[r.album_id] ?? 0) + 1;
        });
        setTrackCounts(counts);
      });
  }, [albums]);

  async function toggleStatus(a: Album) {
    await supabase.from("albums").update({ is_published: !a.is_published }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["my-albums", artist?.id] });
  }

  async function remove(a: Album) {
    if (!confirm(`Delete album "${a.title}"? Tracks won't be deleted.`)) return;
    await supabase.from("album_tracks").delete().eq("album_id", a.id);
    await supabase.from("albums").delete().eq("id", a.id);
    await removeStorageObjects("covers", [a.cover_url]);
    qc.invalidateQueries({ queryKey: ["my-albums", artist?.id] });
  }

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Studio" accent="My" title="Albums" />
        <EmptyState title="No artist profile yet" hint="Create your artist profile to publish albums." />
        <div className="mt-4">
          <Link to="/profile" className="inline-flex bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold">
            Create profile
          </Link>
        </div>
      </>
    );
  }

  const filtered = albums.filter((a) =>
    filter === "all" ? true : filter === "published" ? a.is_published : !a.is_published,
  );

  const counts = {
    all: albums.length,
    published: albums.filter((a) => a.is_published).length,
    draft: albums.filter((a) => !a.is_published).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        accent="My"
        title="Albums"
        description="Manage your releases. Drafts stay private until you publish."
        actions={
          <Link
            to="/upload-album"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New album
          </Link>
        }
      />

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {(["all", "published", "draft"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-bold capitalize border-b-2 transition ${
              filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f} <span className="text-xs text-muted-foreground">({counts[f]})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading albums…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === "draft" ? "No drafts" : filter === "published" ? "Nothing published yet" : "No albums yet"}
          hint="Bundle tracks together to release your first album."
        />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((a) => (
            <li
              key={a.id}
              className="group rounded-xl border border-border bg-surface/40 overflow-hidden hover:border-primary/60 transition"
            >
              <div className={`relative aspect-square bg-gradient-to-br ${gradientFor(a.title)}`}>
                {a.cover_url && <img src={a.cover_url} alt="" className="w-full h-full object-cover" />}
                <span
                  className={`absolute top-3 left-3 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                    a.is_published ? "bg-emerald-500/90 text-white" : "bg-amber-500/90 text-white"
                  }`}
                >
                  {a.is_published ? "Published" : "Draft"}
                </span>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <button
                    onClick={() => toggleStatus(a)}
                    title={a.is_published ? "Unpublish" : "Publish"}
                    className="grid place-items-center w-10 h-10 rounded-full bg-background/90 hover:bg-background"
                  >
                    {a.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    title="Modifier"
                    className="grid place-items-center w-10 h-10 rounded-full bg-background/90 hover:bg-background"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <Link
                    to="/albums/$slug"
                    params={{ slug: a.slug }}
                    title="View"
                    className="grid place-items-center w-10 h-10 rounded-full bg-background/90 hover:bg-background"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => remove(a)}
                    title="Supprimer"
                    className="grid place-items-center w-10 h-10 rounded-full bg-background/90 hover:bg-background hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="font-bold truncate">{a.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Music2 className="w-3 h-3" /> {trackCounts[a.id] ?? 0} tracks
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Headphones className="w-3 h-3" /> {fmtNumber(a.plays)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditAlbumDrawer
          album={editing}
          artistId={artist.id}
          userId={user!.id}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["my-albums", artist.id] })}
        />
      )}
    </>
  );
}

function EditAlbumDrawer({
  album, artistId, userId, onClose, onSaved,
}: { album: Album; artistId: string; userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(album.title);
  const [description, setDescription] = useState(album.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(album.cover_url);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Album tracks management
  const [albumTracks, setAlbumTracks] = useState<{ track_id: string; title: string; position: number }[]>([]);
  const [available, setAvailable] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    (async () => {
      const { data: at } = await supabase
        .from("album_tracks")
        .select("track_id, position, tracks(id,title)")
        .eq("album_id", album.id)
        .order("position", { ascending: true });
      const inAlbum = (at ?? []).map((r: any) => ({
        track_id: r.track_id, title: r.tracks?.title ?? "Untitled", position: r.position,
      }));
      setAlbumTracks(inAlbum);
      const inIds = new Set(inAlbum.map((t) => t.track_id));
      const { data: all } = await supabase
        .from("tracks")
        .select("id,title")
        .eq("artist_id", artistId)
        .order("released_at", { ascending: false });
      setAvailable((all ?? []).filter((t: any) => !inIds.has(t.id)));
    })();
  }, [album.id, artistId]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      let cover_url = album.cover_url;
      if (coverFile) cover_url = await uploadToBucket("covers", userId, coverFile, "album-");
      const { error } = await supabase
        .from("albums")
        .update({ title: title.trim(), description: description.trim() || null, cover_url })
        .eq("id", album.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addTrack(id: string, title: string) {
    const position = albumTracks.length;
    await supabase.from("album_tracks").insert({ album_id: album.id, track_id: id, position });
    setAlbumTracks((prev) => [...prev, { track_id: id, title, position }]);
    setAvailable((prev) => prev.filter((t) => t.id !== id));
  }

  async function removeTrack(id: string, title: string) {
    await supabase.from("album_tracks").delete().eq("album_id", album.id).eq("track_id", id);
    setAlbumTracks((prev) => prev.filter((t) => t.track_id !== id));
    setAvailable((prev) => [...prev, { id, title }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-background border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-extrabold inline-flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-primary" /> Edit album
          </h2>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-md hover:bg-surface">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Dropzone accept="image/*" onFiles={(f) => setCoverFile(f[0])}>
            <div className="flex items-center gap-4 p-4">
              <div className="w-20 h-20 rounded bg-surface grid place-items-center overflow-hidden shrink-0">
                {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Cover art</p>
                <p className="text-xs text-muted-foreground">Drag a square image here or click to browse</p>
              </div>
            </div>
          </Dropzone>

          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Tracks in album</p>
            {albumTracks.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded p-4 text-center">No tracks yet</p>
            ) : (
              <ul className="space-y-1">
                {albumTracks.map((t, i) => (
                  <li key={t.track_id} className="flex items-center gap-3 bg-surface/40 border border-border rounded-md px-3 py-2 text-sm">
                    <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    <button onClick={() => removeTrack(t.track_id, t.title)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {available.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Add a track</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {available.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 bg-surface/20 border border-border rounded-md px-3 py-2 text-sm">
                    <Music2 className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{t.title}</span>
                    <button onClick={() => addTrack(t.id, t.title)} className="text-primary hover:opacity-80">
                      <Plus className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold hover:bg-surface rounded-md">Annuler</button>
            <button
              onClick={save}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
