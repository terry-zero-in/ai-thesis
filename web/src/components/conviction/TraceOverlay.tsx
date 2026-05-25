"use client";

import { useEffect } from "react";
import { useTrace, type TraceAttribution } from "./TraceProvider";

/**
 * TraceOverlay — the 360px right-edge panel that renders a score's causal
 * lineage. Mounted once at shell level (next to <CmdPalette />) so any
 * page can trigger it by arming a <TraceTarget> and pressing T.
 *
 * Layout (top → bottom):
 *   1. 28px header strip — TRACE eyebrow + × close button
 *   2. Hero — "<ticker> <metric>" then "<prior> → <current> (±delta, Nd)"
 *   3. Vertical tree — one row per TraceAttribution
 *   4. Source footer — DerivationStrip-style mono line
 *
 * Reduced-motion: the slide / fade collapse to instant per the global
 * @media (prefers-reduced-motion) rules already in globals.css; we rely
 * on keyframe names that the global stylesheet down-tunes.
 */

const PANEL_WIDTH = 360;
const TOP_OFFSET = 48; // matches TopBar height

const FACTOR_COL_WIDTH = 150;
const DELTA_COL_WIDTH = 60;

function fmtSignedDelta(n: number, digits = 1): string {
  if (n === 0) return "0.0";
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

function deltaColor(n: number): string {
  if (n === 0) return "var(--text-4)";
  return n > 0 ? "var(--success)" : "var(--danger)";
}

export function TraceOverlay() {
  const { isOpen, data, close } = useTrace();

  // Esc + T inside the overlay are already handled by the provider-level
  // listener (which runs at window scope). We add nothing here so the
  // shortcut behavior stays in one place.

  // Lock body scroll behind the overlay while open. The shell already
  // overflow-hides at the root, but we still suppress any nested
  // scrollers picking up wheel events through the dim scrim.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Scrim — dims the page to ~25% effective opacity (0.45 black over
          a near-black canvas reads as about a quarter brightness). Click
          to dismiss. Stops at the panel's left edge. */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: PANEL_WIDTH,
          bottom: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 199,
          animation: "fadeIn 120ms var(--ease-out) both",
        }}
      />
      <aside
        role="dialog"
        aria-label="Score provenance trace"
        style={{
          position: "fixed",
          top: TOP_OFFSET,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-8px 0 24px rgba(0,0,0,.35)",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          animation: "traceSlideIn 160ms var(--ease-out) both",
          willChange: "transform",
        }}
      >
        <TraceHeader onClose={close} />
        {data ? <TraceBody /> : <TraceEmpty />}
        {/* Inline keyframes — kept local so we don't bloat globals.css for
            a single feature. Reduced-motion users get an instant snap via
            the global @media rule that zeroes animation-duration. */}
        <style>{`
          @keyframes traceSlideIn {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        `}</style>
      </aside>
    </>
  );
}

function TraceHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        height: 28,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-3)",
        }}
      >
        TRACE
      </span>
      <button
        onClick={onClose}
        aria-label="Close trace overlay"
        style={{
          fontFamily: "var(--m)",
          fontSize: 11,
          color: "var(--text-3)",
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: "pointer",
          transition: "color var(--dur-instant) var(--ease-out)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-3)";
        }}
      >
        × close
      </button>
    </div>
  );
}

function TraceEmpty() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        textAlign: "center",
        fontFamily: "var(--m)",
        fontSize: 11,
        color: "var(--text-4)",
        letterSpacing: ".01em",
        lineHeight: 1.6,
      }}
    >
      No trace target. Hover a score and press T.
    </div>
  );
}

function TraceBody() {
  const { data } = useTrace();
  if (!data) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <TraceHero />
      <TraceTree attributions={data.attributions} />
      <TraceSourceFooter source={data.source} />
    </div>
  );
}

function TraceHero() {
  const { data } = useTrace();
  if (!data) return null;
  const { ticker, metric, current, prior, deltaTotal, windowDays } = data;
  return (
    <div style={{ padding: "16px 18px" }}>
      <div
        style={{
          fontFamily: "var(--m)",
          fontSize: 13,
          color: "var(--text-1)",
          letterSpacing: ".005em",
          marginBottom: 8,
        }}
      >
        {ticker} {metric}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 28,
            color: "var(--text-1)",
            letterSpacing: "-.01em",
            lineHeight: 1.1,
          }}
        >
          {prior.toFixed(1)}
          <span style={{ color: "var(--text-4)", margin: "0 6px" }}>→</span>
          {current.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 14,
            color: deltaColor(deltaTotal),
            letterSpacing: "-.005em",
          }}
        >
          ({fmtSignedDelta(deltaTotal)}, {windowDays}d)
        </span>
      </div>
    </div>
  );
}

function TraceTree({ attributions }: { attributions: TraceAttribution[] }) {
  if (attributions.length === 0) {
    return (
      <div
        style={{
          padding: "8px 18px 16px",
          fontFamily: "var(--m)",
          fontSize: 11,
          color: "var(--text-4)",
          fontStyle: "italic",
        }}
      >
        No factor-level changes.
      </div>
    );
  }
  return (
    <div style={{ padding: "0 0 16px" }}>
      {/* Spine — the vertical │ above the first child. Renders as a tree
          glyph in the gutter so the indentation matches the row glyphs. */}
      <div
        style={{
          padding: "0 18px",
          fontFamily: "var(--m)",
          fontSize: 12,
          color: "var(--text-4)",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        │
      </div>
      {attributions.map((a, i) => (
        <TraceTreeRow
          key={`${a.factor}-${i}`}
          attribution={a}
          last={i === attributions.length - 1}
        />
      ))}
    </div>
  );
}

function TraceTreeRow({ attribution, last }: { attribution: TraceAttribution; last: boolean }) {
  const { factor, delta, note } = attribution;
  const glyph = last ? "└─" : "├─";

  return (
    <div
      className="row-hov"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "6px 18px",
        fontFamily: "var(--m)",
        transition: "background var(--dur-instant) var(--ease-out)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--accent-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--text-4)",
          width: 20,
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          width: FACTOR_COL_WIDTH,
          flexShrink: 0,
          letterSpacing: ".005em",
        }}
      >
        {factor}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: deltaColor(delta),
          width: DELTA_COL_WIDTH,
          flexShrink: 0,
          textAlign: "right",
          letterSpacing: "-.005em",
        }}
      >
        {fmtSignedDelta(delta)}
      </span>
      {note && (
        <span
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            fontStyle: "italic",
            flex: 1,
            minWidth: 0,
            letterSpacing: ".005em",
            lineHeight: 1.45,
          }}
        >
          <span style={{ color: "var(--text-4)", fontStyle: "normal", marginRight: 4 }}>←</span>
          {note}
        </span>
      )}
    </div>
  );
}

function TraceSourceFooter({ source }: { source: string }) {
  return (
    <div
      style={{
        marginTop: "auto",
        padding: "12px 18px 14px",
        borderTop: "1px solid var(--border-subtle)",
        fontFamily: "var(--m)",
        fontSize: 10.5,
        color: "var(--text-4)",
        letterSpacing: ".01em",
        lineHeight: 1.5,
        wordBreak: "break-word",
      }}
    >
      {source}
    </div>
  );
}
