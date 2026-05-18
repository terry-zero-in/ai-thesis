"use client";

import { useEffect, useState } from "react";
import { getLatestUniverseScores, type UniverseSnapshot } from "@/lib/universe-data";
import { useFilter } from "@/hooks/filter-context";
import { UniverseTable } from "@/components/universe/UniverseTable";

export default function UniversePage() {
  const [snap, setSnap] = useState<UniverseSnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    getLatestUniverseScores().then((s) => {
      if (alive) setSnap(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!snap) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
        <span className="spinner" style={{ marginRight: 8 }} />
        Loading universe…
      </div>
    );
  }

  // Mercury pattern #7 (Pic 5 b2, Advisors): page chrome scrolls away,
  // table thead sticks to viewport top. Canvas owns the scroll context
  // (overflow: auto here); table inner wrapper hands scroll back to us.
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>
      <UniverseHeader snap={snap} />
      <UniverseTable rows={snap.rows} asOf={snap.asOf} synthetic={snap.synthetic} />
    </div>
  );
}

function UniverseHeader({ snap }: { snap: UniverseSnapshot }) {
  const { q, setQ, registerInput } = useFilter();
  return (
    <div
      style={{
        padding: "16px 20px 12px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.014em", color: "var(--text-1)" }}>
          Universe
        </h1>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          {snap.rows.length} names
          {snap.asOf ? ` · as of ${snap.asOf}` : ""}
          {snap.synthetic ? " · fixture" : ""}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <SearchInput value={q} onChange={setQ} register={registerInput} />
    </div>
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
