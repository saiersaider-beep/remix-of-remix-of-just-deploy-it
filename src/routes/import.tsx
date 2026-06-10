import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Youtube, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ensureUniqueSlug, getMyArtist } from "@/lib/artist-helpers";
import { importAudioFromUrl } from "@/lib/import-track.functions";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import — VinaSound" },
      { name: "description", content: "Import music from external sources." },
    ],
  }),
  component: () => (
    <AuthGate>
      <ImportForm />
    </AuthGate>
  ),
});

async function probeDuration(url: string): Promise<number> {
  return await new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.crossOrigin = "anonymous";
    const done = (v: number) => { a.src = ""; resolve(v); };
    a.onloadedmetadata = () => done(Math.round(a.duration || 0));
    a.onerror = () => done(0);
    a.src = url;
    setTimeout(() => done(Math.round(a.duration || 0)), 8000);
  });
}

function ImportForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const importFn = useServerFn(importAudioFromUrl);

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !artist) return;
    setError(null);
    setSubmitting(true);
    try {
      const finalTitle = title.trim() || (() => {
        try { return new URL(url).pathname.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") || "Imported track"; }
        catch { return "Imported track"; }
      })();
      const { publicUrl } = await importFn({ data: { url: url.trim() } });
      const duration = await probeDuration(publicUrl);
      const slug = await ensureUniqueSlug("tracks", finalTitle);
      const { error: insertErr } = await supabase.from("tracks").insert({
        artist_id: artist.id,
        title: finalTitle,
        slug,
        audio_url: publicUrl,
        duration_seconds: duration,
        is_published: true,
      });
      if (insertErr) throw insertErr;
      navigate({ to: "/my-songs" });
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (artistLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Import" accent="Import" title="From URL" />
        <div className="max-w-2xl border border-border rounded-md p-8 bg-surface/40">
          <p className="font-bold">You need an artist profile to import music.</p>
          <Link to="/profile" className="inline-flex mt-4 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold">
            Create artist profile
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Import"
        accent="Import"
        title="From URL"
        description="Bring in tracks from external links."
      />
      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Source URL</label>
          <div className="flex items-center bg-surface border border-border rounded-full px-5 py-2.5 focus-within:border-primary">
            <Link2 className="w-4 h-4 text-muted-foreground mr-3" />
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/track.mp3"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Auto-detected from URL if empty"
            className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Youtube className="w-4 h-4" /> Direct audio URLs only (.mp3, .wav, .m4a, .ogg, .flac). YouTube/SoundCloud not supported.
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 font-bold disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Importing…" : "Import track"}
        </button>
      </form>
    </>
  );
}
