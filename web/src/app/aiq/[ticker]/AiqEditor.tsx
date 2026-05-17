"use client";

import { useActionState, useMemo, useState } from "react";
import { DIMS, type AiqRow, type DimKey, type NoteKey } from "@/lib/aiq-types";
import { saveAiqRubric, SAVE_INITIAL, type SaveState } from "./actions";
import { HeroNumber } from "@/components/primitives/HeroNumber";

interface Props {
  ticker: string;
  latest: AiqRow | null;
  envConfigured: boolean;
}

export function AiqEditor({ ticker, latest, envConfigured }: Props) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveAiqRubric, SAVE_INITIAL);

  // Initial values: prefer latest row; otherwise zero everything.
  const initial = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of DIMS) out[d.key] = latest ? (latest[d.key as DimKey] as number) : 0;
    return out;
  }, [latest]);
  const [vals, setVals] = useState(initial);
  const total = DIMS.reduce((s, d) => s + (vals[d.key] || 0), 0);

  const set = (k: string, v: number) => setVals((p) => ({ ...p, [k]: v }));

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <input type="hidden" name="ticker" value={ticker} />

      {/* Mercury decard: hero sits on canvas, framed by top + bottom hairlines. */}
      <div
        style={{
          padding: "18px 22px",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <HeroNumber
          label="Total"
          value={total}
          unit=" / 100"
          precision={0}
          size="lg"
          valueColor={total === 0 ? "var(--text-4)" : "var(--text-1)"}
          delta={latest && total !== latest.total ? { value: total - latest.total, period: "vs saved" } : null}
          attribution={latest ? `last saved ${latest.scored_at} · was ${latest.total}` : "no prior version"}
        />
      </div>

      {DIMS.map((d) => (
        <DimRow
          key={d.key}
          label={d.label}
          dimKey={d.key}
          noteKey={d.note}
          cap={d.cap}
          value={vals[d.key]}
          onChange={(v) => set(d.key, v)}
          initialNote={(latest?.[d.note as NoteKey] as string | null) ?? ""}
        />
      ))}

      <Field label="Source URL" name="source_url" defaultValue={latest?.source_url ?? ""} placeholder="https://investor.example.com/2026-q1.pdf" />
      <Field
        label="General notes"
        name="notes"
        defaultValue={latest?.notes ?? ""}
        multiline
        placeholder="Cross-cutting rationale — what changed since the last scoring, key risks to revisit, etc."
      />

      {/* Submit row sits on canvas with breathing room above. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px 0" }}>
        <button
          type="submit"
          disabled={pending || !envConfigured}
          style={{
            height: 34,
            padding: "0 16px",
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--canvas)",
            background: pending ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--accent)",
            border: "none",
            borderRadius: 5,
            cursor: pending ? "wait" : envConfigured ? "pointer" : "not-allowed",
            opacity: !envConfigured ? 0.5 : 1,
          }}
        >
          {pending ? "Saving…" : "Save scoring"}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
          Saves as {new Date().toISOString().slice(0, 10)} · same-day re-save overwrites, next day creates a new history row.
        </span>
      </div>

      {state.message && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 5,
            fontSize: 12,
            lineHeight: 1.5,
            color: state.ok ? "var(--success)" : "var(--danger)",
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
            borderRadius: 5,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--text-3)",
            background: "rgba(255,255,255,.02)",
            border: "1px dashed var(--border)",
          }}
        >
          Supabase env not configured — editor renders read-only. Set <code style={{ fontFamily: "var(--m)" }}>NEXT_PUBLIC_SUPABASE_URL</code> + <code style={{ fontFamily: "var(--m)" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code style={{ fontFamily: "var(--m)" }}>.env.local</code> to enable saves.
        </div>
      )}
    </form>
  );
}

function DimRow({
  label,
  dimKey,
  noteKey,
  cap,
  value,
  onChange,
  initialNote,
}: {
  label: string;
  dimKey: string;
  noteKey: string;
  cap: number;
  value: number;
  onChange: (v: number) => void;
  initialNote: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  return (
    // Mercury decard: row sits on canvas with bottom hairline separating rows.
    <div
      style={{
        padding: "14px 22px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            flex: 1,
          }}
        >
          {label}
        </span>
        <input
          type="number"
          name={dimKey}
          min={0}
          max={cap}
          step={1}
          value={value}
          onChange={(e) => onChange(clamp(parseInt(e.target.value || "0", 10), 0, cap))}
          style={{
            width: 56,
            height: 26,
            padding: "0 8px",
            textAlign: "right",
            fontFamily: "var(--m)",
            fontSize: 13,
            color: "var(--text-1)",
            background: "rgba(255,255,255,.04)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            outline: "none",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>/ {cap}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,.04)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", opacity: 0.7 }} />
      </div>
      <textarea
        name={noteKey}
        defaultValue={initialNote}
        rows={2}
        placeholder="Rationale + sources (e.g. 10-K segment data citation)"
        style={{
          marginTop: 2,
          padding: "8px 10px",
          fontSize: 12,
          fontFamily: "var(--f)",
          color: "var(--text-1)",
          background: "rgba(255,255,255,.02)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          outline: "none",
          resize: "vertical",
          minHeight: 38,
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  multiline,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    // Mercury decard: Field row on canvas with bottom hairline.
    <div
      style={{
        padding: "14px 22px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          placeholder={placeholder}
          style={textareaStyle()}
        />
      ) : (
        <input name={name} type="text" defaultValue={defaultValue} placeholder={placeholder} style={inputStyle()} />
      )}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    height: 30,
    padding: "0 10px",
    fontSize: 12.5,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    padding: "8px 10px",
    fontSize: 12.5,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
    resize: "vertical",
    minHeight: 56,
    lineHeight: 1.5,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
