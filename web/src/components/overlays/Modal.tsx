"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal shell — verbatim port of Modal from stage3-common.jsx.
 *
 * Choreography: backdrop fade-in 140ms ease-out · content scale-up 240ms spring
 * at 40ms delay. Trap initial focus to first focusable element so Esc + Tab work
 * without prior click.
 */
export function Modal({
  open,
  onClose,
  width = 480,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", h, true);
    // Focus first focusable in the modal so keyboard nav starts inside, not on body.
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>(
        'button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
      );
      el?.focus({ preventScroll: true });
    }, 80);
    return () => {
      window.removeEventListener("keydown", h, true);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,9,10,.72)",
        backdropFilter: "blur(6px)",
        zIndex: 210,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "modalBackdrop var(--dur-fast) var(--ease-out) both",
      }}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 9,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.02)",
          animation: "modalContent var(--dur-mid) 40ms var(--spring) both",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          willChange: "transform,opacity",
        }}
      >
        {children}
      </div>
    </div>
  );
}
