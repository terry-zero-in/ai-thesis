import type { ReactNode } from "react";

export function Chip({ children, dot, color }: { children: ReactNode; dot?: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot || color || "var(--text-3)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "-.005em" }}>{children}</span>
    </span>
  );
}
