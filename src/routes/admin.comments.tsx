import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, DataTable } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/comments")({
  component: CommentsPage,
});

type Row = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  track_id: string;
};

function CommentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_comments")
        .select("id, content, created_at, user_id, track_id")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <>
      <AdminPageHeader
        title="Commentaires"
        description={`${data?.length ?? 0} commentaires récents.`}
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <DataTable<Row>
          keyOf={(r) => r.id}
          empty="Aucun commentaire."
          columns={[
            { key: "content", label: "Contenu", render: (r) => <span className="line-clamp-2">{r.content}</span> },
            { key: "date", label: "Date", render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
          rows={data ?? []}
        />
      )}
    </>
  );
}