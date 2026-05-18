"use client";

import { useActionState, useState } from "react";
import type { AiqDraftRow } from "@/lib/aiq-drafts-data";
import { promoteAiqDraft } from "./actions";
import { PROMOTE_INITIAL, type PromoteState } from "./action-types";

const DIMENSIONS = [
  { key: "disclosure_pts", note: "disclosure", label: "Disclosure", max: 20 },
  { key: "defensibility_pts", note: "defensibility", label: "Defensibility", max: 20 },
  { key: "concentration_pts", note: "concentration", label: "Concentration", max: 15 },
  { key: "capex_eff_pts", note: "capex_eff", label: "Capex Eff", max: 15 },
  { key: "indep_demand_pts", note: "indep_demand", label: "Indep Demand", max: 15 },
  { key: "accounting_pts", note: "accounting", label: "Accounting", max: 15 },
] as const;

export function DraftCard({ draft }: { draft: AiqDraftRow }) {
  const [expanded, setExpanded] = useState(draft.parse_error != null);
  const [promoteState, promoteAction, promoting] = useActionState<PromoteState, FormData>(
    promoteAiqDraft,
    PROMOTE_INITIAL,
  );
  const canPromote = !draft.parse_error && !draft.approved_at;

  if (draft.parse_error) {
    return (
      <div
        style={{
          border: "1px solid rgba(251, 113, 133, .35)",
          background: "rgba(251, 113, 133, .04)",
          borderRadius: 6,
          padding: "12px 16px",
        }}
      >
        <Meta draft={draft} />
        <div style={{ fontSize: 13, marginTop: 6, color: "var(--text-1)" }}>
          Parse error — Claude output didn't match the schema:
          <pre
            style={{
              margin: "6px 0 0 0",
              padding: "8px 10px",
              background: "rgba(0,0,0,.15)",
              borderRadius: 4,
              fontSize: 11.5,
              fontFamily: "var(--m)",
              whiteSpace: "pre-wrap",
            }}
          >
            {draft.parse_error}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface-1)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 16px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: "var(--text-1)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <Meta draft={draft} />
        <div style={{ display: "flex", gap: 12, fontSize: 12, alignItems: "baseline" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)", fontFamily: "var(--m)" }}>
            {draft.ticker}
          </span>
          <span style={{ color: "var(--text-3)" }}>
            total {draft.total ?? "—"}/100
          </span>
          {DIMENSIONS.map((d) => (
            <span
              key={d.key}
              style={{ color: "var(--text-2)", fontFamily: "var(--m)" }}
              title={d.label}
            >
              {d.label.charAt(0)}:{(draft as unknown as Record<string, number | null>)[d.key] ?? "—"}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 60px 1fr",
              fontSize: 12,
              gap: "6px 14px",
              padding: 12,
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
            }}
          >
            {DIMENSIONS.map((d) => (
              <FragmentRow
                key={d.key}
                label={d.label}
                score={(draft as unknown as Record<string, number | null>)[d.key]}
                max={d.max}
                note={draft.notes?.[d.note] ?? null}
              />
            ))}
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {draft.sources?.ten_k_url && (
              <span>
                {draft.sources.ten_k_form} ({draft.sources.ten_k_filing_date}): {" "}
                <a href={draft.sources.ten_k_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-2)" }}>
                  SEC filing
                </a>
              </span>
            )}
            {draft.sources?.transcript_url && (
              <span>
                Transcript {draft.sources.transcript_quarter ?? draft.sources.transcript_date}: {" "}
                <a href={draft.sources.transcript_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-2)" }}>
                  FMP
                </a>
              </span>
            )}
            <div style={{ flex: 1 }} />
            {canPromote && (
              <form action={promoteAction} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="hidden" name="id" value={draft.id} />
                {promoteState.message && !promoteState.ok && (
                  <span style={{ fontSize: 11, color: "var(--danger)" }}>{promoteState.message}</span>
                )}
                <button
                  type="submit"
                  disabled={promoting}
                  style={{
                    height: 26,
                    padding: "0 14px",
                    fontSize: 11,
                    fontFamily: "var(--m)",
                    fontWeight: 600,
                    color: "var(--voltage-ink)",
                    background: promoting ? "color-mix(in oklab, var(--voltage) 60%, transparent)" : "var(--voltage)",
                    border: "none",
                    borderRadius: 9999,
                    cursor: promoting ? "wait" : "pointer",
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    transition: "background var(--dur-instant) var(--ease-out)",
                  }}
                >
                  {promoting ? "promoting…" : "Promote to rubric"}
                </button>
              </form>
            )}
            {promoteState.ok && (
              <span style={{ fontSize: 11, color: "var(--accent)" }}>{promoteState.message}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  label,
  score,
  max,
  note,
}: {
  label: string;
  score: number | null;
  max: number;
  note: string | null;
}) {
  return (
    <>
      <div style={{ color: "var(--text-2)" }}>{label}</div>
      <div style={{ fontFamily: "var(--m)", color: "var(--text-1)" }}>
        {score ?? "—"} / {max}
      </div>
      <div style={{ color: "var(--text-2)", lineHeight: 1.4 }}>{note ?? "—"}</div>
    </>
  );
}

function Meta({ draft }: { draft: AiqDraftRow }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontSize: 11,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        fontFamily: "var(--m)",
      }}
    >
      <span>{draft.drafted_at}</span>
      {draft.model && (
        <>
          <span>·</span>
          <span>{draft.model}</span>
        </>
      )}
      {draft.approved_at && (
        <>
          <span>·</span>
          <span style={{ color: "var(--text-2)" }}>approved {draft.approved_at.slice(0, 10)}</span>
        </>
      )}
    </div>
  );
}
