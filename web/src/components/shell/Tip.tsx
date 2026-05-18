"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { KeyChips } from "@/components/primitives/KeyChips";

/**
 * Tip — Linear-style hover hint with optional key chips.
 * Portalled to <body> with viewport-clamped positioning so it never gets clipped
 * by overflow:hidden parents (sidebar, ctx panel) or knocks into adjacent UI.
 *
 * Verbatim port of Tip from stage3-common.jsx.
 */
export interface TipProps {
  label?: string;
  keys?: string[];
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
  block?: boolean;
  style?: CSSProperties;
}

export function Tip({ label, keys, children, side = "bottom", delay = 500, style }: TipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ left: -9999, top: -9999 });
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);

  const place = () => {
    if (!triggerRef.current || !tipRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const tw = tipRef.current.offsetWidth;
    const th = tipRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const m = 8;
    let left: number, top: number;
    if (side === "top") {
      left = r.left + r.width / 2 - tw / 2;
      top = r.top - gap - th;
    } else if (side === "right") {
      left = r.right + gap;
      top = r.top + r.height / 2 - th / 2;
    } else if (side === "left") {
      left = r.left - gap - tw;
      top = r.top + r.height / 2 - th / 2;
    } else {
      left = r.left + r.width / 2 - tw / 2;
      top = r.bottom + gap;
    }
    left = Math.max(m, Math.min(vw - tw - m, left));
    top = Math.max(m, Math.min(vh - th - m, top));
    setCoords({ left, top });
  };
  useLayoutEffect(() => {
    if (show) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!label && !keys) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => {
        t.current = setTimeout(() => setShow(true), delay);
      }}
      onMouseLeave={() => {
        if (t.current) clearTimeout(t.current);
        setShow(false);
      }}
      onMouseDown={() => {
        if (t.current) clearTimeout(t.current);
        setShow(false);
      }}
    >
      {children}
      {show && typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{
              position: "fixed",
              left: coords.left,
              top: coords.top,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "4px 8px",
              borderRadius: 5,
              fontSize: 11,
              color: "var(--text-2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 300,
              boxShadow: "0 6px 18px rgba(0,0,0,.4)",
              letterSpacing: "-.005em",
              animation: "fadeUpSm 140ms var(--ease-out) both",
            }}
          >
            {label}
            {keys && <KeyChips keys={keys} />}
          </span>,
          document.body,
        )}
    </span>
  );
}
