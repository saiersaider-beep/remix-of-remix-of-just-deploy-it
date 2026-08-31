import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyAndApply } from "@/lib/geniuspay.server";
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
              return new Response("missing signature", { status: 401 });
            }
            if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
              return new Response("timestamp too old", { status: 400 });
            }
            const expected = createHmac("sha256", secret)
              .update(`${timestamp}.${rawBody}`)
              .digest("hex");
            const a = Buffer.from(expected);
            const b = Buffer.from(signature);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              return new Response("invalid signature", { status: 401 });
            }
          }

          const payload = JSON.parse(rawBody) as {
            event?: string;
            data?: { reference?: string; metadata?: Record<string, unknown> };
          };
          const transaction_id = payload.data?.metadata?.["transaction_id"] as string | undefined;
          if (!transaction_id) return new Response("missing transaction_id", { status: 400 });

          if (payload.event === "payment.success" || payload.event === "payment.initiated") {
            await verifyAndApply(transaction_id);
          }
          return new Response("ok");
        } catch (e) {
          console.error("GeniusPay webhook error:", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("GeniusPay webhook OK"),
    },
  },
});
