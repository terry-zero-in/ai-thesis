"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Email + password sign-in. Calls Supabase `signInWithPassword` which sets
 * the session cookie via the SSR client wired in `lib/supabase/server.ts`.
 *
 * On success: redirect() throws NEXT_REDIRECT which Next intercepts to
 * navigate the client to the originally-requested route (or `/`).
 *
 * On failure: returns a generic "Invalid email or password" message —
 * deliberately doesn't disclose which half is wrong (anti-enumeration).
 *
 * Closed system (Terry + Mom + Dad in v1) — no sign-up route. Operator
 * provisions accounts via Supabase admin API; users sign in with the
 * credentials they're emailed. Magic link removed S31 — sbcglobal.net
 * delivery for parents was unreliable.
 */
export async function signInAction(prev: { ok: boolean; message: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email." };
  }
  if (!password) {
    return { ok: false, message: "Enter your password." };
  }

  const sb = await getSupabaseServer();
  if (!sb) {
    return {
      ok: false,
      message: "Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY). Auth is disabled until Supabase env is configured.",
    };
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    // Generic message — never tell the attacker whether the email exists.
    return { ok: false, message: "Invalid email or password." };
  }

  // Same-origin only — never honour an external `next` URL.
  const target = next.startsWith("/") ? next : "/";
  redirect(target);
}

export async function signOut() {
  const sb = await getSupabaseServer();
  if (sb) await sb.auth.signOut();
  redirect("/login");
}
