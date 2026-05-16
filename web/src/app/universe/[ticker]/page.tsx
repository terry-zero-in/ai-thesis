"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getNameDetail, type NameDetail } from "@/lib/name-detail-data";
import { NameHeader } from "@/components/name/NameHeader";
import { FactorPanels } from "@/components/name/FactorPanels";
import { Sparkline } from "@/components/name/Sparkline";
import { DepFlagsList } from "@/components/name/DepFlagsList";
import { DataPendingCard } from "@/components/name/DataPendingCard";

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
      <NameHeader d={d} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        <FactorPanels d={d} />
        <Sparkline history={d.history} />
        <DepFlagsList flags={d.dep_flags} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <DataPendingCard
            title="Insider Form 4"
            ticket="THS-58"
            note="Latest insider transactions land here once Form 4 ingestion ships. Source: SEC EDGAR Form 4 feed, weekly cadence."
          />
          <DataPendingCard
            title="Recent news"
            ticket="THS-59"
            note="Headlines + sentiment land here once news ingestion ships. Source TBD — likely a Polygon/FMP news endpoint."
          />
          <DataPendingCard
            title="Sentiment timeline"
            ticket="THS-60"
            note="Stubbed per ticket spec. Will plot news-derived sentiment over the same 12-week window as the score sparkline."
          />
        </div>
      </div>
    </div>
  );
}
