"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactElement } from "react";
import { I } from "@/components/primitives/icons";
import { Tip } from "./Tip";

interface NavItem {
  ic: ReactElement;
  label: string;
  id: string;
  href: string;
  badge?: string;
  keys: string[];
  external?: boolean;
}

const ITEMS: NavItem[] = [
  // Command center
  { ic: I.grid, label: "Dashboard",  id: "dash",      href: "/",          keys: ["G", "then", "D"] },
  { ic: I.bot,  label: "Universe",   id: "universe",  href: "/universe",  keys: ["G", "then", "U"] },
  { ic: I.log,  label: "Portfolio",  id: "portfolio", href: "/portfolio", keys: ["G", "then", "P"] },
  { ic: I.zap,  label: "Regime",     id: "regime",    href: "/regime",    keys: ["G", "then", "R"] },
  // Workspace
  { ic: I.sliders, label: "AIQ Editor", id: "aiq",       href: "/aiq",       keys: ["G", "then", "A"] },
  { ic: I.note,    label: "Memos",      id: "memos",     href: "/memos",     keys: ["G", "then", "M"] },
  { ic: I.chk,     label: "Decisions",  id: "decisions", href: "/decisions", keys: ["G", "then", "X"] },
  { ic: I.refresh, label: "Backtest",   id: "backtest",  href: "/backtest",  keys: ["G", "then", "B"] },
];

// Nav-item hover tips are deliberately terse — just the page name + keybinding.
// The long marketing-style descriptions that lived here previously rendered as
// over-wide single-line tooltips (Tip uses white-space:nowrap) — Linear/Cursor
// convention is label-only on nav items.

export function Sidebar({
  col,
  setCol,
  unseenAlerts = 0,
}: {
  col: boolean;
  setCol: (v: boolean) => void;
  unseenAlerts?: number;
}) {
  const pathname = usePathname();
  const isActive = (id: string) => {
    if (id === "dash") return pathname === "/";
    return pathname.startsWith(`/${id}`);
  };
  const items = ITEMS.map((it) =>
    it.id === "decisions" && unseenAlerts > 0 ? { ...it, badge: String(unseenAlerts) } : it,
  );

  return (
    <aside
      style={{
        width: col ? 56 : 240,
        background: "var(--sidebar)",
        borderRight: "1px solid #1A1B1E",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: "width 240ms var(--ease)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: col ? "0 6px" : "0 12px",
          justifyContent: col ? "center" : "flex-start",
          flexShrink: 0,
        }}
      >
        <Tip label="Return to dashboard" side="right">
          <Link
            href="/"
            style={{ color: "var(--accent)", display: "flex", padding: 4, borderRadius: 5, flexShrink: 0, cursor: "pointer" }}
          >
            {I.hex}
          </Link>
        </Tip>
        {!col && (
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.014em", flex: 1, whiteSpace: "nowrap" }}>
            AI Thesis
          </span>
        )}
        {!col && (
          <Tip label="Collapse sidebar" keys={["⌘", "B"]} side="bottom">
            <button className="icon-btn" onClick={() => setCol(!col)} style={{ padding: 4 }}>
              {I.sidebar}
            </button>
          </Tip>
        )}
      </div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, padding: col ? "14px 6px" : "14px 12px" }}>
        {col && (
          <Tip label="Expand sidebar" keys={["⌘", "B"]} side="right">
            <button
              onClick={() => setCol(false)}
              className="icon-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "7px 0",
                marginBottom: 4,
                color: "var(--text-3)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {I.sidebar}
            </button>
          </Tip>
        )}
        {!col && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-3)",
              padding: "0 8px",
              marginBottom: 4,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Command Center
          </div>
        )}
        {items.slice(0, 4).map((it) => (
          <SbItem key={it.id} {...it} active={isActive(it.id)} col={col} />
        ))}
        {!col && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-3)",
              padding: "10px 8px 4px",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Workspace
          </div>
        )}
        {col && <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />}
        {items.slice(4).map((it) => (
          <SbItem key={it.id} {...it} active={isActive(it.id)} col={col} />
        ))}
      </nav>
      <Tip label="Settings" side="right">
        <Link
          href="/settings"
          style={{
            padding: col ? "12px 6px" : "12px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: col ? "center" : "flex-start",
            textDecoration: "none",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              T
            </div>
            <span
              aria-hidden
              title="online"
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--success)",
                boxShadow: "0 0 0 1.5px var(--sidebar)",
                animation: "onlinePulse 2.4s var(--ease) infinite",
              }}
            />
          </div>
          {!col && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>Terry Turner</span>}
        </Link>
      </Tip>
    </aside>
  );
}

function SbItem({ ic, label, active, col, badge, href, keys, external }: NavItem & { active: boolean; col: boolean }) {
  const [hov, setHov] = useState(false);
  const Anchor = external ? "a" : Link;
  const anchorProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href };
  const btn = (
    <Anchor
      {...anchorProps}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: col ? "8px 0" : "7px 8px",
        borderRadius: 6,
        justifyContent: col ? "center" : "flex-start",
        color: active ? "var(--text-1)" : hov ? "var(--text-2)" : "var(--text-3)",
        background: active ? "var(--surface-2)" : hov ? "#141516" : "transparent",
        fontWeight: active ? 500 : 400,
        fontSize: 13,
        transition: "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out)",
        position: "relative",
        whiteSpace: "nowrap",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          display: "flex",
          flexShrink: 0,
          opacity: active ? 1 : 0.7,
          color: active ? "var(--accent)" : "inherit",
          transition: "color var(--dur-instant) var(--ease-out),opacity var(--dur-instant) var(--ease-out)",
        }}
      >
        {ic}
      </span>
      {!col && (
        <span style={{ flex: 1, opacity: col ? 0 : 1, transition: "opacity var(--dur-base) 60ms var(--ease-out)" }}>
          {label}
        </span>
      )}
      {!col && badge && (
        <Tip label={`${badge} unseen`} side="right" delay={350}>
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 10,
              color: active ? "var(--accent)" : "var(--text-3)",
              transition: "color var(--dur-instant) var(--ease-out)",
            }}
          >
            {badge}
          </span>
        </Tip>
      )}
    </Anchor>
  );
  return (
    <Tip label={label} keys={keys} side="right" delay={400}>
      {btn}
    </Tip>
  );
}
