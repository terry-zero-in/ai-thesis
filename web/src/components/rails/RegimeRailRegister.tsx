"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { RegimeLegendRailData } from "./RegimeLegendRail";

export function RegimeRailRegister({ data }: { data: RegimeLegendRailData }) {
  const { setRail, setPayload } = useCtxPanel();
  useEffect(() => {
    setRail("regime-legend");
    setPayload(data);
    return () => {
      setPayload(null);
    };
  }, [setRail, setPayload, data]);
  return null;
}
