"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * PageCreateDrawer — the canonical "create" affordance for any page that has a
 * primary "add a new X" action (Portfolio → add position, Decisions → add
 * decision, Memos → add memo, AIQ Drafts → add draft, etc.).
 *
 * Posture (per /lambo signature-pattern rules):
 *   - Trigger pill lives in the page-header upper-right (NOT global nav).
 *     Always-visible discoverable affordance; + glyph rotates 45° to × on open.
 *   - Expanded body is an absolute-positioned overlay anchored to the
 *     trigger, dropping DOWN-LEFT under the trigger. Does NOT push the
 *     canvas — table reflow on every toggle would be hostile.
 *   - 1px hairline border + restrained drop-shadow against --surface.
 *   - Close affordances: Escape, click-outside, the × glyph, and any
 *     children-supplied close() (typically called by the form on success).
 *   - Open shortcut: ⌘/Ctrl + shortcutKey (e.g. ⌘N) — Linear convention.
 *
 * Render-prop children pattern lets the form receive close() so the drawer
 * can self-dismiss after a successful submit. Plain ReactNode children also
 * work for non-form bodies.
 *
 * NOT a modal: this is the inline create drawer. Modals are reserved for
 * destructive confirms / multi-step flows. Add-row workflows stay inline.
 *
 * NOT a sheet: drawer is anchored to the trigger, scoped to the page header.
 * Sheets are page-edge full-height surfaces. Different shape, different use.
 *
 * Reusable across surfaces — the drawer doesn't know what's inside it.
 * Width default 460px fits a single-column form comfortably; bump for
 * wider/denser bodies via the `width` prop.
 */
interface PageCreateDrawerProps {
  /** Visible pill label, e.g. "+ Add position" (the leading "+" is fine). */
  label: string;
  /** Single letter (e.g. "n"); produces ⌘<KEY> open/toggle shortcut. */
  shortcutKey?: string;
  /** Force-open on mount (e.g. ?edit=<ticker> deep-links). */
  defaultOpen?: boolean;
  /** Overlay width in px. Default 460. */
  width?: number;
  /** Body — function form receives close() for self-dismissal on submit. */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
}

export function PageCreateDrawer({
  label,
  shortcutKey,
  defaultOpen = false,
  width = 460,
  children,
}: PageCreateDrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Keyboard: Escape closes when open; ⌘/Ctrl+shortcutKey toggles regardless.
  // The shortcut intentionally toggles (not just opens) so the same press
  // both opens AND dismisses — matches Linear's `c` / `⌘K` posture.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (
        shortcutKey &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === shortcutKey.toLowerCase()
      ) {
        // Don't hijack if the user is typing inside an input/textarea/select
        // outside the drawer (e.g. a name in a separate page form).
        const target = e.target as HTMLElement | null;
        if (target && !rootRef.current?.contains(target)) {
          const tag = target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        }
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, shortcutKey]);

  // Click-outside closes. setTimeout(0) avoids closing on the same click that
  // just opened the drawer (the open click bubbles through this listener).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = window.setTimeout(() => window.addEventListener("mousedown", handler), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", handler);
    };
  }, [open]);

  // Strip a leading "+ " from the label for the drawer header (the panel itself
  // doesn't need the affordance glyph that the trigger pill uses).
  const headerText = label.replace(/^\+\s*/, "");

  return (
    <Fragment>
      {/* #14 — Backdrop scrim: dims canvas when drawer is open, click closes */}
      {open && (
        <div
          aria-hidden
          onMouseDown={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.22)",
            zIndex: 59,
            // Brief fade-in for polish; no fade-out because the element
            // unmounts immediately on close (no lingering ghost). `fadeIn`
            // is defined in globals.css (line 210) — shared across surfaces.
            animation: "fadeIn 120ms ease-out both",
          }}
        />
      )}

      <div
        ref={rootRef}
        style={{
          position: "relative",
          display: "inline-flex",
          // Lift the pill + drawer panel above the scrim when open.
          zIndex: open ? 60 : "auto",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          style={{
            height: 26,
            padding: "0 12px",
            fontSize: 12,
            fontFamily: "var(--m)",
            color: open ? "var(--text-1)" : "var(--text-2)",
            background: open ? "var(--surface-hover, rgba(255,255,255,.04))" : "transparent",
            border: "1px solid var(--border)",
            borderRadius: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: ".01em",
            transition:
              "background var(--dur-instant, 80ms) var(--ease-out, ease-out), color var(--dur-instant, 80ms) var(--ease-out, ease-out)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
          {/* #15 — Plus glyph rotates 45° (becomes ×) when open */}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              transform: open ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform var(--dur-fast, 140ms) var(--ease-out, ease-out)",
              fontSize: 9,
              opacity: 0.7,
              lineHeight: 1,
            }}
          >
            +
          </span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={headerText}
            className="page-create-drawer"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width,
              maxWidth: "calc(100vw - 32px)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 10px 32px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.30)",
              zIndex: 60,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--m)",
                  fontWeight: 500,
                  color: "var(--text-3)",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {headerText}
                {shortcutKey && (
                  <span
                    style={{
                      marginLeft: 10,
                      color: "var(--text-4)",
                      fontSize: 10,
                      letterSpacing: ".04em",
                    }}
                    aria-hidden
                  >
                    ⌘{shortcutKey.toUpperCase()}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 16,
                  color: "var(--text-3)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "14px 16px", maxHeight: "70vh", overflowY: "auto" }}>
              {typeof children === "function" ? children({ close }) : children}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}
