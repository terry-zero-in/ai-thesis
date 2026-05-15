"use client";

import { Modal } from "@/components/overlays/Modal";
import { KeyChips } from "@/components/primitives/KeyChips";
import { I } from "@/components/primitives/icons";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * ShortcutsOverlay — modal listing the full keyboard registry.
 * Two-column grid · group dividers · per-group stagger 40ms.
 *
 * Verbatim port of ShortcutsOverlay from stage3-app.jsx.
 */
export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={680}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--text-3)", display: "flex" }}>{I.help || I.search}</span>
        <div style={{ fontSize: 13, color: "var(--text-1)", letterSpacing: "-.011em", flex: 1 }}>
          Keyboard shortcuts
        </div>
        <span style={{ fontFamily: "var(--m)", fontSize: 10, color: "var(--text-3)", marginRight: 4 }}>
          two-layer · G-prefix nav + contextual actions
        </span>
        <span className="k">?</span>
        <span className="k">esc</span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 18px 20px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "18px 36px",
        }}
      >
        {SHORTCUTS.map((g, gi) => (
          <div key={g.group} style={{ animation: `fadeUpSm var(--dur-fast) ${gi * 40}ms var(--ease-out) both` }}>
            <div
              style={{
                fontFamily: "var(--m)",
                fontSize: 10,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{g.group}</span>
              <span style={{ flex: 1, height: 1 }} />
              <span style={{ color: "var(--text-3)", fontSize: 9 }}>{g.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {g.items.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-2)",
                      letterSpacing: "-.005em",
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {it.label}
                  </span>
                  <KeyChips keys={it.keys} />
                  {it.alt && <span style={{ fontSize: 9, color: "var(--text-4)", padding: "0 2px" }}>or</span>}
                  {it.alt && <KeyChips keys={it.alt} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
