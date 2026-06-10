export function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
