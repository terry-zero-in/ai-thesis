import Link from "next/link";
import type { MacroLog } from "@/lib/routine-outputs";
import type { PositionRow } from "@/lib/portfolio-types";
import type { UniverseRow } from "@/lib/universe-data";
import type { AlertEvent } from "@/lib/alerts-types";

/**
 * "Today's Thesis" — Dashboard signature command-center module (THS-74).
 *
 * Renders below the greeting + EngineStatusStrip, above the KPI tiles. A
 * five-row scannable hero card that answers, in one glance:
 *
 *   - what is the macro saying
 *   - how is the book deployed
 *   - which layers/themes is the engine leaning into
 *   - what's pressing on the watchlist
 *   - what (if anything) needs operator action
 *
 * Anatomy:
 *   - Header: TODAY'S THESIS (tracked-caps label) + mono date/time RIGHT.
 *   - 5 ThesisRow rows separated by --border-subtle hairlines.
 *   - Required-action row gets accent treatment + chevron CTA → /decisions.
 *   - Card has surface fill + 6px radius like other dashboard hero
 *     primitives (TopPositions, PortfolioValueChart).
 *
 * Every row degrades gracefully to a single dim string when its data
 * source has no rows yet — no fixture invention, no placeholder text that
 * could be mistaken for real numbers.
 *
 * Inputs are pre-computed by `page.tsx` (server component) so this card
 * stays a pure rendering primitive. Server-side dynamic date/time keeps
 * the chrome alive without a client island.
 */
export interface TodayThesisCardProps {
  macro: MacroLog | null;
  /**
   * Pre-computed bias derivation. `layers` is the top-two layer labels
   * (ordered most-concentrated-first). `highestDeprecHyperscaler` is the
   * ticker of the held name with the heaviest depreciation penalty when
   * any is held; null otherwise.
   */
  bias: {
    layers: string[];
    /**
     * `true` means "no positions yet — these layers come from the universe
     * top-2 tiers, not held composite concentration." Drives the "Lean"
     * vs "Watching" verb choice so the row stays honest.
     */
    fromUniverse: boolean;
    highestDeprecHyperscaler: string | null;
  };
  posture: {
    deployedPct: number;
    reservePct: number;
    positionsCount: number;
    empty: boolean;
  };
  watchlistPressure: {
    /** Count of High-tier names not currently held. */
    notHeld: number;
    /** True when there are zero High-tier names in the universe at all. */
    noHighTier: boolean;
  };
  /**
   * Alerts snapshot reduced to the bits this card needs:
   *   - unseenCount — total unacked alerts (drives "All clear" vs CTA)
   *   - leadKind     — kind of the most recent unacked event (drives the
   *                    row text verb, e.g., "insider-cluster alerts")
   *   - leadKindCount — count of unacked alerts matching leadKind
   */
  action: {
    unseenCount: number;
    leadKind: AlertEvent["kind"] | null;
    leadKindCount: number;
  };
  /** Server-rendered NYC-time stamp e.g. "Mon May 18 · 9:34 AM CT". */
  nowLabel: string;
}

export function TodayThesisCard(props: TodayThesisCardProps) {
  return (
    <section
      aria-label="Today's thesis — engine + portfolio snapshot"
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface)",
        padding: "18px 22px 6px",
        display: "flex",
        flexDirection: "column",
        // 60% breathing-room moment per spec: the rows + header carry
        // their own internal vertical rhythm; the card itself sits with
        // 28px gap above/below from the parent page's flex gap.
      }}
    >
      <CardHeader nowLabel={props.nowLabel} />
      <div role="list">
        <ThesisRow
          label="Macro state"
          value={renderMacro(props.macro)}
          dim={props.macro == null}
        />
        <ThesisRow
          label="Portfolio posture"
          value={renderPosture(props.posture)}
          dim={props.posture.empty}
        />
        <ThesisRow
          label="Current bias"
          value={renderBias(props.bias)}
          dim={props.bias.layers.length === 0}
        />
        <ThesisRow
          label="Watchlist pressure"
          value={renderWatchlist(props.watchlistPressure)}
          dim={props.watchlistPressure.noHighTier}
        />
        <ThesisRow
          label="Required action"
          value={renderAction(props.action)}
          dim={props.action.unseenCount === 0}
          last
          accent={props.action.unseenCount > 0}
          cta={
            props.action.unseenCount > 0 && props.action.leadKind
              ? {
                  href: `/decisions?kind=${props.action.leadKind}`,
                  ariaLabel: `Review ${props.action.leadKindCount} ${actionKindLabel(props.action.leadKind)} alerts`,
                }
              : undefined
          }
        />
      </div>
    </section>
  );
}

/* ---------------- chrome ---------------- */

function CardHeader({ nowLabel }: { nowLabel: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        paddingBottom: 12,
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        Today&rsquo;s thesis
      </span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".02em",
          whiteSpace: "nowrap",
        }}
        title="NYC time — engine + market reference clock"
      >
        {nowLabel}
      </span>
    </div>
  );
}

function ThesisRow({
  label,
  value,
  dim = false,
  last = false,
  accent = false,
  cta,
}: {
  label: string;
  value: React.ReactNode;
  dim?: boolean;
  last?: boolean;
  accent?: boolean;
  cta?: { href: string; ariaLabel: string };
}) {
  const content = (
    <div
      role="listitem"
      style={{
        display: "grid",
        gridTemplateColumns: "180px minmax(0, 1fr) auto",
        columnGap: 16,
        alignItems: "baseline",
        padding: "12px 0",
        borderBottom: last ? undefined : "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontFamily: "var(--f)",
          color: "var(--text-3)",
          letterSpacing: ".01em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontFamily: "var(--f)",
          color: dim ? "var(--text-3)" : accent ? "var(--accent)" : "var(--text-1)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
      {cta ? (
        <span
          aria-hidden
          className="accent-link-chev"
          style={{
            fontSize: 13,
            fontFamily: "var(--m)",
            color: "var(--accent)",
            paddingLeft: 12,
          }}
        >
          ›
        </span>
      ) : (
        <span aria-hidden style={{ width: 12 }} />
      )}
    </div>
  );

  if (cta) {
    return (
      <Link
        href={cta.href}
        aria-label={cta.ariaLabel}
        className="row-hov"
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          margin: "0 -10px",
          padding: "0 10px",
          borderRadius: 4,
        }}
      >
        {content}
      </Link>
    );
  }
  return content;
}

/* ---------------- row renderers ---------------- */

function renderMacro(macro: MacroLog | null): React.ReactNode {
  if (!macro) return "No macro snapshot yet";
  return (
    <>
      <Num>{macro.gates_hit}</Num> of <Num>3</Num> gates hit ·{" "}
      <Num>{macro.multiplier.toFixed(2)}×</Num> applied to High-conviction
    </>
  );
}

function renderPosture(p: TodayThesisCardProps["posture"]): React.ReactNode {
  if (p.empty) return "No positions yet";
  return (
    <>
      <Num>{p.deployedPct}%</Num> deployed · <Num>{p.reservePct}%</Num> reserve ·{" "}
      <Num>{p.positionsCount}</Num> position{p.positionsCount === 1 ? "" : "s"}
    </>
  );
}

function renderBias(b: TodayThesisCardProps["bias"]): React.ReactNode {
  if (b.layers.length === 0) return "Universe not scored yet";
  const verb = b.fromUniverse ? "Watching" : "Lean";
  const layerText = b.layers.slice(0, 2).join(" + ");
  if (b.highestDeprecHyperscaler && !b.fromUniverse) {
    return (
      <>
        {verb} {layerText} · avoid highest deprec-risk hyperscaler (
        <Num>{b.highestDeprecHyperscaler}</Num>)
      </>
    );
  }
  return (
    <>
      {verb} {layerText}
    </>
  );
}

function renderWatchlist(w: TodayThesisCardProps["watchlistPressure"]): React.ReactNode {
  if (w.noHighTier) return "No High-tier names in universe yet";
  if (w.notHeld === 0) return "All High-tier names currently held";
  return (
    <>
      <Num>{w.notHeld}</Num> High-tier name{w.notHeld === 1 ? "" : "s"} not yet held
    </>
  );
}

function renderAction(a: TodayThesisCardProps["action"]): React.ReactNode {
  if (a.unseenCount === 0) return "All clear";
  if (a.leadKind && a.leadKindCount > 0) {
    return (
      <>
        Review <Num>{a.leadKindCount}</Num> {actionKindLabel(a.leadKind)} alert
        {a.leadKindCount === 1 ? "" : "s"}
      </>
    );
  }
  return (
    <>
      Review <Num>{a.unseenCount}</Num> unread alert{a.unseenCount === 1 ? "" : "s"}
    </>
  );
}

/**
 * Mono-numeric inline span. Numbers + tickers in the rows render through
 * this so the mono/sans mix lands consistently (sans prose with tabular
 * mono numerals per ticket spec).
 */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
        color: "inherit",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Human-readable verb for the row text per alert kind. Different from the
 * `ALERT_KIND_LABELS` table — those are title-case sentence fragments meant
 * for the /decisions kind sidebar. Here we want lowercased adjective form
 * that flows in prose: "Review 2 insider-cluster alerts".
 */
function actionKindLabel(kind: AlertEvent["kind"]): string {
  switch (kind) {
    case "tier_change":
      return "tier-change";
    case "conv_drop":
      return "high-conviction drop";
    case "aiq_drift":
      return "AIQ drift";
    case "macro_flip":
      return "macro-flip";
    case "insider_cluster":
      return "insider-cluster";
    case "quarterly_review":
      return "quarterly-review";
    case "thesis_broken":
      return "thesis-broken";
    default:
      return "alert";
  }
}

/* ---------------- server-side data prep ---------------- */

/**
 * Pure derivation: given universe rows + held positions, return the top-2
 * layer labels by composite-score concentration in held names. When no
 * positions are held, falls back to the top-2 layers in the universe by
 * average composite (so the row still has content pre-portfolio).
 *
 * Exported so page.tsx can call this server-side and pass the result
 * through to TodayThesisCard as part of `bias`.
 */
export function deriveBiasLayers(
  positions: PositionRow[],
  universeRows: UniverseRow[],
): { layers: string[]; fromUniverse: boolean } {
  // Phase 1 — concentration weighted by composite when positions exist.
  const held = positions.filter((p) => p.layer_label && p.composite != null);
  if (held.length > 0) {
    const byLayer = new Map<string, number>();
    for (const p of held) {
      const w = Math.max(0, p.composite ?? 0);
      byLayer.set(p.layer_label, (byLayer.get(p.layer_label) ?? 0) + w);
    }
    const top = Array.from(byLayer.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([label]) => label);
    if (top.length > 0) return { layers: top, fromUniverse: false };
  }

  // Phase 2 — fall back to the universe's top-2 layers by avg composite of
  // High-/Medium-tier names (so a pre-positions dashboard still reads as
  // intentional).
  const scored = universeRows.filter((r) => r.composite != null && (r.tier === "High" || r.tier === "Medium"));
  if (scored.length === 0) return { layers: [], fromUniverse: true };
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of scored) {
    const entry = agg.get(r.layer_label) ?? { sum: 0, n: 0 };
    entry.sum += r.composite ?? 0;
    entry.n += 1;
    agg.set(r.layer_label, entry);
  }
  const ranked = Array.from(agg.entries())
    .map(([label, { sum, n }]) => ({ label, avg: sum / Math.max(1, n) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 2)
    .map((x) => x.label);
  return { layers: ranked, fromUniverse: true };
}
