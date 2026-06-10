import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureUniqueSlug, getAudioDuration, getMyArtist, uploadWithProgress,
  validateAudio, validateImage, fmtBytes, fmtDuration, slugify,
} from "@/lib/artist-helpers";
import { Dropzone } from "@/components/Dropzone";
import { ProgressBar } from "@/components/ProgressBar";
import { compressImage } from "@/lib/image-compression";
import {
  Disc3, Image as ImageIcon, Loader2, X, GripVertical, Music2, Eye, EyeOff,
} from "lucide-react";

export const Route = createFileRoute("/upload-album")({
  head: () => ({
    meta: [
      { title: "Upload Album — VinaSound" },
      { name: "description", content: "Bundle multiple tracks into an album release." },
    ],
  }),
  component: () => (
    <AuthGate>
      <UploadAlbumPage />
    </AuthGate>
  ),
});

type Pending = {
  file: File;
  title: string;
  duration: number;
  pct: number;
  error?: string;
};

function UploadAlbumPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: artist, isLoading } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverPct, setCoverPct] = useState(0);
  const [tracks, setTracks] = useState<Pending[]>([]);
  const [publish, setPublish] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function pickCover(f: File) {
    const e = validateImage(f);
    if (e) { setErr(e); return; }
    setErr(null);
    const compressed = await compressImage(f, { maxDimension: 1400, quality: 0.85 });
    setCoverFile(compressed);
  }

  async function addAudioFiles(files: File[]) {
    const next: Pending[] = [];
    for (const f of files) {
      const v = validateAudio(f);
      if (v) { setErr(v); continue; }
      const duration = await getAudioDuration(f);
      next.push({ file: f, title: f.name.replace(/\.[^.]+$/, ""), duration, pct: 0 });
    }
    if (next.length) setErr(null);
    setTracks((prev) => [...prev, ...next]);
  }

  function move(i: number, dir: -1 | 1) {
    setTracks((prev) => {
      const copy = [...prev];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return prev;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function removeAt(i: number) { setTracks((prev) => prev.filter((_, idx) => idx !== i)); }

  function setTrackPct(idx: number, pct: number) {
    setTracks((prev) => prev.map((t, i) => i === idx ? { ...t, pct } : t));
  }

  async function submit() {
    if (!user || !artist) return;
    if (!title.trim() || tracks.length === 0) {
      setErr("Album needs a title and at least one track.");
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const albumSlug = await ensureUniqueSlug("albums", title);

      let cover_url: string | null = null;
      if (coverFile) {
        const r = await uploadWithProgress("covers", user.id, coverFile, `${albumSlug}-`, setCoverPct);
        cover_url = r.publicUrl;
      }

      const { data: album, error: albumErr } = await supabase
        .from("albums")
        .insert({
          artist_id: artist.id,
          title: title.trim(),
          slug: albumSlug,
          description: description.trim() || null,
          cover_url,
          is_published: publish,
        })
        .select()
        .single();
      if (albumErr) throw albumErr;

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const trackSlug = await ensureUniqueSlug("tracks", `${albumSlug}-${slugify(t.title)}-${i + 1}`);
        const { publicUrl: audio_url } = await uploadWithProgress(
          "audio", user.id, t.file, `${trackSlug}-`, (pct) => setTrackPct(i, pct),
        );
        const { data: track, error: trackErr } = await supabase
          .from("tracks")
          .insert({
            artist_id: artist.id,
            title: t.title.trim() || `Track ${i + 1}`,
            slug: trackSlug,
            audio_url,
            cover_url,
            duration_seconds: t.duration,
            is_published: publish,
          })
          .select()
          .single();
        if (trackErr) throw trackErr;
        await supabase.from("album_tracks").insert({
          album_id: album.id,
          track_id: track.id,
          position: i,
        });
      }

      navigate({ to: "/my-albums" });
    } catch (e: any) {
      setErr(e.message ?? "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Publier" accent="Nouveau" title="Album" />
        <EmptyState title="No artist profile yet" hint="Create your profile to publish albums." />
        <div className="mt-4">
          <Link to="/profile" className="inline-flex bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold">
            Create profile
          </Link>
        </div>
      </>
    );
  }

  const totalPct = tracks.length
    ? Math.round(tracks.reduce((s, t) => s + t.pct, 0) / tracks.length)
    : 0;

  return (
    <>
      <PageHeader eyebrow="Publier" accent="Nouveau" title="Album" description="Drop multiple audio files, set the order, then release." />

      <div className="grid lg:grid-cols-[260px_1fr] gap-8 max-w-5xl">
        <div>
          <Dropzone accept="image/*" onFiles={(f) => pickCover(f[0])}>
            <div className="aspect-square grid place-items-center overflow-hidden">
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="text-center px-4">
                  <ImageIcon className="w-10 h-10 text-primary mx-auto" />
                  <p className="font-bold mt-3">Album cover</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG/PNG/WEBP · ≤ 10 MB</p>
                </div>
              )}
            </div>
          </Dropzone>
          {submitting && coverFile && <div className="mt-3"><ProgressBar label="Cover" pct={coverPct} /></div>}
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Album title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Eternal Echoes, Vol. 1"
              maxLength={120}
              className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Description</label>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPublish((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                publish ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              }`}
            >
              {publish ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {publish ? "Publish on release" : "Save as draft"}
            </button>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold mb-4 inline-flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-primary" /> Tracks
        </h2>

        <Dropzone accept="audio/*" multiple onFiles={addAudioFiles} hint="MP3, WAV, FLAC, M4A, OGG · ≤ 100 MB each" />

        {tracks.length > 0 && (
          <ul className="mt-5 space-y-2">
            {tracks.map((t, i) => (
              <li key={i} className="bg-surface/40 border border-border rounded-md px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0 || submitting} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▲</button>
                    <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1 || submitting} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px]">▼</button>
                  </div>
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <Music2 className="w-4 h-4 text-primary shrink-0" />
                  <input
                    value={t.title}
                    disabled={submitting}
                    onChange={(e) => setTracks((prev) => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                    className="flex-1 bg-transparent outline-none text-sm font-semibold min-w-0"
                  />
                  <span className="text-xs text-muted-foreground hidden sm:inline">{fmtBytes(t.file.size)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmtDuration(t.duration)}</span>
                  <button onClick={() => removeAt(i)} disabled={submitting} className="grid place-items-center w-8 h-8 rounded hover:bg-surface text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {submitting && <div className="mt-2"><ProgressBar label={`Track ${i + 1}`} pct={t.pct} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {err && <p className="text-sm text-destructive mt-6">{err}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          onClick={submit}
          disabled={submitting || !title.trim() || tracks.length === 0}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold disabled:opacity-60 hover:opacity-90"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? `Uploading… ${totalPct}%` : publish ? "Release album" : "Save draft"}
        </button>
      </div>
    </>
  );
}
