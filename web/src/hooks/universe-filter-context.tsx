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
 *
 * Spec §5.2 filter set: Layer chips, Tier chips, AIQ-min slider, FLAGS
 * (Depr / Burry / Macro). Layer/Tier/AIQ/Macro are wired; Depr and Burry
 * remain ghost-toggles until depreciation_flags ingestion lands (THS-46).
 */
export type UniverseFlag = "depr" | "burry" | "macro";

interface UniverseFilterCtx {
  layers: Set<number>;
  tiers: Set<Tier>;
  /** AIQ floor 0..100. null = no floor. */
  aiqMin: number | null;
  /** Active flag-filters. "macro" is wired; "depr"/"burry" are ghosts. */
  flags: Set<UniverseFlag>;
  toggleLayer: (l: number) => void;
  toggleTier: (t: Tier) => void;
  setAiqMin: (v: number | null) => void;
  toggleFlag: (f: UniverseFlag) => void;
  clear: () => void;
}

const Ctx = createContext<UniverseFilterCtx>({
  layers: new Set(),
  tiers: new Set(),
  aiqMin: null,
  flags: new Set(),
  toggleLayer: () => {},
  toggleTier: () => {},
  setAiqMin: () => {},
  toggleFlag: () => {},
  clear: () => {},
});

export function UniverseFilterProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<Set<number>>(new Set());
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [aiqMin, setAiqMin] = useState<number | null>(null);
  const [flags, setFlags] = useState<Set<UniverseFlag>>(new Set());
  const value = useMemo<UniverseFilterCtx>(
    () => ({
      layers,
      tiers,
      aiqMin,
      flags,
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
      setAiqMin,
      toggleFlag: (f) =>
        setFlags((prev) => {
          const next = new Set(prev);
          if (next.has(f)) next.delete(f);
          else next.add(f);
          return next;
        }),
      clear: () => {
        setLayers(new Set());
        setTiers(new Set());
        setAiqMin(null);
        setFlags(new Set());
      },
    }),
    [layers, tiers, aiqMin, flags],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUniverseFilter() {
  return useContext(Ctx);
}
