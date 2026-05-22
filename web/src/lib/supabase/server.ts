/**
 * Supabase server client for App Router server components / route handlers.
 *
 * Single-tenant v1 — anon role + RLS. Returns `null` when env is unset so
 * pages render empty state during local dev when env is unset.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component — Next disallows writes here. Safe to ignore.
        }
      },
    },
  });
}
