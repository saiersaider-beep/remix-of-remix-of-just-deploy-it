import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type ThemePref = Theme | "system";

const KEY = "vinasound-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "system";
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.classList.toggle("light", t === "light");
  root.style.colorScheme = t;
  root.setAttribute("data-theme", t);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => readPref());
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined" ? "light" : (readPref() === "system" ? systemTheme() : (readPref() as Theme)),
  );

  // Apply on mount + when pref changes
  useEffect(() => {
    const resolved: Theme = pref === "system" ? systemTheme() : pref;
    setTheme(resolved);
    applyTheme(resolved);
  }, [pref]);

  // Follow OS changes when pref === "system"
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const t: Theme = mql.matches ? "dark" : "light";
      setTheme(t);
      applyTheme(t);
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [pref]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      setPref(readPref());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p);
    setPref(p);
  }, []);

  const toggle = useCallback(() => {
    const current: Theme = pref === "system" ? systemTheme() : pref;
    const next: Theme = current === "light" ? "dark" : "light";
    localStorage.setItem(KEY, next);
    setPref(next);
  }, [pref]);

  return { theme, pref, toggle, setPreference };
}
