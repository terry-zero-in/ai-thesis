/**
 * Next 16 proxy (formerly `middleware`) — runs on every navigation to:
 *   1. Refresh the Supabase session cookie via `@supabase/ssr`'s server client
 *   2. Redirect unauthenticated users to `/login?next=<path>`
 *
 * Per Supabase SSR docs, this pattern mitigates the "two concurrent expired
 * sessions try to refresh in parallel and one fails" race because the proxy
 * refreshes once per navigation before any page renders.
 *
 * The matcher excludes static assets and the auth routes themselves
 * (`/login`, `/auth/callback`, `/logout`) so unauthenticated users can
 * reach them.
 *
 * When env vars are unset (dev without Supabase configured), proxy is a
 * no-op so pages keep rendering.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/logout", "/_next", "/favicon", "/learn"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // No Supabase env → auth disabled. Let everything through.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() validates the token with the auth server; do not
  // rely on getSession() here (cookie-only, spoofable per Supabase docs).
  const { data: { user } } = await supabase.auth.getUser();

  // Public routes always pass; gate everything else.
  // Marketing-landing carve-out (THS-84): root "/" is reachable by an
  // unauthenticated visitor — page.tsx renders MarketingLanding when
  // there is no session. Authed users at "/" still flow through to the
  // dashboard render in the same file, so this carve-out does not
  // weaken protection of the operator surfaces.
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isMarketingRoot = pathname === "/";
  if (!user && !isPublic && !isMarketingRoot) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Already authenticated? Bounce off /login back to the app.
  if (user && pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Run on all paths except Next internals + static assets. Auth-specific
  // routes are handled by the PUBLIC_PREFIXES check inside the function.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
