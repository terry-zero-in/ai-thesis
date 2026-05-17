"use client";

import { useEffect, type ReactNode } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";

/**
 * /universe layout — registers the universe-filter rail key on mount so the
 * right-side CtxPanel shows layer/tier filter chips. Restores the prior rail
 * (default `agent`) on unmount so other routes don't inherit the universe
 * surface.
 */
export default function UniverseLayout({ children }: { children: ReactNode }) {
  const { setRail } = useCtxPanel();
  useEffect(() => {
    setRail("universe-filter");
    return () => setRail("agent");
  }, [setRail]);
  return <>{children}</>;
}
