"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "./Shell";

/**
 * Wraps children in the authenticated app `Shell` except on bare-page
 * routes (login, auth callback, logout). Those routes should render
 * fullscreen without the Sidebar / TopBar / CtxPanel chrome.
 *
 * Marketing-landing case: root "/" rendered to an UNAUTHED visitor is
 * also bare — the landing page is the front door for prospective users
 * and shouldn't expose the operator chrome. Authed users at "/" still
 * get the dashboard inside Shell as before.
 */
const BARE_PREFIXES = ["/login", "/auth", "/logout"];

export function ConditionalShell({
  children,
  userEmail,
  unseenAlerts,
}: {
  children: ReactNode;
  userEmail: string | null;
  unseenAlerts: number;
}) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname.startsWith(p));
  // THS-84 landing-unauthed branch temporarily disabled per Terry 2026-05-21
  // ("hide the landing page for now"). With the gate off, / always gets the
  // Shell. To restore, uncomment the line below and add it back to the if().
  // const landingUnauthed = pathname === "/" && !userEmail;
  if (bare) return <>{children}</>;
  return (
    <Shell userEmail={userEmail} unseenAlerts={unseenAlerts}>
      {children}
    </Shell>
  );
}
