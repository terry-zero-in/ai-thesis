"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Tier } from "@/lib/universe-data";

/**
 * Shared filter state for the /universe surface. Lifted to the shell so the
 * filter chip rail (which renders in the right `CtxPanel`) and the table
 * itself (which renders in the canvas) reference the same source of truth.
 *
 * Page-scoped — no other route reads it. Lives at the shell level only because
 * the right rail is rendered by the shell, not by /universe's page tree.
 */
interface UniverseFilterCtx {
  layers: Set<number>;
  tiers: Set<Tier>;
  toggleLayer: (l: number) => void;
  toggleTier: (t: Tier) => void;
  clear: () => void;
  // Stats published by the table so the rail footer can show "N / total names".
  totalRows: number;
  visibleRows: number;
  asOf: string | null;
  synthetic: boolean;
  setMeta: (meta: { totalRows: number; visibleRows: number; asOf: string | null; synthetic: boolean }) => void;
}

const Ctx = createContext<UniverseFilterCtx>({
  layers: new Set(),
  tiers: new Set(),
  toggleLayer: () => {},
  toggleTier: () => {},
  clear: () => {},
  totalRows: 0,
  visibleRows: 0,
  asOf: null,
  synthetic: false,
  setMeta: () => {},
});

export function UniverseFilterProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<Set<number>>(new Set());
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [meta, setMeta] = useState({ totalRows: 0, visibleRows: 0, asOf: null as string | null, synthetic: false });
  const value = useMemo<UniverseFilterCtx>(
    () => ({
      layers,
      tiers,
      toggleLayer: (l) =>
        setLayers((prev) => {
          const next = new Set(prev);
          if (next.has(l)) next.delete(l);
          else next.add(l);
          return next;
        }),
      toggleTier: (t) =>
        setTiers((prev) => {
          const next = new Set(prev);
          if (next.has(t)) next.delete(t);
          else next.add(t);
          return next;
        }),
      clear: () => {
        setLayers(new Set());
        setTiers(new Set());
      },
      totalRows: meta.totalRows,
      visibleRows: meta.visibleRows,
      asOf: meta.asOf,
      synthetic: meta.synthetic,
      setMeta,
    }),
    [layers, tiers, meta],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUniverseFilter() {
  return useContext(Ctx);
}
