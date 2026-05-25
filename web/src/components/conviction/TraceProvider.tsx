"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Score Provenance Trace — feature G1 of the Lambo Pass (§S31).
 *
 * Press T anywhere a score is visible → screen dims, a 360px right panel
 * shows the score's full causal lineage (what changed, by how much, why,
 * with timestamps and sources). Press T again or Esc to dismiss.
 *
 * Industry-first claim: every analytical tool shows snapshots, none show
 * the causal delta with sources, timestamps, and audit trail in a single
 * keystroke. Cursor command palette × Linear peek pane × Bloomberg source
 * attribution.
 *
 * This module owns the shared context + global keyboard hook. Consumers
 * arm the shortcut by wrapping a score in <TraceTarget data={...}>; the
 * overlay itself lives in <TraceOverlay /> and is mounted once at shell
 * level next to <CmdPalette />.
 */

export interface TraceAttribution {
  /** Factor label as it should render: "Q quality", "G growth", "AIQ exposure", "macro multiplier". */
  factor: string;
  /** Signed factor delta over the trace window. +1.6, -0.4, 0.0. */
  delta: number;
  /** One-line provenance note: "profitability rerated (10-K filed 2026-05-21)". */
  note?: string;
}

export interface TraceData {
  ticker: string;
  /** Typically "composite", but supports "AIQ", "raw", etc. */
  metric: string;
  current: number;
  prior: number;
  /** ISO date string. */
  asOfCurrent: string;
  /** ISO date string. */
  asOfPrior: string;
  /** current - prior, pre-computed by the source so we don't drift on rounding. */
  deltaTotal: number;
  /** Trace window length in days (typically 7). */
  windowDays: number;
  attributions: TraceAttribution[];
  /** DerivationStrip-style source line: "scores_history · run 2026-05-23T16:30Z · engine v1.0". */
  source: string;
}

export interface TraceContextValue {
  isOpen: boolean;
  data: TraceData | null;
  open: (data: TraceData) => void;
  close: () => void;
  /** Used by TraceTarget to register the trace data without opening the overlay. */
  setTarget: (data: TraceData | null) => void;
}

const TraceContext = createContext<TraceContextValue | null>(null);

/**
 * Returns true if the active element is an editable surface where T
 * should be treated as literal text input rather than a shortcut.
 */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function TraceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<TraceData | null>(null);
  // Track the currently-armed target separately from the rendered data so
  // we can keep the overlay populated after the cursor leaves the score.
  const targetRef = useRef<TraceData | null>(null);

  const setTarget = useCallback((next: TraceData | null) => {
    targetRef.current = next;
  }, []);

  const open = useCallback((next: TraceData) => {
    targetRef.current = next;
    setData(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        return;
      }
      // T toggles the overlay against the armed target. Guard:
      //   1. Modifier keys (Cmd/Ctrl/Alt) are reserved for browser/OS.
      //   2. Don't fire inside editable surfaces.
      //   3. Don't fire if nothing is armed.
      if (e.key !== "t" && e.key !== "T") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      const armed = targetRef.current;
      if (!armed) return;
      e.preventDefault();
      setData(armed);
      setIsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const value = useMemo<TraceContextValue>(
    () => ({ isOpen, data, open, close, setTarget }),
    [isOpen, data, open, close, setTarget],
  );

  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>;
}

export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) {
    throw new Error("useTrace must be used inside a <TraceProvider>");
  }
  return ctx;
}
