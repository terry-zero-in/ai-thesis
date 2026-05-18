"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { NameActivityRailData } from "./NameActivityRail";

/**
 * Registers /universe/[ticker] rail key + payload on mount. Renders nothing.
 * Same pattern as DashboardRailRegister — keeps the data flow uniform across
 * the 5 spec §6 per-page rails.
 */
export function NameRailRegister({ data }: { data: NameActivityRailData }) {
  const { setRail, setPayload } = useCtxPanel();
  useEffect(() => {
    setRail("name-activity");
    setPayload(data);
    return () => {
      setPayload(null);
    };
  }, [setRail, setPayload, data]);
  return null;
}
