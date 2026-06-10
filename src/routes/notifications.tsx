import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { AuthGate, PageHeader, EmptyState } from "@/components/PageScaffold";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";


export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — VinaSound" },
      { name: "description", content: "Your activity and notifications on VinaSound." },
    ],
  }),
  component: () => (
    <AuthGate>
      <NotificationsList />
    </AuthGate>
  ),
});

type Notif = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
};


function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function NotificationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id, type, message, read, created_at, actor_id, entity_type, entity_id")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setItems((data ?? []) as Notif[]);
        setLoading(false);
      });

    const channel = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as Notif, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function markAllRead() {
    if (!user) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }

  async function open(n: Notif) {
    // Mark as read
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      supabase.from("notifications").update({ read: true }).eq("id", n.id).then(() => {});
    }
    // Open conversation with the actor
    if (n.actor_id) {
      const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user_id: n.actor_id });
      if (!error && data) {
    navigate({ to: "/messages", search: { c: data as string } });
        return;
      }
    }
    navigate({ to: "/messages", search: { c: undefined } });
  }


  const unread = items.filter((i) => !i.read).length;

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        accent="Your"
        title="Notifications"
        description={unread ? `${unread} unread` : "All caught up"}
        actions={
          unread > 0 ? (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold hover:bg-surface"
            >
              <Check className="w-4 h-4" /> Mark all read
            </button>
          ) : null
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <EmptyState title="No notifications yet" hint="When fans follow you or interact with your music, you'll see it here." />
      ) : (
        <ul className="divide-y divide-border bg-surface/40 border border-border rounded-md">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-center gap-2 transition ${!n.read ? "bg-primary/5" : ""}`}
            >
              <button
                type="button"
                onClick={() => open(n)}
                className="flex flex-1 items-center gap-4 px-4 py-4 text-left hover:bg-surface/60 min-w-0"
              >
                <span className="grid place-items-center w-9 h-9 rounded-full bg-primary/15 text-primary shrink-0">
                  <Bell className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </button>
              <button
                onClick={() => remove(n.id)}
                className="text-muted-foreground hover:text-destructive pr-4"
                aria-label="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}

        </ul>
      )}
    </>
  );
}
