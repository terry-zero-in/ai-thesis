"use client";

import { Tip } from "./Tip";

/**
 * Single source-of-truth indicator for demo / fixture workspace state.
 * Surfaces in the TopBar when no user is signed in OR Supabase env is
 * unconfigured. Replaces inline " · fixture mode" subtitle suffixes that
 * used to be scattered across page headers (settings / memos / backtest /
 * aiq-drafts). One badge, one tooltip, one place to look.
 *
 * Per THS-83 (Data trust, S5 2026-05-18) + GPT review G2.
 */
export function DemoBadge({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <Tip
      label="Demo workspace · all prices, scores, and alerts are simulated for product preview. Sign in to use real data."
      side="bottom"
      delay={300}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginLeft: 6,
          marginRight: 6,
          padding: "2px 8px",
          borderRadius: 9999,
          background: "var(--warning-text-fill)",
          border: "1px solid var(--warning-text-border)",
          color: "var(--warning-text)",
          fontFamily: "var(--m)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          cursor: "default",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--warning)",
            animation: "pulse 2.4s var(--ease) infinite",
          }}
        />
        Demo data
      </span>
    </Tip>
  );
}
