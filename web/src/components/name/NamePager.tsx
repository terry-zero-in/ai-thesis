/**
 * NamePager — prev/next navigation across the alphabetical universe.
 *
 * Renders as a thin strip above NameHeader: "← Universe" on the left,
 * "← PREV  ·  NEXT →" on the right. Wraps at edges (first ticker's prev
 * is the last; last ticker's next is the first) so the user can sweep the
 * full slate without dead-ending. Per Bucket 4 review item 12 — "fast
 * slate review."
 *
 * Order is alphabetical (matches the universe table's natural sort and
 * the fixture seed). When sort discovery surfaces later, this should
 * defer to the user's chosen Universe-table sort — for v1, alphabetical
 * is the deterministic default.
 */
"use client";

import Link from "next/link";

interface Props {
  ticker: string;
  tickers: string[];
}

export function NamePager({ ticker, tickers }: Props) {
  if (tickers.length === 0) return null;
  const idx = tickers.indexOf(ticker.toUpperCase());
  // Unknown ticker — render the Universe link only so the strip remains
  // present (consistent chrome) without faking a position.
  if (idx < 0) {
    return (
      <Strip>
        <BackLink />
        <span />
      </Strip>
    );
  }
  const prev = tickers[(idx - 1 + tickers.length) % tickers.length];
  const next = tickers[(idx + 1) % tickers.length];

  return (
    <Strip>
      <BackLink />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: "var(--text-4)", fontSize: 11, fontFamily: "var(--m)", letterSpacing: ".04em" }}>
          {idx + 1} / {tickers.length}
        </span>
        <PagerLink href={`/universe/${prev}`} label={`← ${prev}`} title={`Previous: ${prev}`} />
        <PagerLink href={`/universe/${next}`} label={`${next} →`} title={`Next: ${next}`} />
      </div>
    </Strip>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 32px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--surface)",
        flexShrink: 0,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/universe"
      className="lin-hov"
      style={{
        fontSize: 11.5,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        textDecoration: "none",
        letterSpacing: ".04em",
      }}
    >
      ← Universe
    </Link>
  );
}

function PagerLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <Link
      href={href}
      title={title}
      className="lin-hov"
      style={{
        fontSize: 11.5,
        fontFamily: "var(--m)",
        color: "var(--text-2)",
        textDecoration: "none",
        letterSpacing: ".02em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {label}
    </Link>
  );
}
