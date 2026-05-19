import type { ReactNode } from "react";
import { MonoMetaSpine, type SpineSegment } from "./MonoMetaSpine";

/**
 * PageHeader — the canonical page-title block used at the top of every
 * canvas surface. Lifts the old 20px h1 + MonoMetaSpine hand-rolled
 * pattern into a single primitive so all pages render the same chrome.
 *
 * /lambo posture per docs/design/lambo-review-2026-05-17.md:
 *   - Title at 28px sans, weight 600, tight letter-spacing — Linear/Vercel
 *     class page weight, not the old 20px section-heading weight that
 *     read anemic against the canvas density below it.
 *   - Optional subtitle is a quiet 12.5px --text-3 line that explains
 *     the page's posture without competing with the title.
 *   - Optional eyebrow is a small-caps mono pretitle above the title
 *     (rarely used — for "Workspace" or section-of-product framing).
 *   - Right slot stays vertically centered with the title row for
 *     actions (search input, "+ Add" drawer, filter trigger).
 *   - MonoMetaSpine sits below the title row at full 16px gap so the
 *     instrumentation reads as a separate strip, not crowded against
 *     the title.
 *   - Bottom hairline + generous padding lets the title breathe.
 *
 * Composition:
 *   {eyebrow?}                            ← 10.5px mono uppercase --text-3
 *   {title}  {subtitle?}     {action?}    ← 28px title row
 *   {meta spine?}                         ← below the title row
 *   ────────                              ← bottom hairline
 */
interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  meta?: SpineSegment[];
}

export function PageHeader({ title, subtitle, eyebrow, action, meta }: PageHeaderProps) {
  return (
    <header
      style={{
        padding: "22px 32px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        flexShrink: 0,
      }}
    >
      {eyebrow && (
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
          {eyebrow}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-.02em",
            color: "var(--text-1)",
            fontFamily: "var(--f)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <span
            style={{
              fontSize: 12.5,
              color: "var(--text-3)",
              fontFamily: "var(--m)",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
        {action && (
          <>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{action}</div>
          </>
        )}
      </div>
      {meta && meta.length > 0 && <MonoMetaSpine segments={meta} />}
    </header>
  );
}
