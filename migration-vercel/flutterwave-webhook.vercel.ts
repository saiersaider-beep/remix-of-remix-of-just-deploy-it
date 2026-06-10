// Remplace src/routes/api/public/flutterwave-webhook.ts après migration.
// Compatible Vercel Node.js runtime — aucune adaptation Workers.
// IMPORTANT : sur Vercel, après déploiement, mettre à jour l'URL du webhook
// dans le dashboard Flutterwave :
//   https://<your-app>.vercel.app/api/public/flutterwave-webhook
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLAN_DURATIONS: Record<string, number | null> = {
  "pro-month": 30,
  "pro-year": 365,
  "pro-life": null,
};

type FlwData = {
  id: number | string;
  tx_ref: string;
  status: string;
  amount: number;
  currency: string;
  meta?: {
    plan_id?: string;
    user_id?: string;
    track_id?: string;
    kind?: string;
    amount_xof?: number;
  };
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Vérification signature Flutterwave (header "verif-hash")
        const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
        const got = request.headers.get("verif-hash");
        if (!expected || !got || !timingSafeEqual(expected, got)) {
          return new Response("Invalid signature", { status: 401 });
        }

        // 2. Lecture body (Vercel Node supporte Web standard Request.text())
        const bodyText = await request.text();
        let payload: { event?: string; data?: FlwData };
        try {
          payload = JSON.parse(bodyText);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const data = payload.data;
        const flwTxId = data?.id ? String(data.id) : null;

        // 3. Idempotence
        if (flwTxId) {
          const { data: existing } = await supabaseAdmin
            .from("payment_events")
            .select("id, processed")
            .eq("flw_tx_id", flwTxId)
            .eq("processed", true)
            .maybeSingle();
          if (existing) return new Response("ok");
        }

        // 4. Persist raw event
        const { error: insertEvtErr } = await supabaseAdmin.from("payment_events").insert({
          provider: "flutterwave",
          event_type: payload.event ?? "unknown",
          flw_tx_ref: data?.tx_ref ?? null,
          flw_tx_id: flwTxId,
          payload: JSON.parse(bodyText),
          signature: got,
        });
        if (insertEvtErr && (insertEvtErr as { code?: string }).code === "23505") {
          return new Response("ok");
        }

        if (!data?.id || !data?.tx_ref) return new Response("ok");

        // 5. Vérification serveur-à-serveur auprès de Flutterwave
        const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        if (!secretKey) {
          console.error("Missing FLUTTERWAVE_SECRET_KEY");
          return new Response("Server misconfigured", { status: 500 });
        }
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${data.id}/verify`,
          { headers: { Authorization: `Bearer ${secretKey}` } },
        );
        if (!verifyRes.ok) {
          return new Response("Verification failed", { status: 502 });
        }
        const verify = (await verifyRes.json()) as {
          status: string;
          data?: { status?: string; amount?: number; currency?: string; tx_ref?: string };
        };
        if (verify.status !== "success" || verify.data?.status !== "successful") {
          return new Response("Tx not successful", { status: 200 });
        }

        // 6. Application métier (subscription / purchase / topup)
        const meta = data.meta ?? {};
        const userId = meta.user_id;
        if (!userId) return new Response("ok");

        if (meta.kind === "subscription" && meta.plan_id) {
          const days = PLAN_DURATIONS[meta.plan_id];
          const expiresAt =
            days === null
              ? null
              : new Date(Date.now() + (days ?? 30) * 86_400_000).toISOString();
          await supabaseAdmin
            .from("subscriptions")
            .upsert({
              user_id: userId,
              plan_id: meta.plan_id,
              status: "active",
              expires_at: expiresAt,
              provider: "flutterwave",
              tx_ref: data.tx_ref,
            });
        } else if (meta.kind === "purchase" && meta.track_id) {
          await supabaseAdmin.from("purchases").insert({
            user_id: userId,
            track_id: meta.track_id,
            status: "succeeded",
            provider: "flutterwave",
            amount: data.amount,
            currency: data.currency,
            paid_at: new Date().toISOString(),
          });
        } else if (meta.kind === "topup" && meta.amount_xof) {
          await supabaseAdmin.rpc("wallet_apply_settled", {
            _user_id: userId,
            _amount: meta.amount_xof,
            _ref: data.tx_ref,
          });
        }

        // 7. Marquer event traité
        if (flwTxId) {
          await supabaseAdmin
            .from("payment_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("flw_tx_id", flwTxId);
        }

        return new Response("ok");
      },
    },
  },
});
