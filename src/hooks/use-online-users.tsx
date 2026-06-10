import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { defaultAvatar } from "@/lib/default-avatar";

export type OnlineUser = {
  user_id: string;
  user_name: string;
  user_avatar: string;
  is_artist_live?: boolean;
  artist_id?: string | null;
  artist_slug?: string | null;
};

const CHANNEL = "global:online";

function anonId() {
  if (typeof window === "undefined") return `anon-${Math.random().toString(36).slice(2, 10)}`;
  let id = window.sessionStorage.getItem("gs-anon-id");
  if (!id) {
    id = `anon-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem("gs-anon-id", id);
  }
  return id;
}

/**
 * Global presence of every connected user across the site.
 * Returns a deduplicated list of currently online users.
 */
export function useOnlineUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  const me = useMemo<OnlineUser>(() => {
    if (user) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (meta.display_name as string) ||
        (meta.full_name as string) ||
        (user.email ? user.email.split("@")[0] : "Auditeur");
      const avatar = (meta.avatar_url as string) || defaultAvatar(user.id);
      return { user_id: user.id, user_name: name, user_avatar: avatar };
    }
    const aid = anonId();
    return { user_id: aid, user_name: "Auditeur", user_avatar: defaultAvatar(aid) };
  }, [user]);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: me.user_id } },
    });

    const recompute = () => {
      const state = channel.presenceState<OnlineUser>();
      const dedup = new Map<string, OnlineUser>();
      Object.values(state).forEach((arr) => {
        arr.forEach((p) => {
          if (p?.user_id && !dedup.has(p.user_id)) dedup.set(p.user_id, p);
        });
      });
      setUsers(Array.from(dedup.values()));
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(me);
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [me]);

  return users;
}
