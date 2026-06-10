import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db-extras";

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  level: string;
  link_url?: string | null;
  link_label?: string | null;
};

const DISMISSED_KEY = "vinasound:dismissed-announcements";

function getDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  const { data } = useQuery({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const { data, error } = await db
        .from("announcements")
        .select("id, title, body, level")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return (data ?? []) as Announcement[];
    },
    staleTime: 60_000,
  });

  const ann = data?.find((a) => !dismissed.includes(a.id));
  if (!ann) return null;

  const colors: Record<string, string> = {
    info: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30",
    success: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30",
    warning: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30",
    error: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30",
    promo: "bg-primary/15 text-primary border-primary/40",
  };

  const dismiss = () => {
    const next = [...dismissed, ann.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`border-b ${colors[ann.level] ?? colors.info} px-4 py-2.5 text-sm`}
      role="status"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-bold">{ann.title}</span>
          {ann.body && (
            <span className="ml-2 opacity-80 hidden sm:inline">{ann.body}</span>
          )}
        </div>
        {ann.link_url && (
          <a
            href={ann.link_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold underline hover:no-underline"
          >
            {ann.link_label ?? "En savoir plus"}{" "}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="opacity-70 hover:opacity-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
