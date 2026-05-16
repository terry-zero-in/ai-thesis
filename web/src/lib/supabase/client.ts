/**
 * Supabase browser client — single-tenant v1.
 *
 * RLS does the protection; anon key is safe to expose. Reads
 * `NEXT_PUBLIC_*` env vars at module load; returns `null` if absent so
 * pages can fall back to fixtures during local dev without a configured
 * project.
 */
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
