"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import type { DashboardTodayRailData } from "./DashboardTodayRail";

/**
 * Client wrapper rendered from the server /dashboard page. Registers the
 * rail key + serialized payload on mount so CtxPanel can render
 * <DashboardTodayRail/>. Renders nothing itself.
 *
 * Pattern shared across the 5 spec §6 per-page rails — keeps the page
 * server-rendered while pushing data through a single client-side context
 * slot.
 */
export function DashboardRailRegister({ data }: { data: DashboardTodayRailData }) {
  const { setRail, setPayload } = useCtxPanel();
  useEffect(() => {
    setRail("dashboard-today");
    setPayload(data);
    return () => {
      setPayload(null);
    };
  }, [setRail, setPayload, data]);
  return null;
}
