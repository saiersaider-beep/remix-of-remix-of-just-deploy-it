import { BadgeCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ArtistBadge({
  verified,
  pro,
  size = "sm",
  className,
}: {
  verified?: boolean | null;
  pro?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!verified && !pro) return null;
  const px = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  const ic = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {verified && (
        <span className={cn("inline-flex items-center gap-1 rounded-full bg-sky-500/15 text-sky-400 font-bold", px)}>
          <BadgeCheck className={cn(ic, "fill-sky-500/30")} /> Verified
        </span>
      )}
      {pro && (
        <span className={cn("inline-flex items-center gap-1 rounded-full bg-blue-600 text-white font-bold", px)}>
          <Star className={cn(ic, "fill-white")} /> PRO
        </span>
      )}
    </span>
  );
}
