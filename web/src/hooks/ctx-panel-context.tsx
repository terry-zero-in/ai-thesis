"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * CtxPanel rail keys. `filter` only renders on /routines (path-conditional in
 * CtxPanel). The page-level "open filter panel" button calls into this
 * context to open the panel AND switch the active rail to `filter` in one
 * step.
 */
export type CtxRailKey = "agent" | "todo" | "capture" | "log" | "notes" | "filter";

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
}

const Ctx = createContext<CtxPanelCtx>({
  rail: "agent",
  setRail: () => {},
  open: true,
  setOpen: () => {},
  openTo: () => {},
  toggleFilter: () => {},
});

export function CtxPanelProvider({ children }: { children: ReactNode }) {
  const [rail, setRail] = useState<CtxRailKey>("agent");
  const [open, setOpen] = useState(true);
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
    () => ({ rail, setRail, open, setOpen, openTo, toggleFilter }),
    [rail, open, openTo, toggleFilter],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCtxPanel() {
  return useContext(Ctx);
}
