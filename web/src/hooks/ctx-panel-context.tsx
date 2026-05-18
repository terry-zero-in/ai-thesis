"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * CtxPanel rail keys.
 *
 * - `none` declares "this page has no contextual rail content per spec §6";
 *   CtxPanel is hidden entirely and main canvas extends to the right edge.
 *   Use for /settings, /memos, /decisions, /backtest, /aiq, /aiq-drafts.
 * - `filter` is a generic open-the-filter-panel signal (legacy from Reticle's
 *   /routines); kept so the toggle helper still compiles.
 * - `universe-filter` is the AI Thesis universe-table filter rail (THS-52).
 * - `dashboard-today` / `name-activity` / `portfolio-reserve` / `regime-legend`
 *   / `aiq-history` are the per-page rails per Master Design Spec §6.
 *
 * Per-page rails register themselves via `setRail(...)` (+ `setPayload(...)` for
 * data-driven ones) on mount and CtxPanel branches on the active key to render
 * the matching surface. There is no central registry; each surface knows its
 * own key.
 *
 * Payload is intentionally typed as `unknown` here — CtxPanel casts to the
 * per-rail type at the branch level, keeping the context generic.
 */
export type CtxRailKey =
  | "none"
  | "agent"
  | "todo"
  | "capture"
  | "log"
  | "notes"
  | "filter"
  | "universe-filter"
  | "dashboard-today"
  | "name-activity"
  | "portfolio-reserve"
  | "regime-legend"
  | "aiq-history";

interface CtxPanelCtx {
  rail: CtxRailKey;
  setRail: (k: CtxRailKey) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  /** Open the panel and switch to a specific rail in one call. */
  openTo: (k: CtxRailKey) => void;
  /**
   * Toggle the filter rail with entry-state memory.
   * - If panel was closed when filter was opened → toggling off closes the panel.
   * - If panel was open on another rail → toggling off restores that prior rail.
   */
  toggleFilter: () => void;
  /** Per-page rail data (server-fetched, passed via the page's <RailRegister/>). */
  payload: unknown;
  setPayload: (p: unknown) => void;
}

const Ctx = createContext<CtxPanelCtx>({
  rail: "agent",
  setRail: () => {},
  open: true,
  setOpen: () => {},
  openTo: () => {},
  toggleFilter: () => {},
  payload: null,
  setPayload: () => {},
});

export function CtxPanelProvider({ children }: { children: ReactNode }) {
  const [rail, setRail] = useState<CtxRailKey>("agent");
  // Default rail-open is true on wide monitors (≥1600px) where the rail
  // sits as a flex sibling with room to spare, and false on narrower
  // viewports where the rail floats as an overlay (see .ctx-panel-aside
  // in globals.css). The narrow default avoids a first-impression hit
  // where the rail covers the right side of the canvas table on page
  // load — operator opens it explicitly via ⌘\ or the filter button.
  // SSR-safe: starts true, useEffect corrects on mount when window is
  // available so authenticated server renders don't flicker.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1599px)").matches) {
      setOpen(false);
    }
  }, []);
  const [payload, setPayload] = useState<unknown>(null);
  const [filterEntry, setFilterEntry] = useState<{ wasOpen: boolean; priorRail: CtxRailKey } | null>(null);
  const openTo = useCallback((k: CtxRailKey) => {
    setOpen(true);
    setRail(k);
  }, []);
  const toggleFilter = useCallback(() => {
    const filterActive = open && rail === "filter";
    if (filterActive) {
      if (filterEntry && filterEntry.wasOpen) {
        setRail(filterEntry.priorRail);
      } else {
        setOpen(false);
      }
      setFilterEntry(null);
    } else {
      setFilterEntry({ wasOpen: open, priorRail: rail });
      setOpen(true);
      setRail("filter");
    }
  }, [open, rail, filterEntry]);
  const value = useMemo<CtxPanelCtx>(
    () => ({ rail, setRail, open, setOpen, openTo, toggleFilter, payload, setPayload }),
    [rail, open, openTo, toggleFilter, payload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCtxPanel() {
  return useContext(Ctx);
}
