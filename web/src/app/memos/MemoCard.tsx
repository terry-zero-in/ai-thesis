"use client";

import { useState } from "react";
import type { MemoAction, MemoRow, WeeklyMemoParsed } from "@/lib/memos-data";

const ACTION_COLORS: Record<MemoAction, string> = {
  add: "var(--success)",
  hold: "var(--text-2)",
  trim: "var(--warning)",
  exit: "var(--danger)",
};

const KIND_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

export function MemoCard({ memo }: { memo: MemoRow }) {
  const [expanded, setExpanded] = useState(false);

  if (memo.failed) {
    return (
      <div
        style={{
          border: "1px solid rgba(251, 113, 133, .35)",
          background: "rgba(251, 113, 133, .04)",
          borderRadius: 6,
          padding: "12px 16px",
        }}
      >
        <Meta memo={memo} />
        <div style={{ fontSize: 13, color: "var(--text-1)", marginTop: 6 }}>
          This memo couldn&apos;t be generated. Operator notified.
        </div>
        {/* Raw error stays in memos.error in the DB for operator-only inspection.
            Not surfaced to the user — earlier leaks exposed ANTHROPIC_API_KEY
            verbatim in failure messages (THS-101 item 4). */}
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface-1)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 16px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: "var(--text-1)",
        }}
      >
        <Meta memo={memo} />
        {memo.headline && (
          <div
            style={{
              fontSize: 13.5,
              color: "var(--text-1)",
              marginTop: 6,
              lineHeight: 1.45,
            }}
          >
            {memo.headline}
          </div>
        )}
      </button>
      {expanded && memo.kind === "weekly" && memo.sections?.parsed ? (
        <WeeklyDetail parsed={memo.sections.parsed} />
      ) : expanded && memo.body ? (
        <pre
          style={{
            margin: 0,
            padding: "10px 16px 16px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 12.5,
            color: "var(--text-1)",
            whiteSpace: "pre-wrap",
            fontFamily: "var(--m)",
            lineHeight: 1.55,
          }}
        >
          {memo.body}
        </pre>
      ) : null}
    </div>
  );
}

function WeeklyDetail({ parsed }: { parsed: WeeklyMemoParsed }) {
  return (
    <div
      style={{
        padding: "12px 16px 16px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontSize: 12.5,
        color: "var(--text-1)",
        lineHeight: 1.55,
      }}
    >
      <p style={{ margin: 0, color: "var(--text-2)" }}>{parsed.summary}</p>

      {parsed.high_book.length > 0 && (
        <section>
          <SectionLabel>High book</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto auto 1fr",
              gap: "8px 14px",
              fontSize: 12,
            }}
          >
            <Th>Ticker</Th>
            <Th>Score</Th>
            <Th>Action</Th>
            <Th>Bear case · Rationale</Th>
            {parsed.high_book.map((h) => (
              <HighBookRow key={h.ticker} item={h} />
            ))}
          </div>
        </section>
      )}

      {parsed.cross_book_notes.length > 0 && (
        <section>
          <SectionLabel>Cross-book notes</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {parsed.cross_book_notes.map((n, i) => (
              <li key={i} style={{ color: "var(--text-2)" }}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {parsed.watch_next_week.length > 0 && (
        <section>
          <SectionLabel>Watch next week</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {parsed.watch_next_week.map((w, i) => (
              <li key={i} style={{ color: "var(--text-2)" }}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HighBookRow({ item }: { item: { ticker: string; final_score: number | null; bear_case: string; action: MemoAction; action_rationale: string } }) {
  return (
    <>
      <div style={{ fontFamily: "var(--m)", fontWeight: 600 }}>{item.ticker}</div>
      <div style={{ fontFamily: "var(--m)", color: "var(--text-2)" }}>
        {item.final_score == null ? "—" : item.final_score.toFixed(1)}
      </div>
      <div
        style={{
          fontFamily: "var(--m)",
          fontSize: 10.5,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: ACTION_COLORS[item.action],
          alignSelf: "center",
        }}
      >
        {item.action}
      </div>
      <div style={{ color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 2 }}>
        <span>{item.bear_case}</span>
        <span style={{ color: "var(--text-3)" }}>→ {item.action_rationale}</span>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--text-3)",
        fontFamily: "var(--m)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--text-3)",
        fontFamily: "var(--m)",
        borderBottom: "1px solid var(--border-subtle)",
        paddingBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Meta({ memo }: { memo: MemoRow }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontSize: 11,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        fontFamily: "var(--m)",
      }}
    >
      <span>{KIND_LABEL[memo.kind] ?? memo.kind}</span>
      <span>·</span>
      <span>{memo.as_of}</span>
      {memo.model && (
        <>
          <span>·</span>
          <span>{memo.model}</span>
        </>
      )}
    </div>
  );
}
