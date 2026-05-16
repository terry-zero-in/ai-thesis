"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "./Shell";

/**
 * Wraps children in the authenticated app `Shell` except on bare-page
 * routes (login, auth callback, logout). Those routes should render
 * fullscreen without the Sidebar / TopBar / CtxPanel chrome.
 */
const BARE_PREFIXES = ["/login", "/auth", "/logout"];

export function ConditionalShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname.startsWith(p));
  if (bare) return <>{children}</>;
  return <Shell userEmail={userEmail}>{children}</Shell>;
}
