// Remplace src/server.ts après migration.
// Sur Vercel + preset Nitro "vercel", TanStack Start n'a PAS besoin de
// `export default { fetch }` (format Workers). Nitro génère lui-même un
// handler Node.js compatible Vercel Serverless Functions à partir de cette
// entrée — on se contente d'exporter le handler de @tanstack/react-start.
import "./lib/error-capture";

import handler from "@tanstack/react-start/server-entry";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  try {
    const payload = JSON.parse(body) as Record<string, unknown>;
    if (payload.unhandled === true && payload.message === "HTTPError") {
      console.error(consumeLastCapturedError() ?? new Error(`SSR error: ${body}`));
      return brandedErrorResponse();
    }
  } catch {
    /* not JSON */
  }
  return response;
}

// Nitro/Vercel attendent un default export "fetch-like" (Web standard Request → Response).
// Pas de `env`/`ctx` Workers — runtime Node.js classique.
export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const response = await (handler as { fetch: (r: Request) => Promise<Response> }).fetch(request);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
