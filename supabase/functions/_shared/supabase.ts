// Service-role Supabase client factory for edge functions.
// Service role bypasses RLS, which is correct for ingestion jobs.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";

export function serviceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function activeTickers(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("universe")
    .select("ticker")
    .eq("is_active", true)
    .order("ticker");
  if (error) throw error;
  return (data ?? []).map((r) => r.ticker as string);
}
