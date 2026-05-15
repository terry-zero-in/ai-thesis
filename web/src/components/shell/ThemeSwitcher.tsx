"use client";

import { useEffect, useRef, useState } from "react";
import { Tip } from "./Tip";
import { THEMES, DEFAULT_PALETTE } from "@/lib/theme";

export type Palette = [string, string, string, string];

const ENTRIES = Object.entries(THEMES);

/**
 * ThemeSwitcher — permanent in-app theme picker; lives in the TopBar right cluster.
 * Clicking the swatch opens a popover with the 5 design-system themes.
 *
 * Verbatim port of ThemeSwitcher from stage3-app.jsx. Mutates the parent-owned
 * palette via onPick; the parent runs applyPalette() in a useEffect.
 *
 * The popover body is split into ThemeSwitcherMenu (mounted only when open)
 * so cursor-init happens at mount time, not via a setState-in-effect.
 */
export function ThemeSwitcher({ palette, onPick }: { palette: Palette | string[]; onPick: (p: Palette) => void }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = Array.isArray(palette) && palette[0] ? palette[0] : DEFAULT_PALETTE[0];
  const theme = THEMES[current] || THEMES[DEFAULT_PALETTE[0]];

  // Outside-click closer — only attached while open.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Tip label={`Theme · ${theme.name}`}>
        <button
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setH(true)}
          onMouseLeave={() => setH(false)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Switch theme — current: ${theme.name}`}
          style={{
            padding: 5,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            background: h || open ? "rgba(255,255,255,.04)" : "transparent",
            transition: "background var(--dur-instant) var(--ease-out)",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: theme.accent[0],
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
            }}
          />
        </button>
      </Tip>
      {open && (
        <ThemeSwitcherMenu
          current={current}
          onPick={(p) => {
            onPick(p);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ThemeSwitcherMenu({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (p: Palette) => void;
  onClose: () => void;
}) {
  // Lazy initializer so the initial cursor matches the current theme — no
  // setState-in-effect needed.
  const [cursor, setCursor] = useState(() => Math.max(0, ENTRIES.findIndex(([k]) => k === current)));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(ENTRIES.length - 1, c + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const entry = ENTRIES[cursor];
        if (entry) {
          const [, t] = entry;
          onPick([t.accent[0], t.success, t.warning, t.danger]);
        }
        return;
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [cursor, onClose, onPick]);

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        minWidth: 236,
        background: "var(--elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 6,
        zIndex: 160,
        boxShadow: "0 12px 28px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.3)",
        animation: "fadeUpSm var(--dur-base) var(--ease-out) both",
      }}
    >
      <div
        style={{
          fontFamily: "var(--m)",
          fontSize: 9,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          padding: "6px 10px 4px",
        }}
      >
        Design system theme
      </div>
      {ENTRIES.map(([k, t], i) => {
        const sel = k === current;
        const cur = i === cursor;
        return (
          <button
            key={k}
            onClick={() => onPick([t.accent[0], t.success, t.warning, t.danger])}
            onMouseEnter={(e) => {
              setCursor(i);
              if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.06)";
            }}
            onMouseLeave={(e) => {
              if (!sel && !cur) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "7px 10px",
              borderRadius: 5,
              background: sel ? "var(--accent-soft)" : cur ? "rgba(255,255,255,.04)" : "transparent",
              boxShadow: sel ? "inset 2px 0 0 var(--accent-border)" : "none",
              transition: "background var(--dur-instant) var(--ease-out)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "inline-flex", gap: 3 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: t.accent[0],
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)",
                }}
              />
              <span style={{ width: 8, height: 14, borderRadius: "2px 0 0 2px", background: t.success }} />
              <span style={{ width: 8, height: 14, background: t.warning }} />
              <span style={{ width: 8, height: 14, borderRadius: "0 2px 2px 0", background: t.danger }} />
            </span>
            <span
              style={{
                fontSize: 12.5,
                color: sel ? "var(--text-1)" : "var(--text-2)",
                letterSpacing: "-.005em",
              }}
            >
              {t.name}
            </span>
            {sel && <span style={{ fontFamily: "var(--m)", fontSize: 10, color: "var(--accent)" }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
