import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin as generatedSupabaseAdmin } from "./client.server";

export const supabaseAdmin = generatedSupabaseAdmin as unknown as SupabaseClient<any, "public", any>;