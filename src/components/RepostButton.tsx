import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Repeat2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getRepostInfo, toggleRepost } from "@/lib/track-reposts";
import { triggerReward } from "@/components/RewardOverlay";

interface Props {
  trackId: string;
  variant?: "icon" | "pill";
}

export function RepostButton({ trackId, variant = "icon" }: Props) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["track-reposts", trackId],
    queryFn: () => getRepostInfo(trackId),
  });
  const m = useMutation({
    mutationFn: () => toggleRepost(trackId),
    onSuccess: (info) => {
      qc.setQueryData(["track-reposts", trackId], info);
      toast.success(info.isReposted ? "Reposté 🔁" : "Repost retiré");
      if (info.isReposted) triggerReward("repost");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = !!data?.isReposted;
  const count = data?.count ?? 0;

  if (variant === "pill") {
    return (
      <button
        onClick={() => m.mutate()}
        disabled={m.isPending}
        data-active={active ? "true" : "false"}
        className={`track-secondary-button inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] ${
          active
            ? "text-[var(--accent-emerald)]"
            : ""
        }`}
        aria-label="Reposter"
      >
        {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat2 className="w-4 h-4" />}
        <span>Repost</span>
        {count > 0 && <span className="tabular-nums text-xs opacity-80">{count.toLocaleString()}</span>}
      </button>
    );
  }
  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      data-active={active ? "true" : "false"}
      className={`track-icon-button relative grid place-items-center w-12 h-12 rounded-full transition-all hover:scale-110 active:scale-95 disabled:opacity-60 ${
        active ? "text-[var(--accent-emerald)]" : ""
      }`}
      aria-label="Reposter"
      title={active ? "Repost retiré" : "Reposter"}
    >
      {m.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Repeat2 className="w-5 h-5" />}
      {count > 0 && (
        <span className="track-repost-count absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black grid place-items-center tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
