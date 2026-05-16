/**
 * OAuth-style callback for Supabase email OTP. The email link sends the
 * user here with a `?code=<...>` query param; we exchange the code for
 * a session cookie and redirect to the originally-requested `next` route
 * (defaults to /).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const sb = await getSupabaseServer();
  if (!sb) {
    return NextResponse.redirect(new URL("/login?error=env_unset", url.origin));
  }

  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  // Only redirect within the same origin; never to an external URL.
  const target = new URL(next.startsWith("/") ? next : "/", url.origin);
  return NextResponse.redirect(target);
}
