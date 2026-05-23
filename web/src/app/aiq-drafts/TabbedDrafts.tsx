"use client";

import { useState, type ReactNode } from "react";
import { MovingPillTabs } from "@/components/primitives/MovingPillTabs";

type TabKey = "pending" | "unreviewed" | "reviewed";

/**
 * TabbedDrafts — client wrapper that owns the active tab state and
 * conditionally renders one of the three server-rendered panels passed in
 * as children. Keeps data fetching on the server (page.tsx) and confines
 * the client island to the panel switch.
 */
export function TabbedDrafts({
  counts,
  pending,
  unreviewed,
  reviewed,
}: {
  counts: { pending: number; unreviewed: number; reviewed: number };
  pending: ReactNode;
  unreviewed: ReactNode;
  reviewed: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>(
    counts.pending > 0 ? "pending" : counts.unreviewed > 0 ? "unreviewed" : "pending",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "0 0 4px" }}>
        <MovingPillTabs
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          tabs={[
            { title: "Pending", value: "pending", meta: counts.pending },
            { title: "Unreviewed", value: "unreviewed", meta: counts.unreviewed },
            { title: "Reviewed", value: "reviewed", meta: counts.reviewed },
          ]}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tab === "pending" && pending}
        {tab === "unreviewed" && unreviewed}
        {tab === "reviewed" && reviewed}
      </div>
    </div>
  );
}
