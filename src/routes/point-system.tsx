import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { AuthGate, PageHeader } from "@/components/PageScaffold";
import { PointTransactionsList } from "@/components/PointTransactionsList";
import { Award, Sparkles, Trophy } from "lucide-react";
import { getPointsSummary, convertPointsToWallet, POINTS_TO_XOF_RATIO, POINTS_TO_XOF_VALUE } from "@/lib/points.functions";

export const Route = createFileRoute("/point-system")({
  head: () => ({ meta: [{ title: "Système de points — VinaSound" }] }),
  component: () => (
    <AuthGate>
      <PointSystemPage />
    </AuthGate>
  ),
});

function rankFor(points: number) {
  if (points >= 5000) return "Légende";
  if (points >= 1000) return "Pro";
  if (points >= 250) return "Confirmé";
  return "Débutant";
}

function PointSystemPage() {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getPointsSummary);
  const convertFn = useServerFn(convertPointsToWallet);
  const { data, isLoading } = useQuery({
    queryKey: ["points-summary"],
    queryFn: () => fetchSummary(),
  });

  const points = data?.points ?? 0;
  const txs = (data?.transactions ?? []) as unknown as Parameters<typeof PointTransactionsList>[0]["transactions"];
  const creditedThisMonth = txs
    .filter((t) => t.kind?.startsWith("earn_") && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((s, t) => s + t.points, 0);

  const [convertAmount, setConvertAmount] = useState<number>(POINTS_TO_XOF_RATIO);
  const [converting, setConverting] = useState(false);
  const handleConvert = async () => {
    setConverting(true);
    try {
      const r = await convertFn({ data: { points: convertAmount } });
      toast.success(`Conversion réussie`, {
        description: `−${convertAmount} pts → +${r.creditedXof} XOF`,
      });
      qc.invalidateQueries({ queryKey: ["points-summary"] });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion impossible");
    } finally {
      setConverting(false);
    }
  };
  const xofPreview = Math.floor(convertAmount / POINTS_TO_XOF_RATIO) * POINTS_TO_XOF_VALUE;

  return (
    <main className="p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Récompenses"
        accent="Gagne"
        title="des points en écoutant"
        description="Like, commente, partage et écoute pour gagner des points convertibles en wallet."
      />
      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <Card icon={Sparkles} label="Tes points" value={isLoading ? "…" : `${points} pts`} />
        <Card icon={Award} label="Rang" value={rankFor(points)} />
        <Card icon={Trophy} label="Gagnés ce mois" value={`${creditedThisMonth} pts`} />
      </div>

      <h2 className="font-display text-xl font-extrabold uppercase mb-4">Gagner des points</h2>
      <ul className="space-y-2 text-sm text-muted-foreground bg-surface/40 border border-border rounded-md p-6 mb-10">
        <li>• Liker un morceau : <span className="text-foreground font-bold">+5 pts</span></li>
        <li>• Commenter : <span className="text-foreground font-bold">+10 pts</span></li>
        <li>• Partager / reposter : <span className="text-foreground font-bold">+20 pts</span></li>
        <li>• Écoute complète (1 / morceau / jour) : <span className="text-foreground font-bold">+10 pts</span></li>
      </ul>

      <h2 className="font-display text-xl font-extrabold uppercase mb-4">Dépenser tes points</h2>
      <ul className="space-y-2 text-sm text-muted-foreground bg-surface/40 border border-border rounded-md p-6 mb-10">
        <li>• Écouter 1 minute d'une chanson payante : <span className="text-foreground font-bold">55 pts</span></li>
        <li>• Convertir en wallet : <span className="text-foreground font-bold">{POINTS_TO_XOF_RATIO} pts = {POINTS_TO_XOF_VALUE} XOF</span></li>
      </ul>

      <h2 className="font-display text-xl font-extrabold uppercase mb-4">Convertir en wallet</h2>
      <div className="bg-surface/40 border border-border rounded-md p-6 mb-10 space-y-3">
        <div className="flex gap-3 items-center">
          <input
            type="number"
            min={POINTS_TO_XOF_RATIO}
            step={POINTS_TO_XOF_RATIO}
            max={points}
            value={convertAmount}
            onChange={(e) => setConvertAmount(Math.max(0, parseInt(e.target.value) || 0))}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm tabular-nums"
          />
          <span className="text-xs text-muted-foreground">pts → <span className="text-foreground font-bold tabular-nums">{xofPreview} XOF</span></span>
        </div>
        <button
          onClick={handleConvert}
          disabled={converting || convertAmount < POINTS_TO_XOF_RATIO || convertAmount > points || convertAmount % POINTS_TO_XOF_RATIO !== 0}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50 hover:opacity-90"
        >
          {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          Convertir
        </button>
        <p className="text-[11px] text-muted-foreground">Multiples de {POINTS_TO_XOF_RATIO} pts uniquement.</p>
      </div>

      <h2 className="font-display text-xl font-extrabold uppercase mb-4">Historique</h2>
      <PointTransactionsList transactions={txs} />
    </main>
  );
}

function Card({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return (
    <div className="bg-surface/40 border border-border rounded-md p-5">
      <Icon className="w-5 h-5 text-primary mb-2" />
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      <p className="font-display text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
