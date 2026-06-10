import { Play } from "lucide-react";
import { SignatureWaveform } from "@/components/SignatureWaveform";

interface WaveformProps {
  bars?: number;
  className?: string;
}

/**
 * Legacy `Waveform` — kept as a thin adapter so existing call-sites
 * (track cards, mini-player, etc.) automatically inherit the new
 * SignatureWaveform identity. One waveform, app-wide.
 */
export function Waveform({ bars, className = "" }: WaveformProps) {
  return (
    <SignatureWaveform
      size="sm"
      bars={bars}
      className={className}
      ariaLabel="Track waveform"
    />
  );
}

export function WaveformPlayer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface/60 backdrop-blur px-4 py-3 ${className}`}
    >
      <button className="grid place-items-center w-9 h-9 rounded-full bg-background/60 text-foreground border border-border shrink-0">
        <Play className="w-4 h-4 fill-current" />
      </button>
      <Waveform bars={48} className="flex-1" />
    </div>
  );
}
