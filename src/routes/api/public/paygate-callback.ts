import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook PayGate Global.
 * PayGate envoie un POST JSON après chaque paiement effectué.
 * On valide via l'identifiant interne, puis on applique l'effet (sub / track / wallet).
 */
export const Route = createFileRoute("/api/public/paygate-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const identifier = String(body.identifier ?? "");
        const tx_reference = String(body.tx_reference ?? "");
        const payment_reference = String(body.payment_reference ?? "");
        const amount = Number(body.amount ?? 0);
        const phone = String(body.phone_number ?? "");
        const payment_method = String(body.payment_method ?? "");

        if (!identifier || !tx_reference) {
          return new Response("Missing identifier or tx_reference", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Vérifie que l'identifiant existe (anti-spoof basique)
        const { data: row } = await supabaseAdmin
          .from("mm_payments")
          .select("id, amount_xof, provider")
          .eq("identifier", identifier)
          .maybeSingle();

        if (!row) return new Response("Unknown identifier", { status: 404 });
        if (row.provider !== "paygate") {
          return new Response("Not a PayGate payment", { status: 400 });
        }
        if (amount > 0 && amount < row.amount_xof) {
          await supabaseAdmin
            .from("mm_payments")
            .update({
              status: "rejected",
              admin_notes: `Montant insuffisant reçu: ${amount} / ${row.amount_xof}`,
            })
            .eq("id", row.id);
          return new Response("Amount mismatch", { status: 400 });
        }

        const { error } = await supabaseAdmin.rpc("mm_apply_paygate_callback", {
          _identifier: identifier,
          _tx_reference: tx_reference,
          _payment_reference: payment_reference,
          _amount: amount || row.amount_xof,
          _phone: phone,
          _payment_method: payment_method,
        });

        if (error) {
          console.error("paygate-callback apply error", error);
          return new Response("Apply failed", { status: 500 });
        }

        return Response.json({ ok: true });
      },
      GET: async () =>
        new Response("PayGate callback endpoint — POST only", { status: 200 }),
    },
  },
});
