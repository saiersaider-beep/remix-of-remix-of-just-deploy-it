import { awardInteractionPoints } from "@/lib/points.functions";
import { toast } from "sonner";

/**
 * Fire-and-forget point award for a track interaction.
 * Shows a small toast when points were actually credited (idempotent server-side).
 */
export function awardPointsForInteraction(
  trackId: string,
  kind: "like" | "comment" | "repost",
) {
  // Call directly (TanStack generates an RPC stub for the client bundle)
  awardInteractionPoints({ data: { trackId, kind } })
    .then((r) => {
      if (r?.awarded && r.awarded > 0) {
        toast.success(`+${r.awarded} points`, { duration: 1800 });
      }
    })
    .catch(() => {
      /* silent — interaction itself already succeeded */
    });
}
