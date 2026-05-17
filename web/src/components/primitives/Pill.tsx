import type { ReactNode } from "react";

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 3,
        fontSize: 10,
        fontFamily: "var(--m)",
        color: color || "var(--text-3)",
        background: "rgba(255,255,255,.04)",
        border: "1px solid var(--border)",
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
