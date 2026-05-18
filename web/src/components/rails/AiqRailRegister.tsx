"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { AiqHistoryRailData } from "./AiqHistoryRail";

export function AiqRailRegister({ data }: { data: AiqHistoryRailData }) {
  const { setRail, setPayload } = useCtxPanel();
  useEffect(() => {
    setRail("aiq-history");
    setPayload(data);
    return () => {
      setPayload(null);
    };
  }, [setRail, setPayload, data]);
  return null;
}
