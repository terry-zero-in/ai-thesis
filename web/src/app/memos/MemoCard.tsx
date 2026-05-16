"use client";

import { useState } from "react";
import type { MemoRow } from "@/lib/memos-data";

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
          Memo failed to generate. {memo.error ?? "No error message recorded."}
        </div>
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
      {expanded && memo.body && (
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
      )}
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
