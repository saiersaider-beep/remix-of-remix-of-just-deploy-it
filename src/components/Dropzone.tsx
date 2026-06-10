import { useRef, useState, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";

type Props = {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children?: ReactNode;
  hint?: string;
};

export function Dropzone({ accept, multiple, onFiles, className = "", children, hint }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : [files[0]]);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all ${
        over ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-surface/30 hover:border-primary/60"
      } ${className}`}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {children ?? (
        <div className="text-center px-6 py-10">
          <UploadCloud className="w-10 h-10 text-primary mx-auto" />
          <p className="font-bold mt-3">Drag & drop, or click to choose</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
      )}
    </div>
  );
}
