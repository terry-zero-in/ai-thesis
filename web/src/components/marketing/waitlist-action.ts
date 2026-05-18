"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Waitlist server action — captures prospective paid-beta email.
 *
 * v1 storage: writes to `public.marketing_waitlist` if the table exists,
 * otherwise logs to server console (so a missing migration doesn't 500
 * the marketing landing). Either way the user gets a green thank-you.
 *
 * Tightened compliance language: no "subscribe", no "buy", no promise of
 * delivery date. "Notify me when paid beta opens" is the exact wording.
 */
export type WaitlistResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  _prev: WaitlistResult | null,
  formData: FormData
): Promise<WaitlistResult> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "Email required." };
  if (!EMAIL_RE.test(raw) || raw.length > 254) {
    return { ok: false, error: "Enter a valid email." };
  }

  const sb = await getSupabaseServer();
  if (!sb) {
    // Local dev or env unconfigured — still accept the email so the form
    // works end-to-end against the marketing landing.
    console.warn("[waitlist] supabase unconfigured, logging only:", raw);
    return { ok: true, email: raw };
  }

  // Best-effort insert. If the table doesn't exist yet (migration not
  // applied), don't surface a 500 to the visitor — log and accept. The
  // honesty contract here is the user is told their interest is captured;
  // the operator (Terry) tails server logs until the table lands.
  try {
    const { error } = await sb
      .from("marketing_waitlist")
      .insert({ email: raw, source: "landing-paid-beta" });
    if (error) {
      // 42P01 = relation does not exist; 23505 = unique violation (already in).
      if (error.code === "23505") return { ok: true, email: raw };
      if (error.code === "42P01") {
        console.warn("[waitlist] marketing_waitlist table missing:", raw);
        return { ok: true, email: raw };
      }
      console.error("[waitlist] insert error:", error);
      return { ok: false, error: "Could not save right now. Try again." };
    }
  } catch (e) {
    console.error("[waitlist] unexpected:", e);
    return { ok: false, error: "Could not save right now. Try again." };
  }
  return { ok: true, email: raw };
}
