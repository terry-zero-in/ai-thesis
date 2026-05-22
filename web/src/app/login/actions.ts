"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Sends a magic-link email via Supabase OTP. The redirect URL points back at
 * `/auth/callback?next=<preserved>` so the callback handler can hand the
 * user off to their originally-requested route.
 *
 * Returns a state object for the client to render success/error. Throws
 * `redirect()` on env-missing so the caller sees a clear message.
 */
export async function sendMagicLink(prev: { ok: boolean; message: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/");

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email." };
  }

  const sb = await getSupabaseServer();
  if (!sb) {
    return {
      ok: false,
      message: "Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY). Auth is disabled until Supabase env is configured.",
    };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const callback = `${proto}://${host}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback },
  });
  if (error) {
    return { ok: false, message: `Supabase error: ${error.message}` };
  }
  return { ok: true, message: `Magic link sent to ${email}. Check your inbox.` };
}

export async function signOut() {
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  redirect("/login");
}
