import { useQuery } from "@tanstack/react-query";
import { Sparkles, Heart, Flame } from "lucide-react";
import { getMyFanTier } from "@/lib/track-reposts";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  artistId: string;
  className?: string;
}

const TIER_CONFIG = {
  super: {
    label: "Super Fan",
    icon: Flame,
    className:
      "bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-white shadow-[0_0_20px_-4px_rgba(251,146,60,0.6)]",
  },
  true: {
    label: "Vrai Fan",
    icon: Sparkles,
    className:
      "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_0_18px_-6px_rgba(168,85,247,0.6)]",
  },
  new: {
    label: "Nouveau Fan",
    icon: Heart,
    className: "bg-white/[0.08] text-pink-300 border border-pink-400/30",
  },
} as const;

export function FanBadge({ artistId, className = "" }: Props) {
  const { user } = useAuth();
  const { data: tier } = useQuery({
    queryKey: ["my-fan-tier", artistId, user?.id],
    queryFn: () => getMyFanTier(artistId),
    enabled: !!user && !!artistId,
    staleTime: 60_000,
  });
  if (!tier || tier === "none") return null;
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] ${cfg.className} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
