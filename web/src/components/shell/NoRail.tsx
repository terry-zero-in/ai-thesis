"use client";

import { useEffect } from "react";
import { useCtxPanel } from "@/hooks/ctx-panel-context";

/**
 * NoRail — declares the current page has no spec'd contextual rail content.
 *
 * Per AI Thesis Master Design Spec §6, /settings explicitly has no right rail
 * and several v1-extension routes (memos, decisions, backtest, aiq list,
 * aiq-drafts) carry no rail content spec either. Render <NoRail /> once in
 * the page body — it sets rail="none" on mount and the Shell skips the
 * CtxPanel render so main canvas extends to the right edge.
 *
 * Restores rail="agent" (default placeholder key) on unmount so navigation
 * away from a no-rail page returns to default behavior.
 */
export function NoRail() {
  const { setRail } = useCtxPanel();
  useEffect(() => {
    setRail("none");
    return () => setRail("agent");
  }, [setRail]);
  return null;
}
