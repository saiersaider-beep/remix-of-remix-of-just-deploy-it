import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Headphones,
  Heart,
  Users,
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  Upload,
  DollarSign,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Artist Dashboard — VinaSound" },
      {
        name: "description",
        content:
          "Real-time streams, likes, followers analytics and top releases for your artist profile.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <DashboardPage />
    </AuthGate>
  ),
});

type Artist = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  monthly_listeners: number;
};

type Track = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  plays: number;
  likes: number;
  released_at: string;
};

type DailyStat = {
  day: string;
  plays: number;
  likes: number;
  unlikes: number;
  followers_gained: number;
  followers_lost: number;
};

type Range = 7 | 30 | 90;

function DashboardPage() {
  const { user } = useAuth();

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ["dashboard-artist", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Artist | null> => {
      const { data } = await supabase
        .from("artists")
        .select("id,name,slug,avatar_url,monthly_listeners")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (artistLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!artist) {
    return (
      <>
        <PageHeader eyebrow="Studio" accent="Artiste" title="Tableau de bord" />
        <EmptyState
          title="You don't have an artist profile yet"
          hint="Create your artist page to unlock analytics, releases and revenue tracking."
        />
      </>
    );
  }

  return <DashboardContent artist={artist} />;
}

function DashboardContent({ artist }: { artist: Artist }) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<Range>(30);
  const [followers, setFollowers] = useState<number>(0);
  const [livePulse, setLivePulse] = useState(0);

  // ---------- Top tracks ----------
  const { data: tracks = [] } = useQuery({
    queryKey: ["dashboard-tracks", artist.id],
    queryFn: async (): Promise<Track[]> => {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,slug,cover_url,plays,likes,released_at")
        .eq("artist_id", artist.id)
        .order("plays", { ascending: false })
        .limit(5);
      return (data ?? []) as Track[];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard-recent", artist.id],
    queryFn: async (): Promise<Track[]> => {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,slug,cover_url,plays,likes,released_at")
        .eq("artist_id", artist.id)
        .order("released_at", { ascending: false })
        .limit(5);
      return (data ?? []) as Track[];
    },
  });

  // ---------- Followers count + live ----------
  useEffect(() => {
    let mounted = true;
    supabase
      .from("artist_followers")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", artist.id)
      .then(({ count }) => {
        if (mounted) setFollowers(count ?? 0);
      });

    const channel = supabase
      .channel(`dash-followers-${artist.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "artist_followers",
          filter: `artist_id=eq.${artist.id}`,
        },
        () => {
          setFollowers((c) => c + 1);
          setLivePulse((p) => p + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "artist_followers",
          filter: `artist_id=eq.${artist.id}`,
        },
        () => setFollowers((c) => Math.max(0, c - 1)),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [artist.id]);

  // ---------- Aggregated daily stats (scalable) ----------
  // Fetches range*2 days so we can compute period-over-period deltas
  const { data: stats = [] } = useQuery({
    queryKey: ["dashboard-daily-stats", artist.id, range],
    queryFn: async (): Promise<DailyStat[]> => {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setUTCDate(since.getUTCDate() - (range * 2 - 1));
      const { data } = await supabase
        .from("artist_daily_stats")
        .select("day,plays,likes,unlikes,followers_gained,followers_lost")
        .eq("artist_id", artist.id)
        .gte("day", since.toISOString().slice(0, 10))
        .order("day", { ascending: true });
      return (data ?? []) as DailyStat[];
    },
  });

  // ---------- Realtime: invalidate stats + live pulse on new events ----------
  useEffect(() => {
    const channel = supabase
      .channel(`dash-events-${artist.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "track_events",
          filter: `artist_id=eq.${artist.id}`,
        },
        () => {
          setLivePulse((p) => p + 1);
          queryClient.invalidateQueries({
            queryKey: ["dashboard-daily-stats", artist.id],
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "artist_daily_stats",
          filter: `artist_id=eq.${artist.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["dashboard-daily-stats", artist.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artist.id, queryClient]);

  // ---------- Build chart series for the selected range ----------
  const { chartData, currentTotals, previousTotals } = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const days: { key: string; label: string }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    }

    const byDay = new Map(stats.map((s) => [s.day, s]));
    let runningFollowers = 0;
    const data = days.map((d) => {
      const s = byDay.get(d.key);
      const plays = s?.plays ?? 0;
      const likes = Math.max(0, (s?.likes ?? 0) - (s?.unlikes ?? 0));
      const dayDelta =
        (s?.followers_gained ?? 0) - (s?.followers_lost ?? 0);
      runningFollowers += dayDelta;
      return {
        date: d.label,
        plays,
        likes,
        followers: dayDelta,
        followersTotal: runningFollowers,
      };
    });

    // Period totals
    const totals = (slice: typeof data) => ({
      plays: slice.reduce((s, d) => s + d.plays, 0),
      likes: slice.reduce((s, d) => s + d.likes, 0),
      followers: slice.reduce((s, d) => s + d.followers, 0),
    });

    // Previous period (range days before)
    const prevStart = new Date(today);
    prevStart.setUTCDate(prevStart.getUTCDate() - range * 2 + 1);
    const prevEnd = new Date(today);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - range);
    const prevKeys = new Set<string>();
    for (
      let d = new Date(prevStart);
      d <= prevEnd;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      prevKeys.add(d.toISOString().slice(0, 10));
    }
    const prevSlice = stats.filter((s) => prevKeys.has(s.day));
    const previous = {
      plays: prevSlice.reduce((s, x) => s + (x.plays ?? 0), 0),
      likes: prevSlice.reduce(
        (s, x) => s + Math.max(0, (x.likes ?? 0) - (x.unlikes ?? 0)),
        0,
      ),
      followers: prevSlice.reduce(
        (s, x) => s + (x.followers_gained ?? 0) - (x.followers_lost ?? 0),
        0,
      ),
    };

    return {
      chartData: data,
      currentTotals: totals(data),
      previousTotals: previous,
    };
  }, [stats, range]);

  const totalStreams = tracks.reduce((s, t) => s + (t.plays ?? 0), 0);
  const totalLikes = tracks.reduce((s, t) => s + (t.likes ?? 0), 0);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader
        eyebrow="Studio"
        accent={artist.name}
        title="Tableau de bord"
        description="Real-time analytics, top tracks and recent releases for your artist page."
        actions={
          <>
            <Link
              to="/artists/$slug"
              params={{ slug: artist.slug }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface transition"
            >
              View public page <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              to="/artist/withdraw"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface transition"
            >
              Withdraw earnings
            </Link>
            <Link
              to="/upload-song"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition shadow-glow"
            >
              <Upload className="w-4 h-4" /> Upload track
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Headphones}
          label="Streams"
          value={currentTotals.plays.toLocaleString()}
          delta={delta(currentTotals.plays, previousTotals.plays)}
          hint={`vs previous ${range}d · ${totalStreams.toLocaleString()} all-time`}
        />
        <Kpi
          icon={Heart}
          label="Likes"
          value={currentTotals.likes.toLocaleString()}
          delta={delta(currentTotals.likes, previousTotals.likes)}
          hint={`${totalLikes.toLocaleString()} all-time`}
        />
        <Kpi
          icon={Users}
          label="Abonnés"
          value={followers.toLocaleString()}
          delta={delta(currentTotals.followers, previousTotals.followers, true)}
          hint={`${signed(currentTotals.followers)} this period`}
        />
        <Kpi
          icon={DollarSign}
          label="Revenue"
          value="—"
          hint="CinetPay bientôt"
          muted
        />
      </div>

      {/* Chart */}
      <Card className="bg-surface/40 backdrop-blur border-border overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span>Performance</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground mr-3">
              <Legend color="var(--color-primary)" label="Plays" />
              <Legend color="#ec4899" label="Likes" />
              <Legend color="#22d3ee" label="Abonnés" />
            </div>
            <RangePicker value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="playsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="likesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="followersGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-elegant)",
                  }}
                  labelStyle={{
                    color: "var(--color-foreground)",
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plays"
                  stroke="var(--color-primary)"
                  fill="url(#playsGrad)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="likes"
                  stroke="#ec4899"
                  fill="url(#likesGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="#22d3ee"
                  fill="url(#followersGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top tracks + Recent releases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrackPanel
          title="Top tracks"
          icon={Flame}
          tracks={tracks}
          emptyHint="Upload your first track to see it here."
          metric="plays"
        />
        <TrackPanel
          title="Recently released"
          icon={Clock}
          tracks={recent}
          emptyHint="No releases yet."
          metric="released_at"
        />
      </div>
    </div>
  );
}

function delta(curr: number, prev: number, signedDisplay = false) {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { pct: 100, up: curr > 0, signedDisplay };
  const pct = ((curr - prev) / prev) * 100;
  return { pct, up: pct >= 0, signedDisplay };
}

function signed(n: number) {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

function RangePicker({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const opts: Range[] = [7, 30, 90];
  return (
    <div className="inline-flex bg-surface/60 border border-border rounded-full p-1">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 text-xs font-bold rounded-full transition ${
            value === o
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o}d
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  live,
  pulseKey,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  delta?: { pct: number; up: boolean; signedDisplay?: boolean } | null;
  live?: boolean;
  pulseKey?: number;
  muted?: boolean;
}) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!live || pulseKey === undefined) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(t);
  }, [pulseKey, live]);

  return (
    <Card
      className={`bg-surface/40 backdrop-blur border-border overflow-hidden relative transition-shadow ${
        pulse ? "shadow-glow" : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </p>
          <Icon
            className={`w-4 h-4 ${muted ? "text-muted-foreground" : "text-primary"}`}
          />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p
            className={`font-display text-2xl sm:text-3xl font-extrabold tabular-nums ${
              muted ? "text-muted-foreground" : ""
            }`}
          >
            {value}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2 min-h-[16px]">
          {delta && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                delta.up ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {delta.up ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {delta.up ? "+" : ""}
              {delta.pct.toFixed(0)}%
            </span>
          )}
          {hint && (
            <p className="text-[11px] text-muted-foreground truncate">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function TrackPanel({
  title,
  icon: Icon,
  tracks,
  emptyHint,
  metric,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tracks: Track[];
  emptyHint: string;
  metric: "plays" | "released_at";
}) {
  return (
    <Card className="bg-surface/40 backdrop-blur border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="divide-y divide-border">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-3 py-3 group"
              >
                <span className="font-display text-lg font-extrabold text-muted-foreground w-5 tabular-nums">
                  {i + 1}
                </span>
                <div className="w-10 h-10 rounded bg-surface overflow-hidden shrink-0 ring-1 ring-border">
                  {t.cover_url && (
                    <img
                      src={t.cover_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  )}
                </div>
                <Link
                  to="/tracks/$slug"
                  params={{ slug: t.slug }}
                  className="flex-1 min-w-0"
                >
                  <p className="font-bold text-sm truncate group-hover:text-primary transition">
                    {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.plays.toLocaleString()} plays ·{" "}
                    {t.likes.toLocaleString()} likes
                  </p>
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {metric === "plays"
                    ? t.plays.toLocaleString()
                    : new Date(t.released_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
