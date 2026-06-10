import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, Eye, EyeOff, Music2, X } from "lucide-react";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { Dropzone } from "@/components/Dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ensureUniqueSlug, getAudioDuration, getMyArtist, uploadWithProgress,
  validateAudio, validateImage, fmtBytes, fmtDuration,
} from "@/lib/artist-helpers";
import { useQuery } from "@tanstack/react-query";
import { ProgressBar } from "@/components/ProgressBar";
import { compressImage } from "@/lib/image-compression";

export const Route = createFileRoute("/upload-single")({
  head: () => ({
    meta: [
      { title: "Upload Single — VinaSound" },
      { name: "description", content: "Upload a single track to VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <UploadSingleForm />
    </AuthGate>
  ),
});

function UploadSingleForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [publish, setPublish] = useState(true);
  const [pricingModel, setPricingModel] = useState<"free" | "paid">("free");
  const [priceAmount, setPriceAmount] = useState<string>("500");
  const [priceCurrency, setPriceCurrency] = useState("XOF");
  const [submitting, setSubmitting] = useState(false);
  const [audioPct, setAudioPct] = useState(0);
  const [coverPct, setCoverPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function pickAudio(f: File) {
    const err = validateAudio(f);
    if (err) { setError(err); return; }
    setError(null);
    setAudioFile(f);
    setAudioDuration(await getAudioDuration(f));
  }
  async function pickCover(f: File) {
    const err = validateImage(f);
    if (err) { setError(err); return; }
    setError(null);
    const compressed = await compressImage(f, { maxDimension: 1400, quality: 0.85 });
    setCoverFile(compressed);
  }

  const canSubmit = useMemo(
    () => !!audioFile && title.trim().length > 0 && !submitting && !!artist,
    [audioFile, title, submitting, artist],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !artist || !audioFile) return;
    setError(null);
    setSubmitting(true);
    setAudioPct(0); setCoverPct(0);
    try {
      const slug = await ensureUniqueSlug("tracks", title);
      const { publicUrl: audio_url } = await uploadWithProgress("audio", user.id, audioFile, `${slug}-`, setAudioPct);
      let cover_url: string | null = null;
      if (coverFile) {
        const r = await uploadWithProgress("covers", user.id, coverFile, `${slug}-`, setCoverPct);
        cover_url = r.publicUrl;
      }
      const priceNum = pricingModel === "paid" ? Math.max(1, Math.round(Number(priceAmount) || 0)) : 0;
      if (pricingModel === "paid" && priceNum <= 0) throw new Error("Indique un prix valide pour cette chanson payante.");
      const { error: insertErr } = await supabase.from("tracks").insert({
        artist_id: artist.id,
        title: title.trim(),
        slug,
        description: description.trim() || null,
        lyrics: lyrics.trim() || null,
        genre: genre.trim() || null,
        audio_url,
        cover_url,
        duration_seconds: audioDuration,
        is_published: publish,
        pricing_model: pricingModel,
        price_amount: priceNum,
        price_currency: priceCurrency,
        preview_seconds: pricingModel === "paid" ? 10 : 30,
      });
      if (insertErr) throw insertErr;
      navigate({ to: "/my-songs" });
    } catch (err: any) {
      console.error("[upload-single] failed", err);
      const msg = err?.message || err?.error_description || err?.hint || "Upload failed";
      setError(`${msg}${err?.code ? ` (code ${err.code})` : ""}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (artistLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Publier" accent="Upload a" title="Single" />
        <div className="max-w-2xl border border-border rounded-md p-8 bg-surface/40">
          <p className="font-bold">You need an artist profile to publish music.</p>
          <p className="text-sm text-muted-foreground mt-2">Create your artist page, then come back to upload tracks.</p>
          <Link to="/profile" className="inline-flex mt-4 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold">
            Create artist profile
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Publier" accent="Upload a" title="Single" />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <Dropzone accept="audio/*" onFiles={(f) => pickAudio(f[0])} hint="MP3, WAV, FLAC, M4A, OGG · up to 100 MB">
          <div className="text-center px-6 py-10">
            <UploadCloud className="w-10 h-10 text-primary mx-auto" />
            {audioFile ? (
              <>
                <p className="font-bold mt-3 inline-flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-primary" />{audioFile.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtBytes(audioFile.size)} · {fmtDuration(audioDuration)} · click to replace
                </p>
              </>
            ) : (
              <>
                <p className="font-bold mt-3">Drag & drop your audio file</p>
                <p className="text-xs text-muted-foreground mt-1">MP3, WAV, FLAC, M4A, OGG · up to 100 MB</p>
              </>
            )}
          </div>
        </Dropzone>

        {submitting && audioFile && <ProgressBar label="Audio" pct={audioPct} />}

        <Dropzone accept="image/*" onFiles={(f) => pickCover(f[0])}>
          <div className="flex items-center gap-4 p-4">
            <div className="w-16 h-16 rounded bg-surface grid place-items-center overflow-hidden shrink-0">
              {coverPreview ? <img src={coverPreview} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-bold text-sm">{coverFile ? coverFile.name : "Add cover art (optional)"}</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · up to 10 MB · square preferred</p>
            </div>
            {coverFile && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setCoverFile(null); }}
                className="grid place-items-center w-8 h-8 rounded hover:bg-surface text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </Dropzone>

        {submitting && coverFile && <ProgressBar label="Cover" pct={coverPct} />}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Track title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midnight Drive" required maxLength={120} />
          <Field label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Hip Hop, Afrobeat…" maxLength={40} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Description</label>
          <textarea
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Paroles (lyrics)</label>
          <textarea
            rows={8}
            maxLength={20000}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={"Colle ici les paroles du morceau\u2026 (optionnel)"}
            className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm leading-6 font-mono outline-none focus:border-primary whitespace-pre-wrap"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Les sauts de ligne sont conservés. Tu pourras les modifier plus tard depuis la page du morceau.</p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground">Tarifs</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPricingModel("free")}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-bold transition ${
                pricingModel === "free" ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface/40 text-muted-foreground"
              }`}
            >
              🎵 Gratuit
              <p className="text-[11px] font-normal mt-1 opacity-80">Écoute illimitée pour tous</p>
            </button>
            <button
              type="button"
              onClick={() => setPricingModel("paid")}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-bold transition ${
                pricingModel === "paid" ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface/40 text-muted-foreground"
              }`}
            >
              💰 Payant
              <p className="text-[11px] font-normal mt-1 opacity-80">Aperçu de 10s, achat requis</p>
            </button>
          </div>
          {pricingModel === "paid" && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="number"
                min={1}
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                placeholder="Prix"
                className="bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <select
                value={priceCurrency}
                onChange={(e) => setPriceCurrency(e.target.value)}
                className="bg-surface border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="XOF">XOF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="NGN">NGN</option>
              </select>
            </div>
          )}
        </div>

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

        {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        {!canSubmit && !submitting && (
          <p className="text-xs text-muted-foreground">
            {!audioFile && "→ Ajoute un fichier audio. "}
            {!title.trim() && "→ Donne un titre au morceau. "}
            {!artist && "→ Crée d'abord ton profil artiste. "}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 font-bold disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Uploading…" : publish ? "Publish track" : "Save draft"}
        </button>
      </form>
    </>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">{label}</label>
      <input {...props} className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary" />
    </div>
  );
}
