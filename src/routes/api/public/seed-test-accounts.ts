import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SEED_TOKEN = "vinasound-seed-2026";

type AccountSpec = {
  email: string;
  password: string;
  display_name: string;
  role?: "admin" | null;
  artist?: { name: string; slug: string; bio?: string } | null;
};

const ACCOUNTS: AccountSpec[] = [
  {
    email: "superadmin@globalsound.test",
    password: "superadmin@globalsound.test",
    display_name: "Super Admin",
    role: "admin",
  },
  {
    email: "artist.kofi@globalsound.test",
    password: "artist.kofi@globalsound.test",
    display_name: "Kofi Beats",
    artist: { name: "Kofi Beats", slug: "kofi-beats", bio: "Afrobeat producer from Accra." },
  },
  {
    email: "artist.zara@globalsound.test",
    password: "artist.zara@globalsound.test",
    display_name: "Zara Wave",
    artist: { name: "Zara Wave", slug: "zara-wave", bio: "Amapiano vocalist from Johannesburg." },
  },
  {
    email: "fan.amara@globalsound.test",
    password: "fan.amara@globalsound.test",
    display_name: "Amara",
  },
  {
    email: "fan.diallo@globalsound.test",
    password: "fan.diallo@globalsound.test",
    display_name: "Diallo",
  },
];

async function findUserByEmail(email: string) {
  // listUsers paginates — scan up to 10 pages of 200.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (!data.users.length || data.users.length < 200) return null;
  }
  return null;
}

async function processAccount(acc: AccountSpec) {
  const trace: string[] = [];
  try {
    // 1) ensure auth user
    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { display_name: acc.display_name },
    });
    if (created.error) {
      trace.push(`create-fail: ${created.error.message}`);
      const existing = await findUserByEmail(acc.email);
      if (!existing) {
        return { email: acc.email, status: "error", error: `not-found-after-create: ${created.error.message}`, trace };
      }
      userId = existing.id;
      const upd = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: acc.password,
        email_confirm: true,
        user_metadata: { display_name: acc.display_name },
      });
      if (upd.error) trace.push(`update-fail: ${upd.error.message}`);
    } else {
      userId = created.data.user?.id ?? null;
      trace.push("created");
    }
    if (!userId) return { email: acc.email, status: "error", error: "no user id", trace };

    const profile = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      display_name: acc.display_name,
    });
    if (profile.error) trace.push(`profile-fail: ${profile.error.message}`);
    else trace.push("profile-ready");

    // 2) admin role
    if (acc.role === "admin") {
      // delete then insert to avoid onConflict requirements
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      const ins = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (ins.error) trace.push(`role-fail: ${ins.error.message}`);
      else trace.push("role-admin");
    }

    // 3) artist profile
    if (acc.artist) {
      const existing = await supabaseAdmin.from("artists").select("id").eq("user_id", userId).maybeSingle();
      if (existing.data) {
        const upd = await supabaseAdmin
          .from("artists")
          .update({
            name: acc.artist.name,
            slug: acc.artist.slug,
            bio: acc.artist.bio ?? null,
            verified: true,
          })
          .eq("id", existing.data.id);
        if (upd.error) trace.push(`artist-update-fail: ${upd.error.message}`);
        else trace.push("artist-updated");
      } else {
        const ins = await supabaseAdmin.from("artists").insert({
          user_id: userId,
          name: acc.artist.name,
          slug: acc.artist.slug,
          bio: acc.artist.bio ?? null,
          verified: true,
        });
        if (ins.error) trace.push(`artist-insert-fail: ${ins.error.message}`);
        else trace.push("artist-created");
      }
    }

    return {
      email: acc.email,
      password: acc.password,
      user_id: userId,
      role: acc.role ?? "user",
      artist: acc.artist?.slug ?? null,
      status: "ok",
      trace,
    };
  } catch (e) {
    return { email: acc.email, status: "error", error: (e as Error).message, trace };
  }
}

export const Route = createFileRoute("/api/public/seed-test-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== SEED_TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        try {
          const results: any[] = [];
          for (const acc of ACCOUNTS) results.push(await processAccount(acc));
          return Response.json({ ok: true, results });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message, stack: (e as Error).stack },
            { status: 500 },
          );
        }
      },
    },
  },
});
