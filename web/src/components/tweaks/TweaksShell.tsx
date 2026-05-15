"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { TWEAKS_STYLE } from "./styles";

/**
 * Floating, draggable, closable shell for the dev Tweaks panel.
 *
 * Port of TweaksPanel from tweaks-panel.jsx with iframe/postMessage paths
 * removed — the Next app has no parent host. State persists locally:
 *   - open/closed via a floating opener pill (rendered when closed)
 *   - position drag-clamped to viewport
 *
 * Deck-stage rail toggle (the auto-injected secondary control in the source)
 * is also dropped — there's no <deck-stage> in this app.
 */

export interface TweaksShellProps {
  title?: string;
  /** Initial open state. Defaults to false so the page chrome is unobstructed on first paint. */
  defaultOpen?: boolean;
  children?: ReactNode;
}

export function TweaksShell({ title = "Tweaks", defaultOpen = false, children }: TweaksShellProps) {
  const [open, setOpen] = useState(defaultOpen);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + "px";
    panel.style.bottom = offsetRef.current.y + "px";
  }, []);

  useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", clampToViewport);
      return () => window.removeEventListener("resize", clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      {!open && (
        <button type="button" className="twk-opener" aria-label="Open dev tweaks" onClick={() => setOpen(true)}>
          <i />
          <span>{title}</span>
        </button>
      )}
      {open && (
        <div
          ref={dragRef}
          className="twk-panel"
          data-noncommentable=""
        >
          <div className="twk-hd" onMouseDown={onDragStart}>
            <b>{title}</b>
            <button
              className="twk-x"
              aria-label="Close tweaks"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="twk-body">{children}</div>
        </div>
      )}
    </>
  );
}
