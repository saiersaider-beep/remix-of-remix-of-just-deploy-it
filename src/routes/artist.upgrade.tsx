import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyArtist } from "@/lib/artist-helpers";
import { ArtistBadge } from "@/components/ArtistBadge";
import { Loader2, Send, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/artist/upgrade")({
  head: () => ({
    meta: [
      { title: "Become a PRO Artist — VinaSound" },
      { name: "description", content: "Apply for verification and unlock the PRO badge with algorithmic boost." },
    ],
  }),
  component: () => (
    <AuthGate>
      <UpgradePage />
    </AuthGate>
  ),
});

const schema = z.object({
  display_name: z.string().trim().min(2).max(80),
  genre: z.string().trim().max(50).optional(),
  country: z.string().trim().max(60).optional(),
  instagram: z.string().trim().max(200).optional(),
  tiktok: z.string().trim().max(200).optional(),
  youtube: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(20, "Min 20 caractères").max(1000),
});

function UpgradePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: artist, isLoading: loadingArtist } = useQuery({
    queryKey: ["my-artist", user?.id],
    enabled: !!user?.id,
    queryFn: () => getMyArtist(user!.id),
  });

  const { data: latestRequest, isLoading: loadingReq } = useQuery({
    queryKey: ["my-verif-request", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("artist_verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    display_name: "", genre: "", country: "",
    instagram: "", tiktok: "", youtube: "", reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!user || !artist) return;
    setErr(null);
    const parsed = schema.safeParse({ ...form, display_name: form.display_name || artist.name });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setSubmitting(true);
    const v = parsed.data;
    const { error } = await supabase.from("artist_verification_requests").insert({
      artist_id: artist.id,
      user_id: user.id,
      display_name: v.display_name,
      genre: v.genre || null,
      country: v.country || null,
      social_links: {
        instagram: v.instagram || null,
        tiktok: v.tiktok || null,
        youtube: v.youtube || null,
      },
      reason: v.reason,
    });
    setSubmitting(false);
    if (error) { setErr(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-verif-request", user.id] });
  }

  if (loadingArtist || loadingReq) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="PRO" accent="Become a" title="PRO Artist" />
        <div className="rounded-md border border-border bg-surface/40 p-6 max-w-2xl">
          <p className="text-sm text-muted-foreground mb-4">
            You need an artist profile before applying for PRO verification.
          </p>
          <Link to="/profile" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-bold">
            Create artist profile
          </Link>
        </div>
      </>
    );
  }

  if (artist.verified) {
    return (
      <>
        <PageHeader eyebrow="PRO" accent="You're" title="Verified ✨" />
        <div className="rounded-md border border-border bg-surface/40 p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <ArtistBadge verified pro={(artist as any).pro_badge ?? "pro"} size="md" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your artist profile is verified and benefits from algorithmic boost across Discover, Trending and search.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="PRO Program"
        accent="Become a"
        title="PRO Artist"
        description="Submit your application for verification. Approved artists get the PRO badge, priority in search and a boost on Discover."
      />

      {latestRequest && latestRequest.status === "pending" && (
        <StatusCard tone="amber" icon={<Clock className="w-5 h-5" />} title="Request under review">
          We received your application on {new Date(latestRequest.created_at).toLocaleDateString()}. Our team will review it shortly.
        </StatusCard>
      )}
      {latestRequest && latestRequest.status === "rejected" && (
        <StatusCard tone="red" icon={<XCircle className="w-5 h-5" />} title="Previous request rejected">
          {latestRequest.rejection_reason || "No reason provided."} You may submit a new request below.
        </StatusCard>
      )}
      {latestRequest && latestRequest.status === "approved" && (
        <StatusCard tone="emerald" icon={<CheckCircle2 className="w-5 h-5" />} title="Approved!">
          Refresh the page — your PRO badge should appear.
        </StatusCard>
      )}

      {(!latestRequest || latestRequest.status !== "pending") && (
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mt-6">
          <div className="space-y-4">
            <Field label="Stage name *" value={form.display_name} placeholder={artist.name} onChange={(v) => setForm({ ...form, display_name: v })} />
            <Field label="Genre" value={form.genre} placeholder="Hip-Hop, Afrobeats…" onChange={(v) => setForm({ ...form, genre: v })} />
            <Field label="Pays" value={form.country} placeholder="Côte d'Ivoire" onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="Instagram URL" value={form.instagram} placeholder="https://instagram.com/…" onChange={(v) => setForm({ ...form, instagram: v })} />
            <Field label="TikTok URL" value={form.tiktok} placeholder="https://tiktok.com/@…" onChange={(v) => setForm({ ...form, tiktok: v })} />
            <Field label="YouTube URL" value={form.youtube} placeholder="https://youtube.com/@…" onChange={(v) => setForm({ ...form, youtube: v })} />
            <div>
              <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Why do you deserve PRO? *</label>
              <textarea
                rows={5}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                maxLength={1000}
                placeholder="Tell us about your career, releases, audience…"
                className="w-full bg-surface border border-border rounded-md px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{form.reason.length}/1000</p>
            </div>

            {err && <p className="text-sm text-destructive">{err}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60 hover:opacity-90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit verification request
            </button>
          </div>

          <aside className="rounded-md border border-border bg-surface/30 p-6 h-fit">
            <h3 className="font-display text-xl font-extrabold mb-3 inline-flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> PRO benefits
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>⭐ PRO badge on your artist page</li>
              <li>🔵 Verified checkmark</li>
              <li>🚀 Algorithmic boost on Discover & Trending</li>
              <li>🔍 Priority in search results</li>
              <li>🎯 Eligible for editorial playlists</li>
              <li>📈 Advanced analytics (coming soon)</li>
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function StatusCard({ tone, icon, title, children }: { tone: "amber" | "red" | "emerald"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const colors = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  }[tone];
  return (
    <div className={`rounded-md border p-4 max-w-2xl mb-4 ${colors}`}>
      <div className="flex items-center gap-2 font-bold mb-1">{icon}{title}</div>
      <p className="text-sm opacity-90">{children}</p>
    </div>
  );
}
