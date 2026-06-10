import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, BadgeCheck } from "lucide-react";
import { AuthGate, PageHeader, EmptyState, gradientFor } from "@/components/PageScaffold";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/following")({
  head: () => ({
    meta: [
      { title: "Following — VinaSound" },
      { name: "description", content: "Artists you follow on VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <FollowingList />
    </AuthGate>
  ),
});

type Row = {
  artist_id: string;
  artists: { id: string; slug: string; name: string; avatar_url: string | null; verified: boolean } | null;
};

function FollowingList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("artist_followers")
      .select("artist_id, artists(id, slug, name, avatar_url, verified)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <>
      <PageHeader eyebrow="Social" accent="Artists You" title="Suivre" />
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="You're not following anyone yet" hint="Discover artists and tap Follow to see them here." />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => {
            const a = r.artists;
            if (!a) return null;
            return (
              <li key={a.id}>
                <Link
                  to="/artists/$slug"
                  params={{ slug: a.slug }}
                  className="flex items-center gap-4 p-4 rounded-md border border-border bg-surface/40 hover:border-primary transition"
                >
                  <div className={`w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br ${gradientFor(a.name)} shrink-0`}>
                    {a.avatar_url && <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate flex items-center gap-1">
                      {a.name}
                      {a.verified && <BadgeCheck className="w-4 h-4 text-sky-400" />}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Artist
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
