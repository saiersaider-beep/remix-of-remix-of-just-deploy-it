// Patch global fetch on the client to attach the Supabase access token
// to every TanStack Start server-function request (`/_serverFn/...`).
// Without this, server functions that use `requireSupabaseAuth` reject with 401.
import { supabase } from "@/integrations/supabase/client";

let installed = false;

export function installServerFnAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch (e) {
      console.error("[server-fn-auth] failed to attach token", e);
    }
    return originalFetch(input, init);
  };
}
