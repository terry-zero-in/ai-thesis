"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AIQ_CONFIDENCE_LEVELS,
  DIMS,
  aiqNextReviewDate,
  dimSlug,
  sourceFieldName,
  type AiqConfidence,
  type AiqRow,
  type DimKey,
  type NoteKey,
} from "@/lib/aiq-types";
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

  // THS-75: confidence is a tri-state pill (High/Medium/Low). DB column is
  // free text but UI restricts; existing free-text values that don't match
  // surface as "—" via initialConfidence below.
  const initialConfidence: AiqConfidence | null =
    latest?.confidence && (AIQ_CONFIDENCE_LEVELS as string[]).includes(latest.confidence)
      ? (latest.confidence as AiqConfidence)
      : null;
  const [confidence, setConfidence] = useState<AiqConfidence | null>(initialConfidence);

  // THS-75: reason-for-last-change is tracked client-side so the dirty chip
  // can fire when only the rationale changed (e.g. operator clarifying why
  // a score was set the way it was, without touching the numbers).
  const [reason, setReason] = useState<string>(latest?.last_change_reason ?? "");

  const dimsDirty = DIMS.some((d) => vals[d.key] !== initial[d.key]);
  const confidenceDirty = confidence !== initialConfidence;
  const reasonDirty = reason.trim() !== (latest?.last_change_reason ?? "").trim();
  const dirty = dimsDirty || confidenceDirty || reasonDirty;

  const set = (k: string, v: number) => setVals((p) => ({ ...p, [k]: v }));

  const today = new Date().toISOString().slice(0, 10);
  const nextReview = aiqNextReviewDate(latest?.scored_at ?? null);

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
      {/* THS-75: confidence chip selection persists alongside the row. */}
      <input type="hidden" name="confidence" value={confidence ?? ""} />

      {/* THS-75 cockpit header strip — "AIQ SCORE — {TICKER}" with right-aligned
          Last scored / Next review metadata. Sits above the hero so the entire
          state of the scoring (composite + cadence + confidence) is legible in
          one vertical glance. */}
      <div
        style={{
          padding: "12px 22px 12px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            flex: 1,
            minWidth: 0,
          }}
        >
          AIQ Score — {ticker}
        </div>
        <CockpitMeta label="Last scored" value={latest?.scored_at ?? "—"} />
        <CockpitMeta label="Next review" value={nextReview ?? today} />
        <ConfidencePill value={confidence} onChange={setConfidence} />
      </div>

      {/* Mercury decard: hero sits on canvas, framed by top + bottom hairlines. */}
      <div
        style={{
          padding: "18px 22px",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <HeroNumber
          label="Composite"
          value={total}
          unit=" / 100"
          precision={0}
          size="lg"
          valueColor={total === 0 ? "var(--text-4)" : "var(--text-1)"}
          delta={latest && total !== latest.total ? { value: total - latest.total, period: "vs saved" } : null}
          attribution={latest ? `last saved ${latest.scored_at} · was ${latest.total}` : "no prior version"}
        />
      </div>

      {DIMS.map((d) => {
        const slug = dimSlug(d.key);
        return (
          <DimRow
            key={d.key}
            label={d.label}
            dimKey={d.key}
            noteKey={d.note}
            cap={d.cap}
            value={vals[d.key]}
            onChange={(v) => set(d.key, v)}
            initialNote={(latest?.[d.note as NoteKey] as string | null) ?? ""}
            sourceFieldName={sourceFieldName(slug)}
            initialSource={latest?.sources?.[slug] ?? ""}
          />
        );
      })}

      <Field
        label="General notes"
        name="notes"
        defaultValue={latest?.notes ?? ""}
        multiline
        placeholder="Cross-cutting rationale — what changed since the last scoring, key risks to revisit, etc."
      />

      {/* THS-75: reason-for-last-change. Free text; persisted to
          aiq_rubric.last_change_reason. Audit-only — the (ticker, scored_at)
          PK provides versioning, this column provides the *why* on a
          same-day re-save. */}
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
          Reason for last change
        </span>
        <textarea
          name="last_change_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why did this scoring change? (e.g. Q1 print confirmed segment disclosure, raising Disclosure 14→18.)"
          style={textareaStyle()}
        />
        {latest?.last_change_reason && latest.last_change_reason.trim() === reason.trim() && (
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--m)",
              color: "var(--text-4)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ↳ recorded {latest.scored_at}
          </div>
        )}
      </div>

      {/* Submit row sits on canvas with breathing room above.
          Spec §5.6 line 705: [Discard] ... [Save → 93] — Discard is dirty-only,
          resets dim numbers + textarea DOM via form.reset() back to `latest`
          (or zeros when no prior version).
          THS-75: dirty chip surfaces unsaved state inline (Linear pattern). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px 0" }}>
        <button
          type="submit"
          disabled={pending || !envConfigured}
          style={{
            height: 34,
            padding: "0 20px",
            fontSize: 12.5,
            fontWeight: 600,
            // Accent palette — voltage was retired post #92 accent pivot.
            // Matches PortfolioAddPositionForm submit (#89). White ink on
            // accent fill; pending state lowers fill alpha.
            color: "var(--canvas)",
            background: pending ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--accent)",
            border: "none",
            borderRadius: 9999,
            cursor: pending ? "wait" : envConfigured ? "pointer" : "not-allowed",
            opacity: !envConfigured ? 0.5 : 1,
            transition: "background var(--dur-instant) var(--ease-out)",
          }}
        >
          {pending ? "Saving…" : `Save scoring${latest && total !== latest.total ? ` → ${total}` : ""}`}
        </button>
        <button
          type="reset"
          disabled={pending || !dirty}
          onClick={() => setVals(initial)}
          style={{
            height: 34,
            padding: "0 14px",
            fontSize: 12.5,
            fontWeight: 500,
            color: dirty ? "var(--text-2)" : "var(--text-4)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 5,
            cursor: dirty && !pending ? "pointer" : "not-allowed",
          }}
        >
          Discard
        </button>
        {/* THS-75: dirty chip — Linear's "unsaved" pattern. Visible whenever
            any input differs from the latest saved row. */}
        {dirty && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px",
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--warning)",
              background: "color-mix(in oklab, var(--warning) 8%, transparent)",
              border: "1px solid color-mix(in oklab, var(--warning) 25%, transparent)",
              borderRadius: 999,
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--warning)" }} />
            Unsaved
          </span>
        )}
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
          Saves as {today} · same-day re-save overwrites, next day creates a new history row.
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
  sourceFieldName,
  initialSource,
}: {
  label: string;
  dimKey: string;
  noteKey: string;
  cap: number;
  value: number;
  onChange: (v: number) => void;
  initialNote: string;
  sourceFieldName: string;
  initialSource: string;
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
        placeholder="Rationale (e.g. 10-K segment data, IR release quote)"
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
      {/* Spec §5.6 line 689+696: per-dimension Source URL beneath each
          rationale block. Quiet label inline with input; empty = no source. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--m)",
            color: "var(--text-4)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            flexShrink: 0,
          }}
        >
          Source URL
        </span>
        <input
          name={sourceFieldName}
          type="url"
          defaultValue={initialSource}
          placeholder="https://investor.example.com/q1-2026.pdf"
          style={{
            flex: 1,
            height: 24,
            padding: "0 8px",
            fontSize: 11.5,
            fontFamily: "var(--m)",
            color: "var(--text-1)",
            background: "rgba(255,255,255,.02)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            outline: "none",
          }}
        />
      </div>
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

/** THS-75 cockpit header meta — quiet `label · value` pair, tabular-num value. */
function CockpitMeta({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--text-4)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{value}</span>
    </div>
  );
}

/** THS-75 confidence pill — tri-state High/Medium/Low selector. Severity
 * palette (success/text-2/warning) rather than iris/categorical, per the
 * /lambo Q-lock: categorical color is reserved for tier signal, severity
 * is reserved for actionable risk states. Confidence is risk-flavoured
 * metadata so severity is the correct lane. */
function ConfidencePill({
  value,
  onChange,
}: {
  value: AiqConfidence | null;
  onChange: (v: AiqConfidence | null) => void;
}) {
  const colorFor = (v: AiqConfidence | null): string => {
    if (v === "High") return "var(--success)";
    if (v === "Medium") return "var(--text-2)";
    if (v === "Low") return "var(--warning)";
    return "var(--text-4)";
  };
  return (
    <div
      role="radiogroup"
      aria-label="Confidence"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontFamily: "var(--m)",
          color: "var(--text-4)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginRight: 4,
        }}
      >
        Confidence
      </span>
      {AIQ_CONFIDENCE_LEVELS.map((lvl) => {
        const active = value === lvl;
        const c = colorFor(lvl);
        return (
          <button
            key={lvl}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : lvl)}
            style={{
              padding: "2px 8px",
              fontSize: 10.5,
              fontFamily: "var(--m)",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              borderRadius: 999,
              cursor: "pointer",
              color: active ? c : "var(--text-3)",
              background: active ? `color-mix(in oklab, ${c} 10%, transparent)` : "transparent",
              border: `1px solid ${active ? `color-mix(in oklab, ${c} 35%, transparent)` : "var(--border)"}`,
              transition: "background var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out)",
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}
