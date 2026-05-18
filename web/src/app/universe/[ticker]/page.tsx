"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getNameDetail, type NameDetail } from "@/lib/name-detail-data";
import { NameHeader } from "@/components/name/NameHeader";
import { FactorPanels } from "@/components/name/FactorPanels";
import { DepFlagsList } from "@/components/name/DepFlagsList";
import { DataPendingCard } from "@/components/name/DataPendingCard";
import { Form4Section } from "@/components/name/Form4Section";
import { NameRailRegister } from "@/components/rails/NameRailRegister";
import type { NameActivityEvent, NameActivityRailData } from "@/components/rails/NameActivityRail";

interface Params {
  ticker: string;
}

export default function NameDetailPage({ params }: { params: Promise<Params> }) {
  const { ticker } = use(params);
  const [d, setD] = useState<NameDetail | null>(null);
  useEffect(() => {
    let alive = true;
    getNameDetail(ticker).then((x) => {
      if (alive) setD(x);
    });
    return () => {
      alive = false;
    };
  }, [ticker]);

  // Derive rail activity events from the 12-wk history + dep flags. Sorted
  // most-recent first; capped at 6 to keep the rail glanceable.
  const railData: NameActivityRailData | null = useMemo(() => {
    if (!d || !d.found) return null;
    const events: NameActivityEvent[] = [];
    // wk/wk composite deltas, oldest→newest, render newest first.
    for (let i = 1; i < d.history.length; i++) {
      const prev = d.history[i - 1].composite;
      const curr = d.history[i].composite;
      if (prev == null || curr == null) continue;
      const delta = Math.round((curr - prev) * 10) / 10;
      if (delta === 0) continue;
      events.push({
        date: d.history[i].as_of,
        kind: "score",
        label: `Composite ${prev.toFixed(1)} → ${curr.toFixed(1)}`,
        delta,
      });
    }
    for (const f of d.dep_flags) {
      events.push({
        date: f.flagged_at,
        kind: "depflag",
        label:
          f.extension_years != null
            ? `Depreciation life extended ${f.extension_years.toFixed(1)}y · V penalty ${f.penalty_v ?? 0}`
            : "Depreciation flag raised",
        delta: f.penalty_v,
      });
    }
    events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return {
      ticker: d.ticker,
      events: events.slice(0, 6),
      asOf: d.as_of,
      synthetic: d.synthetic,
    };
  }, [d]);

  if (!d) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
        <span className="spinner" style={{ marginRight: 8 }} />
        Loading {ticker.toUpperCase()}…
      </div>
    );
  }

  if (!d.found) {
    return (
      <div style={{ flex: 1, padding: 32, color: "var(--text-2)" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>{ticker.toUpperCase()} not found</h1>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>
          That ticker isn&rsquo;t in the active universe.{" "}
          <Link href="/universe" style={{ color: "var(--accent)" }}>
            Back to Universe
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {railData && <NameRailRegister data={railData} />}
      <NameHeader d={d} />
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        <FactorPanels d={d} />
        <DepFlagsList flags={d.dep_flags} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
          <Form4Section rows={d.form4_recent} isFirst />
          <DataPendingCard title="Recent news" note="Headlines + sentiment will surface here once a news source is wired." />
          <DataPendingCard title="Sentiment timeline" note="Will plot news-derived sentiment over the same 12-week window as the score sparkline." />
        </div>
      </div>
    </div>
  );
}
