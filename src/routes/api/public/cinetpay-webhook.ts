import { createFileRoute } from "@tanstack/react-router";
import { verifyAndApply } from "@/lib/cinetpay.server";

export const Route = createFileRoute("/api/public/cinetpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let transaction_id: string | undefined;
          const ct = request.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const body = (await request.json()) as Record<string, unknown>;
            transaction_id =
              (body.cpm_trans_id as string | undefined) ||
              (body.transaction_id as string | undefined);
          } else {
            const form = await request.formData();
            transaction_id =
              (form.get("cpm_trans_id") as string | null) ||
              (form.get("transaction_id") as string | null) ||
              undefined;
          }
          if (!transaction_id) {
            return new Response("missing transaction_id", { status: 400 });
          }
          await verifyAndApply(transaction_id);
          return new Response("ok");
        } catch (e) {
          console.error("CinetPay webhook error:", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("CinetPay webhook OK"),
    },
  },
});
