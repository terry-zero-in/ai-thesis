"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { type Tier, type UniverseSnapshot } from "@/lib/universe-data";
import type { EngineStatus } from "@/lib/engine-status";
import { useFilter } from "@/hooks/filter-context";
import { useUniverseFilter } from "@/hooks/universe-filter-context";
import { UniverseTable } from "@/components/universe/UniverseTable";
import { PageHeader } from "@/components/primitives/PageHeader";
import { EngineStatusStrip } from "@/components/primitives/EngineStatusStrip";
import { LiveStubbedStrip } from "@/components/primitives/LiveStubbedStrip";
import { UniverseRailRegister } from "@/components/rails/UniverseRailRegister";

/**
 * Client wrapper for the /universe surface. Server page fetches the snapshot
 * via `getLatestUniverseScoresServer()` and passes it down so first paint
 * shows the table — no center-of-screen loading spinner flash.
 *
 * Per [[feedback_server_fetch_no_loading_state]] — server-fetched data
 * needs no spinner; this wrapper only owns the bits that genuinely require
 * a client boundary (search input bound to filter-context, table sort/filter
 * state, rail register effect).
 */
export function UniverseClient({
  snap,
  engineStatus,
  initialTier,
}: {
  snap: UniverseSnapshot;
  engineStatus: EngineStatus;
  initialTier?: Tier | null;
}) {
  // Seed the universe filter from a URL ?tier= param exactly once on mount.
  // Dashboard KPI tiles deep-link to /universe?tier=High; without this the
  // table would render unfiltered and the link would be a lie (THS-101 #2).
  // Guarded by a ref so a re-render (e.g. user toggling the same chip off)
  // doesn't re-arm the filter and trap the user.
  const { tiers, toggleTier } = useUniverseFilter();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (initialTier && !tiers.has(initialTier)) {
      toggleTier(initialTier);
    }
    seeded.current = true;
    // tiers / toggleTier intentionally omitted — this is a one-shot seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTier]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        overscrollBehavior: "contain",
        minWidth: 0,
      }}
    >
      <UniverseRailRegister snap={snap} />
      <UniverseHeader snap={snap} />
      <EngineStatusStrip status={engineStatus} />
      <LiveStubbedStrip />
      <UniverseTable
        rows={snap.rows}
        asOf={snap.asOf}
        synthetic={snap.synthetic}
        queuedTickers={snap.queuedTickers}
      />
    </div>
  );
}

function UniverseHeader({ snap }: { snap: UniverseSnapshot }) {
  const { q, setQ, registerInput } = useFilter();
  const sample = snap.rows.find((r) => r.macro_gates_hit != null);
  return (
    <PageHeader
      title="Universe"
      action={<SearchInput value={q} onChange={setQ} register={registerInput} />}
      meta={[
        { label: "scored", value: snap.rows.length },
        { label: "as_of", value: snap.asOf ?? "—" },
        { label: "engine", value: "composite v1.0" },
        {
          label: "mode",
          value: (
            <span
              style={{
                color: snap.synthetic ? "var(--warning)" : "var(--success)",
                fontWeight: 600,
                letterSpacing: ".02em",
              }}
              title={
                snap.synthetic
                  ? "Sample data — universe scored against a pre-generated dataset for product preview."
                  : "Live data — universe scored against your account's latest weekly engine run."
              }
            >
              {snap.synthetic ? "Sample" : "Live"}
            </span>
          ),
        },
        {
          label: "macro",
          value: sample ? (
            <Link
              href="/regime"
              title="Open Regime page — full macro multiplier curve, gauges, and history"
              style={{
                color: "var(--text-2)",
                textDecoration: "none",
                borderBottom: "1px dotted var(--text-4)",
                paddingBottom: 1,
              }}
            >
              {sample.macro_multiplier.toFixed(2)}× ({sample.macro_gates_hit}/3)
            </Link>
          ) : "—",
        },
      ]}
    />
  );
}

function SearchInput({
  value,
  onChange,
  register,
}: {
  value: string;
  onChange: (v: string) => void;
  register: (el: HTMLInputElement | null) => void;
}) {
  return (
    <input
      ref={register}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter by ticker or name…"
      style={{
        height: 30,
        width: 260,
        padding: "0 10px",
        fontSize: 12.5,
        color: "var(--text-1)",
        background: "rgba(255,255,255,.03)",
        border: "1px solid var(--border)",
        borderRadius: 5,
        fontFamily: "var(--f)",
        outline: "none",
      }}
    />
  );
}
