import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminGuard } from "@/lib/geniuspay.server";

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "moderator" | "user" | "super_admin";
  status: "active" | "pending" | "banned";
  createdAt: string;
  lastSignInAt: string | null;
  isArtist: boolean;
};

/** Admin : liste des utilisateurs avec statut, rôle et date d'inscription. */
export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        role: z.enum(["all", "admin", "moderator", "user"]).default("all"),
        status: z.enum(["all", "active", "pending", "banned"]).default("all"),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.userId);

    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: data.limit,
    });
    if (authErr) throw new Error(authErr.message);
    const users = authList?.users ?? [];
    const ids = users.map((u) => u.id);

    const [profRes, roleRes, artistRes] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
      ids.length
        ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      ids.length
        ? supabaseAdmin.from("artists").select("user_id").in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

    const profiles = new Map((profRes.data ?? []).map((p) => [p.id, p]));
    const artists = new Set((artistRes.data ?? []).map((a) => a.user_id));
    const rank: Record<string, number> = { super_admin: 4, admin: 3, moderator: 2, user: 1 };
    const roles = new Map<string, AdminUserRow["role"]>();
    for (const r of roleRes.data ?? []) {
      const current = roles.get(r.user_id);
      if (!current || (rank[r.role] ?? 0) > (rank[current] ?? 0)) {
        roles.set(r.user_id, r.role as AdminUserRow["role"]);
      }
    }

    const rows: AdminUserRow[] = users.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const banned = !!(u as unknown as { banned_until?: string | null }).banned_until;
      const prof = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        name:
          prof?.display_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
          (u.email ? u.email.split("@")[0]! : "Sans nom"),
        avatarUrl: prof?.avatar_url ?? null,
        role: roles.get(u.id) ?? "user",
        status: banned ? "banned" : u.email_confirmed_at ? "active" : "pending",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isArtist: artists.has(u.id),
      };
    });

    const filtered = rows
      .filter((r) => data.role === "all" || r.role === data.role || (data.role === "admin" && r.role === "super_admin"))
      .filter((r) => data.status === "all" || r.status === data.status)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return { users: filtered, total: rows.length };
  });
