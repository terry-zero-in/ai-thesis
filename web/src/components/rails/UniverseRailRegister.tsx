"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { UniverseSnapshot } from "@/lib/universe-data";

/**
 * Registers the universe-filter rail payload (UniverseSnapshot) so
 * CtxPanel can render UniverseInsightsRail with the bar chart driven by
 * real row data. The rail KEY is already set by /universe/layout.tsx on
 * mount; this register only handles the payload side.
 *
 * Mirrors the AiqRailRegister / NameRailRegister pattern (per-page
 * payload pump with cleanup on unmount).
 */
export function UniverseRailRegister({ snap }: { snap: UniverseSnapshot }) {
  const { setPayload } = useCtxPanel();
  useEffect(() => {
    setPayload(snap);
    return () => {
      setPayload(null);
    };
  }, [setPayload, snap]);
  return null;
}
