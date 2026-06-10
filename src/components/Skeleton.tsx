/**
 * Reusable skeleton primitives. They use the design-system surface tokens
 * and a shimmer overlay so loaders feel premium instead of "stuck".
 *
 * Usage:
 *   {isLoading ? <TrackCardSkeleton count={5} /> : <RealTrackGrid .../>}
 */
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-foreground/[0.06] ring-1 ring-foreground/[0.04]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.08] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function TrackCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function TrackGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <TrackCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ArtistAvatarSkeleton() {
  return (
    <div className="space-y-3 text-center">
      <Skeleton className="aspect-square w-full rounded-full" />
      <Skeleton className="h-3 w-2/3 mx-auto" />
    </div>
  );
}

export function ArtistGridSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ArtistAvatarSkeleton key={i} />
      ))}
    </div>
  );
}

export function RowSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}
