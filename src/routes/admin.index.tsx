import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Mic2, Music2, Headphones, DollarSign, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, StatCard } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const counts = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("artists").select("id", { count: "exact", head: true }),
        supabase.from("tracks").select("id", { count: "exact", head: true }),
        supabase.from("track_likes").select("user_id", { count: "exact", head: true }),
        supabase.from("track_comments").select("id", { count: "exact", head: true }),
      ]);
      const [{ count: users }, { count: artists }, { count: tracks }, { count: likes }, { count: comments }] = counts;

      const { data: playsRow } = await supabase
        .from("tracks")
        .select("plays")
        .limit(10000);
      const totalPlays = (playsRow ?? []).reduce((s, r) => s + (r.plays ?? 0), 0);

      const { data: paid } = await supabase
        .from("purchases")
        .select("amount, currency, status")
        .eq("status", "successful");
      const revenue = (paid ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const currency = paid?.[0]?.currency ?? "XOF";

      return {
        users: users ?? 0,
        artists: artists ?? 0,
        tracks: tracks ?? 0,
        likes: likes ?? 0,
        comments: comments ?? 0,
        totalPlays,
        revenue,
        currency,
      };
    },
  });

  return (
    <>
      <AdminPageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de la plateforme VinaSound."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Utilisateurs"
          value={isLoading ? "…" : (data?.users ?? 0).toLocaleString()}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label="Artistes"
          value={isLoading ? "…" : (data?.artists ?? 0).toLocaleString()}
          icon={Mic2}
          accent="emerald"
        />
        <StatCard
          label="Pistes"
          value={isLoading ? "…" : (data?.tracks ?? 0).toLocaleString()}
          icon={Music2}
          accent="sky"
        />
        <StatCard
          label="Écoutes totales"
          value={isLoading ? "…" : (data?.totalPlays ?? 0).toLocaleString()}
          icon={Headphones}
          accent="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          label="Revenus encaissés"
          value={isLoading ? "…" : `${(data?.revenue ?? 0).toLocaleString()} ${data?.currency ?? "XOF"}`}
          icon={DollarSign}
          accent="primary"
          hint="Somme des achats au statut 'successful'"
        />
        <StatCard
          label="Likes"
          value={isLoading ? "…" : (data?.likes ?? 0).toLocaleString()}
          icon={Heart}
          accent="rose"
        />
        <StatCard
          label="Commentaires"
          value={isLoading ? "…" : (data?.comments ?? 0).toLocaleString()}
          icon={Headphones}
          accent="sky"
        />
      </div>
    </>
  );
}