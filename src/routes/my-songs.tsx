import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtDuration, fmtNumber, getMyArtist, uploadToBucket, removeStorageObjects } from "@/lib/artist-helpers";
import { Dropzone } from "@/components/Dropzone";
import {
  Pencil, Trash2, Eye, EyeOff, Headphones, Heart, Plus, Loader2, Check, X, Image as ImageIcon, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/my-songs")({
  head: () => ({
    meta: [
      { title: "My Songs — VinaSound" },
      { name: "description", content: "Manage your published and draft tracks." },
    ],
  }),
  component: () => (
    <AuthGate>
      <MySongsPage />
    </AuthGate>
  ),
});

type Track = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  audio_url: string | null;
  genre: string | null;
  description: string | null;
  duration_seconds: number;
  plays: number;
  likes: number;
  is_published: boolean;
  released_at: string;
};

type Filter = "all" | "published" | "draft";

function MySongsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Track | null>(null);

  const { data: artist } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["my-songs", artist?.id],
    enabled: !!artist?.id,
    queryFn: async (): Promise<Track[]> => {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,slug,cover_url,audio_url,genre,description,duration_seconds,plays,likes,is_published,released_at")
        .eq("artist_id", artist!.id)
        .order("released_at", { ascending: false });
      return (data ?? []) as Track[];
    },
  });

  async function toggleStatus(t: Track) {
    await supabase.from("tracks").update({ is_published: !t.is_published }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["my-songs", artist?.id] });
  }

  async function remove(t: Track) {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    await supabase.from("tracks").delete().eq("id", t.id);
    await Promise.all([
      removeStorageObjects("audio", [t.audio_url]),
      removeStorageObjects("covers", [t.cover_url]),
    ]);
    qc.invalidateQueries({ queryKey: ["my-songs", artist?.id] });
  }

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Studio" accent="My" title="Titres" />
        <EmptyState
          title="No artist profile yet"
          hint="Create your artist profile in Profile Pro to start uploading tracks."
        />
        <div className="mt-4">
          <Link to="/profile" className="inline-flex bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold">
            Create profile
          </Link>
        </div>
      </>
    );
  }

  const filtered = tracks.filter((t) =>
    filter === "all" ? true : filter === "published" ? t.is_published : !t.is_published,
  );

  const counts = {
    all: tracks.length,
    published: tracks.filter((t) => t.is_published).length,
    draft: tracks.filter((t) => !t.is_published).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        accent="My"
        title="Titres"
        description="Edit, unpublish or delete your tracks. Drafts stay private until you publish."
        actions={
          <Link
            to="/upload-single"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Upload track
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
        <p className="text-sm text-muted-foreground">Loading tracks…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === "draft" ? "No drafts" : filter === "published" ? "Nothing published yet" : "No tracks yet"}
          hint="Upload your first single to get started."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-4 p-3 rounded-md border border-border bg-surface/40 hover:border-primary/60 transition"
            >
              <div className={`w-14 h-14 rounded overflow-hidden bg-gradient-to-br ${gradientFor(t.title)} shrink-0`}>
                {t.cover_url && <img src={t.cover_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/tracks/$slug"
                    params={{ slug: t.slug }}
                    className="font-bold text-sm truncate hover:text-primary"
                  >
                    {t.title}
                  </Link>
                  <span
                    className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                      t.is_published
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {t.is_published ? "Published" : "Draft"}
                  </span>
                  {t.genre && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.genre}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Headphones className="w-3 h-3" /> {fmtNumber(t.plays)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {fmtNumber(t.likes)}
                  </span>
                  <span className="tabular-nums">{fmtDuration(t.duration_seconds)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleStatus(t)}
                  title={t.is_published ? "Unpublish" : "Publish"}
                  className="grid place-items-center w-9 h-9 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground"
                >
                  {t.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setEditing(t)}
                  title="Modifier"
                  className="grid place-items-center w-9 h-9 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <Link
                  to="/tracks/$slug"
                  params={{ slug: t.slug }}
                  title="View"
                  className="grid place-items-center w-9 h-9 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => remove(t)}
                  title="Supprimer"
                  className="grid place-items-center w-9 h-9 rounded-md hover:bg-surface text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditTrackDrawer
          track={editing}
          userId={user!.id}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["my-songs", artist.id] })}
        />
      )}
    </>
  );
}

function EditTrackDrawer({
  track, userId, onClose, onSaved,
}: { track: Track; userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(track.title);
  const [genre, setGenre] = useState(track.genre ?? "");
  const [description, setDescription] = useState(track.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(track.cover_url);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      let cover_url = track.cover_url;
      if (coverFile) cover_url = await uploadToBucket("covers", userId, coverFile, "track-");
      const { error } = await supabase
        .from("tracks")
        .update({
          title: title.trim(),
          genre: genre.trim() || null,
          description: description.trim() || null,
          cover_url,
        })
        .eq("id", track.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-background border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-extrabold">Edit track</h2>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-md hover:bg-surface">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Dropzone
            accept="image/*"
            onFiles={(f) => setCoverFile(f[0])}
            className="overflow-hidden"
          >
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

          <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
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

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">{label}</label>
      <input {...props} className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
    </div>
  );
}
