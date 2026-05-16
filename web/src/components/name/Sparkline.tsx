/**
 * 12-week composite sparkline. Pure SVG — no chart lib per the
 * "don't add libs casually" rule. Renders the composite line in muted text,
 * the final-score line in accent. Bare-bones: no axis, no labels in the
 * chart body; range shown above.
 */
import type { NameSparkPoint } from "@/lib/name-detail-data";

export function Sparkline({ history }: { history: NameSparkPoint[] }) {
  if (history.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>
        No history yet — needs at least one Saturday cron run.
      </div>
    );
  }
  const w = 480;
  const h = 56;
  const padX = 4;
  const padY = 6;
  const compositeVals = history.map((p) => p.composite).filter((v): v is number => v != null);
  const finalVals = history.map((p) => p.final_score).filter((v): v is number => v != null);
  const all = [...compositeVals, ...finalVals];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const x = (i: number) => padX + (i / Math.max(1, history.length - 1)) * (w - padX * 2);
  const y = (v: number) => h - padY - ((v - min) / range) * (h - padY * 2);

  const compositePath = pathFrom(history.map((p) => p.composite), x, y);
  const finalPath = pathFrom(history.map((p) => p.final_score), x, y);
  const last = history[history.length - 1];
  const first = history[0];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          12-week history
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
          {first.as_of} → {last.as_of}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <path d={compositePath} fill="none" stroke="var(--text-3)" strokeWidth={1} opacity={0.6} />
        <path d={finalPath} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
        {history.map((p, i) =>
          p.final_score == null ? null : (
            <circle key={i} cx={x(i)} cy={y(p.final_score)} r={1.5} fill="var(--accent)" />
          ),
        )}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
        <Legend color="var(--accent)" label={`Final · ${last.final_score?.toFixed(1) ?? "—"}`} />
        <Legend color="var(--text-3)" label={`Composite · ${last.composite?.toFixed(1) ?? "—"}`} />
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--m)" }}>
          {min.toFixed(1)} – {max.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 2, background: color, borderRadius: 1 }} />
      <span style={{ fontFamily: "var(--m)" }}>{label}</span>
    </span>
  );
}

function pathFrom(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  const parts: string[] = [];
  let started = false;
  values.forEach((v, i) => {
    if (v == null) {
      started = false;
      return;
    }
    parts.push(`${started ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`);
    started = true;
  });
  return parts.join(" ");
}
