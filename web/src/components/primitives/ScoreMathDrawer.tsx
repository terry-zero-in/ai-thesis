"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Tip } from "@/components/shell/Tip";
import { deriveFinalScore, type ScoreMathRow } from "@/lib/score-math";

/**
 * Score Math Drawer — THS-73 sub-pattern #2.
 *
 * Side-anchored panel that derives any ticker's headline score in one
 * expansion. Each derivation row is click-to-drill: Q/G/V/AIQ → the
 * factor's home page or AIQ editor; Macro Multiplier → /regime.
 *
 * Layout (spec format):
 *
 *   Raw Tier-A Composite     78.0
 *     Q Quality              85
 *     G Growth               92
 *     V Valuation            55     (← already includes depreciation penalty)
 *     AIQ (manual)           84
 *   Concentration Tax        −3.0
 *   Depreciation Penalty     0.0  (not flagged)
 *   ─────────────────────────────
 *   Macro Multiplier         0.95×   (1 of 3 gates hit)
 *   ─────────────────────────────
 *   Final Score              74.1
 *   Tier                     Medium
 *
 * Math reconciles ±0.1 — the engine's stored final_score and the locally
 * derived (composite + tax) × multiplier should match within rounding.
 * When they don't, a small "engine: X" annotation surfaces under Final so
 * the operator can see the mismatch instead of being lied to.
 */

interface DrawerProps {
  row: ScoreMathRow;
  /** Click-trigger that opens the drawer (button text/icon). */
  trigger: ReactNode;
  /** Optional aria-label for the trigger. */
  ariaLabel?: string;
}

export function ScoreMathDrawer({ row, trigger, ariaLabel }: DrawerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // ESC + outside-click close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (drawerRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? `Open score math for ${row.ticker}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
        }}
        className="score-math-trigger"
      >
        {trigger}
      </button>
      {open && (
        <>
          {/* Soft scrim — single click closes via outside-click handler above. */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.32)",
              zIndex: 90,
              animation: "fadeUp var(--dur-fast) var(--ease-out) both",
            }}
            aria-hidden
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-label={`Score math derivation for ${row.ticker}`}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 380,
              maxWidth: "calc(100vw - 24px)",
              background: "var(--canvas)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-16px 0 32px -12px rgba(0,0,0,.6)",
              padding: "18px 18px 24px",
              overflowY: "auto",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              animation: "fadeUp var(--dur-base, 180ms) var(--ease-out) both",
              fontFamily: "var(--m)",
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <DrawerBody row={row} onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- drawer body ---------------- */

function DrawerBody({ row, onClose }: { row: ScoreMathRow; onClose: () => void }) {
  const derived = deriveFinalScore(row);
  const reconciles =
    row.finalScore == null || derived == null
      ? null
      : Math.abs(row.finalScore - derived) <= 0.1;

  return (
    <>
      <Header row={row} onClose={onClose} />

      <Section>
        <Row
          label="Raw Tier-A Composite"
          value={row.composite}
          source={
            row.asOf
              ? `scores_history · ${row.asOf}`
              : "scores_history · no row yet"
          }
          bold
        />
        <FactorChild
          label="Q"
          name="Quality"
          value={row.q}
          href="/universe"
          source={`scores_history.q_score · ${row.asOf ?? "—"}`}
        />
        <FactorChild
          label="G"
          name="Growth"
          value={row.g}
          href="/universe"
          source={`scores_history.g_score · ${row.asOf ?? "—"}`}
        />
        <FactorChild
          label="V"
          name="Valuation"
          value={row.v}
          href="/universe"
          source={`scores_history.v_score · ${row.asOf ?? "—"}${
            row.depreciationPenalty != null && row.depreciationPenalty !== 0
              ? ` · includes ${row.depreciationPenalty.toFixed(1)} depreciation penalty`
              : ""
          }`}
        />
        <FactorChild
          label="AIQ"
          name="(manual)"
          value={row.aiq}
          href={`/aiq/${row.ticker}`}
          source={`aiq_rubric · open editor to revise`}
        />
      </Section>

      <Section>
        <Row
          label="Concentration Tax"
          value={row.concentrationTax}
          signed
          source={
            row.concentrationAsOf
              ? `concentration_history · ${row.concentrationAsOf}`
              : "concentration_history · no row yet · 0.0 default"
          }
        />
        <Row
          label="Depreciation Penalty"
          value={row.depreciationPenalty}
          signed
          annotation={
            row.depreciationFlagged
              ? "(already inside V — informational)"
              : "(not flagged)"
          }
          source={
            row.depreciationFlaggedAt
              ? `depreciation_flags · ${row.depreciationFlaggedAt} · penalty_v is subtracted inside compute_v_score`
              : "depreciation_flags · no row · V score carries no penalty"
          }
        />
      </Section>

      <Divider />

      <Section>
        <Link
          href="/regime"
          onClick={onClose}
          className="score-math-row-link"
          style={rowLinkStyle()}
        >
          <Tip
            label={`macro_gauges · ${row.macroGatesHit} of 3 gates hit · multiplier applies only to composites ≥ 75`}
            side="left"
          >
            <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "var(--text-1)" }}>Macro Multiplier</span>
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {row.macroGatesHit} of 3 gates hit · open Regime ›
              </span>
            </span>
          </Tip>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              color: row.macroMultiplier < 1 ? "var(--warning)" : "var(--text-1)",
              fontWeight: 600,
              textAlign: "right",
            }}
          >
            {row.macroMultiplier.toFixed(2)}×
          </span>
        </Link>
      </Section>

      <Divider />

      <Section>
        <Row
          label="Final Score"
          value={row.finalScore}
          highlight
          source={
            derived != null
              ? `derived: ${derived.toFixed(2)}${
                  row.composite != null
                    ? ` = (${row.composite.toFixed(1)} + ${row.concentrationTax.toFixed(1)})`
                    : ""
                }${
                  row.composite != null && row.composite + row.concentrationTax >= 75
                    ? ` × ${row.macroMultiplier.toFixed(2)}`
                    : ""
                }`
              : "scores_history.final_score · awaiting engine run"
          }
        />
        {reconciles === false && (
          <div
            style={{
              fontSize: 10.5,
              color: "var(--warning)",
              fontFamily: "var(--m)",
              padding: "4px 0",
            }}
          >
            ⚠ engine value diverges from local derivation by{" "}
            {row.finalScore != null && derived != null
              ? Math.abs(row.finalScore - derived).toFixed(2)
              : "—"}{" "}
            — open the engine logs.
          </div>
        )}
        <TierRow tier={row.tier} finalScore={row.finalScore} />
      </Section>

      <Footer row={row} />
    </>
  );
}

/* ---------------- chrome ---------------- */

function Header({ row, onClose }: { row: ScoreMathRow; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        paddingBottom: 12,
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>{row.ticker}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{row.layerLabel}</span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10,
          color: "var(--text-4)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        Score Math
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close score math drawer"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-3)",
          cursor: "pointer",
          padding: "0 4px",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Footer({ row }: { row: ScoreMathRow }) {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 10,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 10.5,
        color: "var(--text-4)",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span>engine v1.0 · Tier-A Composite</span>
      <span aria-hidden>·</span>
      <span>as_of {row.asOf ?? "—"}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: "var(--text-4)" }}>research output · not advice</span>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "2px 0" }} />;
}

interface RowProps {
  label: string;
  value: number | null;
  signed?: boolean;
  annotation?: string;
  source?: string;
  bold?: boolean;
  highlight?: boolean;
}

function Row({ label, value, signed, annotation, source, bold, highlight }: RowProps) {
  const text =
    value == null
      ? "—"
      : signed
        ? `${value > 0 ? "+" : ""}${value.toFixed(1)}`
        : value.toFixed(1);
  const valueColor =
    value == null
      ? "var(--text-4)"
      : highlight
        ? "var(--accent)"
        : signed && value !== 0
          ? value < 0
            ? "var(--warning)"
            : "var(--success)"
          : "var(--text-1)";
  const inner = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "baseline",
        padding: highlight ? "10px 12px" : "5px 0",
        background: highlight ? "var(--accent-soft)" : undefined,
        border: highlight ? "1px solid var(--accent-border)" : undefined,
        borderRadius: highlight ? 4 : undefined,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ color: highlight || bold ? "var(--text-1)" : "var(--text-2)", fontWeight: bold || highlight ? 600 : 400 }}>
          {label}
        </span>
        {annotation && (
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{annotation}</span>
        )}
        {source && (
          <span style={{ fontSize: 10, color: "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
            {source}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: highlight ? 18 : 13,
          color: valueColor,
          fontWeight: highlight || bold ? 600 : 500,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {text}
      </span>
    </div>
  );
  return source ? <Tip label={source} side="left">{inner}</Tip> : inner;
}

interface FactorChildProps {
  label: string;
  name: string;
  value: number | null;
  href: string;
  source: string;
}

function FactorChild({ label, name, value, href, source }: FactorChildProps) {
  return (
    <Tip label={source} side="left">
      <Link
        href={href}
        className="score-math-row-link"
        style={{
          ...rowLinkStyle(),
          padding: "4px 0 4px 18px",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{label}</span>
          <span style={{ color: "var(--text-3)", fontSize: 11 }}>{name}</span>
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            color: value == null ? "var(--text-4)" : "var(--text-1)",
            textAlign: "right",
          }}
        >
          {value == null ? "—" : value.toFixed(1)}
        </span>
      </Link>
    </Tip>
  );
}

function TierRow({
  tier,
  finalScore,
}: {
  tier: "High" | "Medium" | "Low" | "Avoid" | null;
  finalScore: number | null;
}) {
  const cutpoint =
    tier === "High" ? "≥ 75" :
    tier === "Medium" ? "60 – 74" :
    tier === "Low" ? "45 – 59" :
    tier === "Avoid" ? "< 45" : "—";
  const color =
    tier === "High" ? "var(--success)" :
    tier === "Medium" ? "var(--text-1)" :
    tier === "Low" ? "var(--warning)" :
    tier === "Avoid" ? "var(--danger)" : "var(--text-4)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "baseline",
        padding: "5px 0",
      }}
    >
      <span style={{ color: "var(--text-3)" }}>
        Tier <span style={{ color: "var(--text-4)", fontSize: 10.5, marginLeft: 6 }}>cutpoint {cutpoint}</span>
      </span>
      <span style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {tier ?? (finalScore == null ? "—" : "?")}
      </span>
    </div>
  );
}

/* ---------------- styles ---------------- */

function rowLinkStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "baseline",
    padding: "5px 0",
    color: "inherit",
    textDecoration: "none",
    borderRadius: 3,
  };
}
