"use client";

import { useEffect, useState } from "react";

/**
 * Sticky table-of-contents sidebar for /learn.
 *
 * Posture: matches Vercel / Stripe / Linear docs — a quiet column of
 * section anchors that activates one entry at a time as the user scrolls.
 *
 *  - Visual: 11px mono labels, --text-3 at rest, --text-1 active, a
 *    1px accent bar inboard of the active label (Linear's sidebar
 *    active-state translated to a horizontal column).
 *  - Interaction: smooth-scrolls to the section on click; the URL hash
 *    updates so links are shareable / bookmarkable.
 *  - Scroll-spy: IntersectionObserver on the section headings — the
 *    section closest to the top of the viewport wins. Tracking
 *    "rootMargin: -45% 0px -45% 0px" creates a 10% band in the middle
 *    of the viewport so the active state changes when a section's title
 *    crosses the upper-middle of the screen, not the very top.
 */

export interface TocSection {
  id: string;
  label: string;
  /** Optional sub-label (rendered in --text-4 mono). */
  hint?: string;
}

export function LearnTOC({ sections }: { sections: TocSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting entry — when multiple are visible
        // the first one in document order wins (closest to scroll-top).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="On this page"
      style={{
        position: "sticky",
        top: 24,
        alignSelf: "flex-start",
        width: 200,
        flexShrink: 0,
        padding: "4px 0",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        maxHeight: "calc(100vh - 96px)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--m)",
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: "var(--text-4)",
          padding: "4px 12px 10px",
        }}
      >
        On this page
      </div>
      {sections.map((s) => {
        const isActive = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              const el = document.getElementById(s.id);
              if (!el) return;
              e.preventDefault();
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${s.id}`);
              setActive(s.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              padding: "5px 12px",
              borderLeft: `1px solid ${isActive ? "var(--accent)" : "transparent"}`,
              marginLeft: -1,
              color: isActive ? "var(--text-1)" : "var(--text-3)",
              fontSize: 12,
              lineHeight: 1.35,
              textDecoration: "none",
              transition: "color var(--dur-fast) var(--ease-out),border-color var(--dur-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-2)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)";
            }}
          >
            <span>{s.label}</span>
            {s.hint && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-4)",
                  fontFamily: "var(--m)",
                }}
              >
                {s.hint}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
