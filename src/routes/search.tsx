import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell, PageHeader, gradientFor } from "@/components/PageScaffold";
import { RealTrackCard } from "@/components/RealTrackCard";
import type { RealTrack } from "@/lib/tracks-data";

const searchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string }).q ?? "";
    return {
      meta: [
        { title: q ? `Search: ${q} — VinaSound` : "Search — VinaSound" },
        { name: "description", content: "Search artists and tracks on VinaSound." },
      ],
    };
  },
});

const TRACK_SELECT =
  "id,artist_id,title,slug,description,audio_url,cover_url,duration_seconds,genre,plays,likes,released_at,pricing_model,price_amount,price_currency,preview_seconds,artists(name,slug,avatar_url,verified)";

async function searchAll(q: string) {
  if (!q) return { tracks: [] as RealTrack[], artists: [] as Array<{ id: string; name: string; slug: string; avatar_url: string | null }> };
  const like = `%${q}%`;
  const [tracksRes, artistsRes] = await Promise.all([
    supabase.from("tracks").select(TRACK_SELECT).eq("is_published", true).ilike("title", like).limit(24),
    supabase.from("artists").select("id,name,slug,avatar_url").ilike("name", like).limit(12),
  ]);
  const tracks: RealTrack[] = (tracksRes.data ?? []).map((t: any) => {
    const a = Array.isArray(t.artists) ? t.artists[0] : t.artists;
    return {
      id: t.id, artist_id: t.artist_id, title: t.title, slug: t.slug,
      audio_url: t.audio_url, cover_url: t.cover_url, duration_seconds: t.duration_seconds,
      genre: t.genre, pricing_model: t.pricing_model, price_amount: t.price_amount,
      price_currency: t.price_currency, preview_seconds: t.preview_seconds,
      description: t.description, artist_name: a?.name ?? "Artiste inconnu",
      artist_slug: a?.slug ?? "", artist_avatar: a?.avatar_url ?? null,
      artist_verified: !!a?.verified, plays: t.plays ?? 0, likes: t.likes ?? 0,
      released_at: t.released_at,
    };
  });
  return { tracks, artists: artistsRes.data ?? [] };
}

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchAll(q),
    enabled: !!q,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: input.trim() } });
  };

  return (
    <PublicShell>
      <PageHeader eyebrow="Find" title="Recherche" accent={q ? `"${q}"` : "everything"} />
      <form onSubmit={submit} className="mb-8 flex items-center gap-2 bg-surface border border-border rounded-full px-5 py-3 max-w-2xl">
        <SearchIcon className="w-4 h-4 text-muted-foreground" />
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search tracks, artists..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button type="submit" className="text-sm font-bold text-primary">Rechercher</button>
      </form>

      {!q && <p className="text-sm text-muted-foreground">Type something to start searching.</p>}
      {q && isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
      {q && !isLoading && data && (
        <>
          <section className="mb-10">
            <h2 className="font-display text-xl font-extrabold mb-4">Artists ({data.artists.length})</h2>
            {data.artists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No artists found.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-5">
                {data.artists.map((a) => (
                  <Link key={a.id} to="/artists/$slug" params={{ slug: a.slug }} className="group text-center">
                    <div className={`aspect-square rounded-full overflow-hidden bg-gradient-to-br ${gradientFor(a.name)}`}>
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center font-display text-2xl font-extrabold text-white">
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold truncate group-hover:text-primary">{a.name}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold mb-4">Tracks ({data.tracks.length})</h2>
            {data.tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracks found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
                {data.tracks.map((t) => (
                  <RealTrackCard key={t.id} track={t} queue={data.tracks} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PublicShell>
  );
}
