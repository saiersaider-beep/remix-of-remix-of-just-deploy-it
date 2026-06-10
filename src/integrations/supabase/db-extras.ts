// Relaxed-typed Supabase client for tables added in pending migrations
// (announcements, banned_ips, reports, copyright_claims, bank_receipts,
//  withdrawal_requests, cms_pages, faq_items).
//
// The generated types.ts is read-only and lags one regeneration behind
// fresh migrations. Use this client only for the tables listed above.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as SupabaseClient<any, "public", any>;
