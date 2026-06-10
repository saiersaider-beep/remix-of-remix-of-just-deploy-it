import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getPointsSummary } from "@/lib/points.functions";

export function PointsBalanceBadge({ className = "" }: { className?: string }) {
  const fetchSummary = useServerFn(getPointsSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["points-summary"],
    queryFn: () => fetchSummary(),
    staleTime: 30_000,
  });
  const pts = data?.points ?? 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-bold ${className}`}
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span className="tabular-nums">{isLoading ? "…" : pts}</span>
      <span className="opacity-70">pts</span>
    </span>
  );
}
