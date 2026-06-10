import { useState } from "react";
import { Lock, Loader2, ShoppingBag, X, ShieldCheck, Headphones, Wallet, Sparkles, ArrowRightLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePlayerStore } from "@/stores/player";
import { formatPrice } from "@/lib/player";
import { adminGrantTrackAccess } from "@/lib/purchase.functions";
import { initCinetPayPayment } from "@/lib/cinetpay.functions";
import { getWalletSummary } from "@/lib/wallet.functions";
import {
  getPointsSummary,
  buyMinutePass,
  convertPointsToWallet,
  buyTrackWithWallet,
  MINUTE_PASS_COST,
  POINTS_TO_XOF_RATIO,
  POINTS_TO_XOF_VALUE,
} from "@/lib/points.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";

export function PaywallModal() {
  const track = usePlayerStore((s) => s.paywallTrack);
  const close = usePlayerStore((s) => s.closePaywall);
  const setAccess = usePlayerStore((s) => s.setAccess);
  const setMinutePass = usePlayerStore((s) => s.setMinutePass);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const seek = usePlayerStore((s) => s.seek);

  const qc = useQueryClient();
  const payFn = useServerFn(initCinetPayPayment);
  const adminFn = useServerFn(adminGrantTrackAccess);
  const minuteFn = useServerFn(buyMinutePass);
  const convertFn = useServerFn(convertPointsToWallet);
  const walletBuyFn = useServerFn(buyTrackWithWallet);
  const fetchPts = useServerFn(getPointsSummary);
  const fetchWallet = useServerFn(getWalletSummary);

  const { isAdmin } = useIsAdmin();
  const [busy, setBusy] = useState<null | "buy" | "minute" | "wallet" | "convert" | "admin">(null);

  const pts = useQuery({ queryKey: ["points-summary"], queryFn: () => fetchPts(), enabled: !!track });
  const wallet = useQuery({ queryKey: ["wallet-summary"], queryFn: () => fetchWallet(), enabled: !!track });

  if (!track) return null;
  const price = track.price_amount ?? 0;
  const currency = track.price_currency || "XOF";
  const ptsBal = pts.data?.points ?? 0;
  const walletBal = wallet.data?.balance_xof ?? 0;

  const canMinute = ptsBal >= MINUTE_PASS_COST;
  const canWallet = walletBal >= price;
  // Points required to cover the track price via conversion
  const ptsNeededForPrice = Math.ceil(price / POINTS_TO_XOF_VALUE) * POINTS_TO_XOF_RATIO;
  const canConvertAndBuy = ptsBal >= ptsNeededForPrice;

  const handleCinetpay = async () => {
    setBusy("buy");
    try {
      const res = await payFn({
        data: { purpose: "track", target_id: track.id, origin: window.location.origin },
      });
      if (!res.payment_url) throw new Error("Lien de paiement indisponible");
      window.location.href = res.payment_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement impossible");
      setBusy(null);
    }
  };

  const handleMinute = async () => {
    setBusy("minute");
    try {
      const r = await minuteFn({ data: { trackId: track.id } });
      toast.success("1 minute débloquée", {
        description: `−${r.pointsUsed} pts • solde : ${r.newBalance} pts`,
      });
      qc.invalidateQueries({ queryKey: ["points-summary"] });
      // Mark access so player allows up to 60s
      setMinutePass(track.id, 60);
      close();
      seek(0);
      setPlaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  };

  const handleWalletBuy = async () => {
    setBusy("wallet");
    try {
      const r = await walletBuyFn({ data: { trackId: track.id } });
      toast.success("Chanson achetée", {
        description: `−${r.amountXof} XOF • wallet : ${r.newBalanceXof} XOF`,
      });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      setAccess(track.id, true);
      close();
      seek(0);
      setPlaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Achat impossible");
    } finally {
      setBusy(null);
    }
  };

  const handleConvertAndBuy = async () => {
    setBusy("convert");
    try {
      await convertFn({ data: { points: ptsNeededForPrice } });
      const r = await walletBuyFn({ data: { trackId: track.id } });
      toast.success("Points convertis et chanson achetée", {
        description: `−${ptsNeededForPrice} pts → ${r.amountXof} XOF`,
      });
      qc.invalidateQueries({ queryKey: ["points-summary"] });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      setAccess(track.id, true);
      close();
      seek(0);
      setPlaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full hover:bg-surface text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="grid place-items-center w-11 h-11 rounded-full bg-primary/15 text-primary">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-primary">Aperçu terminé</p>
            <h2 className="font-display text-xl font-extrabold leading-tight">Choisis ton mode</h2>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/40 p-4 flex items-center gap-3 mb-4">
          {track.cover_url ? (
            <img src={track.cover_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-amber-500 to-primary" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
          </div>
          <span className="font-display text-lg font-extrabold tabular-nums">{formatPrice(price, currency)}</span>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 text-primary px-3 py-2 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="tabular-nums">{pts.isLoading ? "…" : ptsBal}</span> pts
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 text-emerald-500 px-3 py-2 font-bold">
            <Wallet className="w-3.5 h-3.5" />
            <span className="tabular-nums">{wallet.isLoading ? "…" : walletBal}</span> XOF
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Option 1: buy via wallet */}
          <ChoiceButton
            icon={Wallet}
            label={`Acheter avec mon wallet (${formatPrice(price, currency)})`}
            sub={canWallet ? "Accès complet immédiat" : `Solde insuffisant — il manque ${price - walletBal} XOF`}
            onClick={handleWalletBuy}
            disabled={!canWallet || busy !== null}
            loading={busy === "wallet"}
          />

          {/* Option 2: buy via CinetPay */}
          <ChoiceButton
            icon={ShoppingBag}
            label={`Acheter via CinetPay (${formatPrice(price, currency)})`}
            sub="Mobile Money, carte bancaire"
            onClick={handleCinetpay}
            disabled={busy !== null}
            loading={busy === "buy"}
            primary
          />

          {/* Option 3: minute pass via points */}
          <ChoiceButton
            icon={Headphones}
            label={`Écouter 1 minute (${MINUTE_PASS_COST} pts)`}
            sub={canMinute ? "Une minute supplémentaire" : `Il te manque ${MINUTE_PASS_COST - ptsBal} points`}
            onClick={handleMinute}
            disabled={!canMinute || busy !== null}
            loading={busy === "minute"}
          />

          {/* Option 4: convert points → wallet and buy */}
          <ChoiceButton
            icon={ArrowRightLeft}
            label={`Convertir ${ptsNeededForPrice} pts → ${formatPrice(price, currency)} et acheter`}
            sub={
              canConvertAndBuy
                ? `Taux : ${POINTS_TO_XOF_RATIO} pts = ${POINTS_TO_XOF_VALUE} XOF`
                : `Il te manque ${ptsNeededForPrice - ptsBal} points`
            }
            onClick={handleConvertAndBuy}
            disabled={!canConvertAndBuy || busy !== null}
            loading={busy === "convert"}
          />

          {isAdmin && (
            <button
              onClick={async () => {
                setBusy("admin");
                try {
                  await adminFn({ data: { trackId: track.id } });
                  toast.success("Accès accordé (admin)");
                  setAccess(track.id, true);
                  close();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Échec");
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="mt-1 inline-flex items-center justify-center gap-2 border border-border bg-surface/50 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-60 hover:bg-surface"
            >
              {busy === "admin" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Débloquer (admin, sans paiement)
            </button>
          )}

          <button onClick={close} className="text-xs text-muted-foreground hover:text-foreground py-1">
            Plus tard
          </button>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground text-center">
          Gagne plus de points : like (+5), commentaire (+10), partage (+20), écoute complète (+10).
        </p>
      </div>
    </div>
  );
}

function ChoiceButton({
  icon: Icon,
  label,
  sub,
  onClick,
  disabled,
  loading,
  primary,
}: {
  icon: typeof Wallet;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition disabled:opacity-50 ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border bg-surface/40 hover:bg-surface"
      }`}
    >
      <div
        className={`grid place-items-center w-9 h-9 rounded-full shrink-0 ${
          primary ? "bg-primary-foreground/15" : "bg-primary/15 text-primary"
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{label}</p>
        <p className={`text-[11px] leading-tight ${primary ? "opacity-80" : "text-muted-foreground"}`}>{sub}</p>
      </div>
    </button>
  );
}
