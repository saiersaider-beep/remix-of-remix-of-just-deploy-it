import type { LucideIcon } from "lucide-react";
import { Music2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
}

/**
 * Illustrated empty state — replaces the bare "Aucun résultat" lines that
 * make sections look broken when the DB has nothing to return.
 */
export function EmptyState({
  icon: Icon = Music2,
  title,
  description,
  ctaLabel,
  ctaTo,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-border/60",
        "bg-surface/30 backdrop-blur-sm px-6 py-12 text-center",
        className,
      )}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex flex-col items-center gap-4 max-w-sm">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/10 ring-1 ring-white/10">
          <Icon className="w-6 h-6 text-primary" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo}
            className="mt-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm px-5 py-2 hover:scale-105 transition-transform"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
