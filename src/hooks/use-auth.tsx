import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    meta: { first_name?: string; last_name?: string }
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Heartbeat last_seen_at for online indicator
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const beat = () => {
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", uid).then(() => {});
    };
    beat();
    const iv = setInterval(beat, 60_000);
    const onHide = () => { if (document.visibilityState === "hidden") beat(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", beat);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", beat);
      beat();
    };
  }, [session?.user?.id]);


  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password, meta) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/discover`,
          data: meta,
        },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
