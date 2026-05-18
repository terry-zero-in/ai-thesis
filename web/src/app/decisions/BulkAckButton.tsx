"use client";

import { useActionState } from "react";
import { ackAlerts, BULK_ACK_INITIAL, type BulkAckState } from "./actions";

/**
 * "Mark all read" affordance for /decisions. Submits the JSON-serialized
 * list of unseen event keys (already filtered by the active kind, scoped
 * by the page server component) via the ackAlerts bulk server action.
 *
 * Hidden when there are no unseen keys to acknowledge — empty button
 * would be noise in the header.
 *
 * Review §2.10 #5.
 */
export function BulkAckButton({ keys, label }: { keys: string[]; label?: string }) {
  const [state, formAction, pending] = useActionState<BulkAckState, FormData>(
    ackAlerts,
    BULK_ACK_INITIAL,
  );
  if (keys.length === 0) return null;
  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="keys" value={JSON.stringify(keys)} />
      <button
        type="submit"
        disabled={pending}
        style={{
          fontSize: 11,
          fontFamily: "var(--m)",
          color: pending ? "var(--text-3)" : "var(--text-2)",
          background: "transparent",
          border: "1px solid var(--border)",
          padding: "2px 10px",
          borderRadius: 3,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Marking…" : label ?? `Mark ${keys.length} read`}
      </button>
      {state.message && !state.ok && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{state.message}</span>
      )}
    </form>
  );
}
