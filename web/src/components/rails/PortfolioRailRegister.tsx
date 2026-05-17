"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { PortfolioReserveRailData } from "./PortfolioReserveRail";

export function PortfolioRailRegister({ data }: { data: PortfolioReserveRailData }) {
  const { setRail, setPayload } = useCtxPanel();
  useEffect(() => {
    setRail("portfolio-reserve");
    setPayload(data);
    return () => {
      setPayload(null);
    };
  }, [setRail, setPayload, data]);
  return null;
}
