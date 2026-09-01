import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyAndApply, gpLog, gpError } from "@/lib/geniuspay.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/geniuspay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const signature = request.headers.get("X-Webhook-Signature") || "";
          const timestamp = request.headers.get("X-Webhook-Timestamp") || "";

          const { data: settings } = await supabaseAdmin
            .from("payment_settings")
            .select("site_id")
            .eq("provider", "geniuspay")
            .limit(1)
            .maybeSingle();
          const secret = settings?.site_id || "";

          if (secret) {
            if (!signature || !timestamp) {
              gpLog("webhook_rejected", { reason: "missing_signature" });
              return new Response("missing signature", { status: 401 });
            }
            if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
              gpLog("webhook_rejected", { reason: "stale_timestamp" });
              return new Response("timestamp too old", { status: 400 });
            }
            const expected = createHmac("sha256", secret)
              .update(`${timestamp}.${rawBody}`)
              .digest("hex");
            const a = Buffer.from(expected);
            const b = Buffer.from(signature);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              gpLog("webhook_rejected", { reason: "invalid_signature" });
              return new Response("invalid signature", { status: 401 });
            }
          } else {
            gpLog("webhook_unsigned", { reason: "no_webhook_secret_configured" });
          }

          const payload = JSON.parse(rawBody) as {
            event?: string;
            data?: { reference?: string; status?: string; metadata?: Record<string, unknown> };
          };
          const transaction_id = payload.data?.metadata?.["transaction_id"] as string | undefined;
          const reference = payload.data?.reference ?? null;

          gpLog("webhook_received", {
            event: payload.event,
            reference,
            transaction_id,
            payload_status: payload.data?.status,
          });

          if (!transaction_id) return new Response("missing transaction_id", { status: 400 });

          // On ne fait jamais confiance au contenu du webhook : le statut réel
          // est toujours relu auprès de l'API GeniusPay avant application.
          const result = await verifyAndApply(transaction_id);
          gpLog("webhook_processed", {
            transaction_id,
            reference,
            applied: result.success,
            kind: result.kind,
          });
          return new Response("ok");
        } catch (e) {
          gpError("webhook", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("GeniusPay webhook OK"),
    },
  },
});
