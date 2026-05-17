"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/primitives/icons";
import { useReducedMotion, staggerDelay } from "@/hooks/useReducedMotion";
import { CRUMBS, SCREEN_TO_PATH, type ScreenId } from "@/lib/screens";

/**
 * CmdPalette — ported from Reticle. Backdrop fadeIn 140ms ease-out · content
 * fadeUp 220ms spring at 40ms delay. Result items stagger in with fadeUpSm.
 * Arrow keys move selection; Enter runs; Esc closes.
 *
 * Reticle's `reviews` prop (jump-to-review item list) is dropped — AI Thesis
 * pages can register their own jump-to-record items in a follow-on by
 * passing additional `extraItems` once a real "search by ticker" surface
 * lands (likely THS-52).
 */
export function CmdPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <CmdPaletteInner onClose={onClose} />;
}

function CmdPaletteInner({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reduced = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const goScreen = (s: ScreenId) => {
    router.push(SCREEN_TO_PATH[s]);
    onClose();
  };

  const screenIds: ScreenId[] = [
    "dash",
    "universe",
    "portfolio",
    "regime",
    "aiq",
    "memos",
    "decisions",
    "settings",
  ];
  const all: { k: string; l: string; a: () => void }[] = [
    ...screenIds.map((s) => {
      const [root, leaf] = CRUMBS[s] || [s, null];
      return {
        k: "go",
        l: `Go to · ${root}${leaf ? " · " + leaf : ""}`,
        a: () => goScreen(s),
      };
    }),
  ];

  const filt = q ? all.filter((x) => x.l.toLowerCase().includes(q.toLowerCase())) : all;
  const shown = filt.slice(0, 12);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(shown.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter" && shown[sel]) {
      e.preventDefault();
      shown[sel].a();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,9,10,.7)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "modalBackdrop 140ms var(--ease-out) both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        style={{
          width: 560,
          height: "fit-content",
          maxHeight: "60vh",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 9,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,.6)",
          display: "flex",
          flexDirection: "column",
          animation: "modalContent 220ms 40ms var(--spring) both",
          willChange: "transform,opacity",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-3)", display: "flex" }}>{I.search}</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Jump to a screen…"
            style={{
              flex: 1,
              fontSize: 14,
              color: "var(--text-1)",
              letterSpacing: "-.011em",
              background: "transparent",
              border: 0,
              outline: "none",
            }}
          />
          <span className="k">esc</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {shown.length === 0 && (
            <div
              style={{
                padding: "18px 14px",
                fontSize: 12,
                color: "var(--text-3)",
                animation: "fadeIn var(--dur-fast) var(--ease-out) both",
              }}
            >
              No matches
            </div>
          )}
          {shown.map((x, i) => (
            <button
              key={i}
              onClick={x.a}
              onMouseEnter={() => setSel(i)}
              style={{
                width: "100%",
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition:
                  "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out)",
                background: i === sel ? "var(--accent-soft)" : "transparent",
                animation: `fadeUpSm var(--dur-fast) ${staggerDelay(i, reduced, 24, 10)}ms var(--ease-out) both`,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 9,
                  color: i === sel ? "var(--accent)" : "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  width: 30,
                  transition: "color var(--dur-instant) var(--ease-out)",
                }}
              >
                {x.k}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: i === sel ? "var(--text-1)" : "var(--text-2)",
                  letterSpacing: "-.005em",
                  flex: 1,
                  transition: "color var(--dur-instant) var(--ease-out)",
                }}
              >
                {x.l}
              </span>
              {i === sel && (
                <span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--text-3)", opacity: 0.7 }}>↵</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
