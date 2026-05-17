import type { ReactNode } from "react";

/** Field label — uppercase, .05em tracked, with bottom margin. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".05em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

/** Small section-header label — same shape, no bottom margin, .06em tracking. */
export function SLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}
