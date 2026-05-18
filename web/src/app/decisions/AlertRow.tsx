"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { AlertEvent } from "@/lib/alerts-types";
import { ALERT_KIND_LABELS } from "@/lib/alerts-types";
import { ackAlert, ACK_INITIAL, type AckState } from "./actions";

/**
 * Per-alert row with severity dot, summary, expand-on-click detail, and
 * an ack form (server action) with optional note. Acked rows are dimmed
 * but stay visible (with a "re-open" affordance) so the audit log is
 * always full-fidelity.
 */
export function AlertRow({ event }: { event: AlertEvent }) {
  const [state, formAction, pending] = useActionState<AckState, FormData>(ackAlert, ACK_INITIAL);
  const [open, setOpen] = useState(false);
  const acked = !!event.acked_at;
  const dot = event.severity === "high" ? "var(--danger)" : event.severity === "warn" ? "var(--warning)" : "var(--text-3)";

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "12px 16px",
        background: acked ? "rgba(255,255,255,.015)" : undefined,
        opacity: acked ? 0.62 : 1,
        transition: "opacity .15s var(--ease)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dot,
            flexShrink: 0,
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--text-1)",
            fontSize: 13,
            fontFamily: "var(--m)",
            fontWeight: 500,
          }}
        >
          {event.title}
        </button>
        {/* Spec §4.5 tag chip: --surface-2 bg, --text-2 color, 1px 5px,
            radius 3px, 10px mono uppercase 0.05em tracking. NEVER for
            actions — neutral metadata only. */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-2)",
            background: "var(--surface-2)",
            letterSpacing: ".05em",
            textTransform: "uppercase",
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          {ALERT_KIND_LABELS[event.kind]}
        </span>
        {event.ticker && (
          // Review §2.10 #3 + spec §4.5 — detail-link is an action, not a
          // chip. Quiet text-button at --text-3, lin-hov promotes to
          // --accent on hover. Replaces the prior accent-bordered "chip
          // pretending to be a button" treatment.
          <Link
            href={`/universe/${event.ticker}`}
            className="lin-hov"
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              textDecoration: "none",
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: ".05em",
              textTransform: "uppercase",
            }}
          >
            Detail ↗
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--text-3)" }}>{event.as_of}</span>
        <form action={formAction} style={{ display: "inline-flex", gap: 6 }}>
          <input type="hidden" name="key" value={event.key} />
          {acked && <input type="hidden" name="remove" value="1" />}
          {/* Review §2.10 #3 — unified button style. Primary action (ack)
              gets solid accent fill; re-open of an already-acked row drops
              to ghost outline to keep undo visually quieter than do. */}
          <button
            type="submit"
            disabled={pending}
            style={{
              height: 22,
              padding: "0 10px",
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: acked ? "var(--text-3)" : "var(--canvas)",
              background: acked ? "transparent" : "var(--accent)",
              border: acked ? "1px solid var(--border)" : "none",
              borderRadius: 3,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            {pending ? "…" : acked ? "re-open" : "ack"}
          </button>
        </form>
      </div>

      {open && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 17,
            fontSize: 12,
            color: "var(--text-2)",
            lineHeight: 1.55,
          }}
        >
          {event.detail}
          {event.acked_at && (
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
              Acked {new Date(event.acked_at).toISOString().slice(0, 16).replace("T", " ")} UTC
              {event.acked_note ? ` · ${event.acked_note}` : ""}
            </div>
          )}
          {!acked && (
            <form action={formAction} style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <input type="hidden" name="key" value={event.key} />
              <input
                name="note"
                type="text"
                placeholder="Optional ack note (e.g. 'reviewed; matches Burry Q3 13F')"
                style={{
                  flex: 1,
                  height: 24,
                  padding: "0 8px",
                  fontSize: 11.5,
                  fontFamily: "var(--f)",
                  color: "var(--text-1)",
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={pending}
                style={{
                  height: 24,
                  padding: "0 10px",
                  fontSize: 11,
                  fontFamily: "var(--m)",
                  color: "var(--canvas)",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 3,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                Ack with note
              </button>
            </form>
          )}
          {state.message && !state.ok && (
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)" }}>{state.message}</div>
          )}
        </div>
      )}
    </div>
  );
}
