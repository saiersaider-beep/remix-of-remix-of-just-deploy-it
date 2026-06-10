/**
 * Compute a boost score for ranking content (tracks/artists) on
 * Discover, Trending, search, and recommendation surfaces.
 */
export function artistBoostScore(a: { verified?: boolean | null; pro_badge?: string | null; boost_score?: number | null }) {
  let s = a.boost_score ?? 0;
  if (a.verified) s += 50;
  if (a.pro_badge === "pro") s += 30;
  return s;
}

export function trackRankingScore(t: {
  plays?: number | null;
  likes?: number | null;
  released_at?: string | null;
  artist?: { verified?: boolean | null; pro_badge?: string | null; boost_score?: number | null } | null;
}) {
  let s = 0;
  s += Math.log10((t.plays ?? 0) + 1) * 10;
  s += Math.log10((t.likes ?? 0) + 1) * 8;
  if (t.released_at) {
    const days = (Date.now() - new Date(t.released_at).getTime()) / 86400000;
    if (days < 30) s += 20;
    if (days < 7) s += 10;
  }
  if (t.artist) s += artistBoostScore(t.artist);
  return s;
}
