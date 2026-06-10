import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as generatedSupabase } from "./client";

export const supabase = generatedSupabase as unknown as SupabaseClient<any, "public", any>;