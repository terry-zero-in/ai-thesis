"use client";

import { useActionState, useMemo, useState } from "react";
import { savePosition, POSITION_INITIAL, type PositionFormState } from "./actions";
import type { UniverseChoice } from "@/lib/portfolio-types";

/**
 * Add-position form. UPSERTs by ticker so editing an existing position is
 * the same flow: pick the same ticker, submit new totals. The form
 * pre-fills opened_at to today; user can override for backdated entries.
 */
export function AddPositionForm({
  choices,
  envConfigured,
  takenTickers,
}: {
  choices: UniverseChoice[];
  envConfigured: boolean;
  takenTickers: string[];
}) {
  const [state, formAction, pending] = useActionState<PositionFormState, FormData>(savePosition, POSITION_INITIAL);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [ticker, setTicker] = useState("");
  const taken = useMemo(() => new Set(takenTickers), [takenTickers]);
  const isEdit = taken.has(ticker);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Header>{isEdit ? `Update ${ticker}` : "Add position"}</Header>
      <Field label="Ticker">
        <select
          name="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          required
          style={selectStyle()}
        >
          <option value="">Select…</option>
          {choices.map((c) => (
            <option key={c.ticker} value={c.ticker}>
              {c.ticker} — {c.name}
              {taken.has(c.ticker) ? " (held)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Shares">
          <input name="shares" type="number" step="0.01" min={0} placeholder="e.g. 25" required style={inputStyle()} />
        </Field>
        <Field label="Cost / share">
          <input name="cost_basis" type="number" step="0.01" min={0} placeholder="e.g. 142.30" required style={inputStyle()} />
        </Field>
      </div>
      <Field label="Opened">
        <input name="opened_at" type="date" defaultValue={today} style={inputStyle()} />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={2} placeholder="Fill notes, related decision, etc." style={textareaStyle()} />
      </Field>
      <button
        type="submit"
        disabled={pending || !envConfigured}
        style={{
          height: 32,
          padding: "0 14px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--canvas)",
          background: pending ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--accent)",
          border: "none",
          borderRadius: 4,
          cursor: pending ? "wait" : envConfigured ? "pointer" : "not-allowed",
          opacity: !envConfigured ? 0.5 : 1,
        }}
      >
        {pending ? "Saving…" : isEdit ? "Update position" : "Add position"}
      </button>
      {state.message && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: state.ok ? "#34D399" : "#FB7185",
            background: state.ok ? "rgba(52,211,153,.06)" : "rgba(251,113,133,.06)",
            border: `1px solid ${state.ok ? "rgba(52,211,153,.25)" : "rgba(251,113,133,.25)"}`,
          }}
        >
          {state.message}
        </div>
      )}
      {!envConfigured && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--text-3)",
            background: "rgba(255,255,255,.02)",
            border: "1px dashed var(--border)",
          }}
        >
          Supabase env not configured — read-only. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
        </div>
      )}
    </form>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "var(--m)",
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, fontFamily: "var(--m)", color: "var(--text-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    height: 28,
    padding: "0 8px",
    fontSize: 12.5,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
  };
}

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    height: 30,
    fontFamily: "var(--m)",
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
    resize: "vertical",
    minHeight: 40,
    lineHeight: 1.5,
  };
}
