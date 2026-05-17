"use client";

import { useEffect } from "react";
import { I } from "@/components/primitives/icons";

export interface ToastData {
  kind?: "ok" | "warn" | "err" | "accent";
  title: string;
  sub?: string;
}

/**
 * Toast — verbatim port of Toast from stage3-common.jsx.
 * Auto-dismisses after 3.4s.
 */
export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3400);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const color =
    toast.kind === "ok"
      ? "var(--success)"
      : toast.kind === "warn"
        ? "var(--warning)"
        : toast.kind === "err"
          ? "var(--danger)"
          : "var(--accent)";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 300,
        background: "var(--elevated)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 260,
        maxWidth: 420,
        boxShadow: "0 10px 32px rgba(0,0,0,.5)",
        animation: "slideRight 220ms var(--ease) both",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500, letterSpacing: "-.011em" }}>
          {toast.title}
        </div>
        {toast.sub && (
          <div style={{ fontFamily: "var(--m)", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{toast.sub}</div>
        )}
      </div>
      <button onClick={onDismiss} style={{ color: "var(--text-3)", display: "flex", padding: 2 }}>
        {I.x}
      </button>
    </div>
  );
}
