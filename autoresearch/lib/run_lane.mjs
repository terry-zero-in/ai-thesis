#!/usr/bin/env node
// Autoresearch lane scorer — produces autoresearch/lane-<x>/score.json + appends
// the append-only ledger. Zero-dependency Node (>=23.6 / v24), runs the EXISTING
// deterministic harnesses (node:test) and the live scoring module — it never
// reimplements engine math, it reuses it (per AUTORESEARCH_DOCTRINE.md Part I).
//
// Usage:
//   node --experimental-strip-types autoresearch/lib/run_lane.mjs <A|B|C> [--label baseline]
//
// Each lane writes a versioned score.json (the "investor artifact" of
// AUTORESEARCH_DOCTRINE.md Part VI) and appends one row to
// autoresearch/score_ledger.jsonl. The --label tags the run (e.g. "baseline").
//
// HARD GATE (SEC 206(4)-1): the numbers here are HARNESS/TEST metrics on fixed
// fixtures and a hand-scored slate. They are NOT live performance and must never
// be presented as a track record. See program.md §Hard gates.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");
const SHARED = join(REPO, "supabase", "functions", "_shared");

// ── lane wiring ──────────────────────────────────────────────────────────────
// Each lane names: the deterministic regression files it runs, plus a headline
// metric. Files are relative to supabase/functions/_shared.
const LANES = {
  A: {
    id: "A",
    title: "Engine determinism + 20-name hand-scored slate (±5)",
    surface:
      "supabase/functions/_shared/factor-*.ts, composite.ts, concentration.ts, weekly-ranking.ts, stats.ts, metrics.ts",
    regression: [
      "factor-q.test.ts", "factor-g.test.ts", "factor-v.test.ts",
      "factor-m.test.ts", "factor-s.test.ts", "factor-insider.test.ts",
      "composite.test.ts", "concentration.test.ts", "weekly-ranking.test.ts",
      "stats.test.ts", "metrics.test.ts",
    ],
  },
  B: {
    id: "B",
    title: "Composite tie-out + THS-64 walk-forward backtest (v2 ±10% Sharpe)",
    surface:
      "supabase/functions/_shared/composite.ts (tie-out), backtest.ts (THS-64, reused not rebuilt)",
    regression: ["composite.test.ts", "backtest.test.ts"],
  },
  C: {
    id: "C",
    title: "Memo citation-validation leak rate → 0 (held-out tickers)",
    surface:
      "supabase/functions/_shared/aiq-drafts.ts (parse/range validation), memo-context.ts",
    regression: ["aiq-drafts.test.ts", "memo-context.test.ts"],
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO })
      .toString().trim();
  } catch {
    return "UNKNOWN";
  }
}

function isoStamp() {
  // Deterministic-friendly: callers may override via SCORE_TS for reproducible
  // ledger rows; otherwise wall clock.
  return process.env.SCORE_TS || new Date().toISOString();
}

// Run node:test over a set of files with the TAP reporter and parse the summary.
function runTests(files) {
  const args = [
    "--test", "--experimental-strip-types", "--test-reporter=tap",
    ...files.map((f) => join(SHARED, f)),
  ];
  let out = "";
  let ok = true;
  try {
    out = execFileSync(process.execPath, args, { cwd: REPO }).toString();
  } catch (e) {
    // node --test exits non-zero on any failing test; capture its stdout anyway.
    out = (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : "");
    ok = false;
  }
  const grab = (re) => {
    const m = out.match(re);
    return m ? Number(m[1]) : null;
  };
  const passed = grab(/^# pass (\d+)/m);
  const failed = grab(/^# fail (\d+)/m);
  const total = grab(/^# tests (\d+)/m);
  return {
    files,
    tests: total,
    passed,
    failed,
    all_green: ok && failed === 0 && (passed ?? 0) > 0,
  };
}

// ── Lane A headline: 20-name slate tie-out (reuses computeComposite) ──────────
async function slateTieOut() {
  const { computeComposite } = await import(join(SHARED, "composite.ts"));
  const slate = JSON.parse(
    readFileSync(join(REPO, "autoresearch", "lane-a", "slate.json"), "utf-8"),
  );
  const tol = slate.tolerance ?? 5;
  const nullGauges = { naaim: null, aaii_3wk_spread: null, fear_greed: null };

  const compute = () =>
    slate.names.map((n) => {
      const r = computeComposite(
        n.ticker, n.layer,
        { q: n.q, g: n.g, v: n.v, aiq: n.aiq, m: null, s: null },
        nullGauges, n.conc_tax,
      );
      const got = r.compositeTaxed;
      const delta = got == null ? null : Number((got - n.expected_final).toFixed(4));
      return {
        ticker: n.ticker,
        expected_final: n.expected_final,
        computed: got == null ? null : Number(got.toFixed(4)),
        delta,
        within_tol: delta != null && Math.abs(delta) <= tol,
      };
    });

  // Determinism: compute twice, require byte-identical JSON.
  const run1 = compute();
  const run2 = compute();
  const deterministic = JSON.stringify(run1) === JSON.stringify(run2);

  const within = run1.filter((x) => x.within_tol).length;
  const deltas = run1.filter((x) => x.delta != null).map((x) => Math.abs(x.delta));
  return {
    tolerance: tol,
    names_total: slate.names.length,
    names_within_tol: within,
    max_abs_delta: deltas.length ? Number(Math.max(...deltas).toFixed(4)) : null,
    mean_abs_delta: deltas.length
      ? Number((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(4))
      : null,
    deterministic,
    per_name: run1,
    pass: deterministic && within === slate.names.length,
    source: slate._source,
  };
}

// ── per-lane builders ─────────────────────────────────────────────────────────
async function buildLaneA() {
  const reg = runTests(LANES.A.regression);
  const slate = await slateTieOut();
  return {
    metric: {
      name: "slate_tie_out_within_5",
      ...slate,
    },
    regression: reg,
    runnable_offline: true,
    pass: reg.all_green && slate.pass,
  };
}

function buildLaneB() {
  // composite tie-out + THS-64 engine invariants both run offline.
  const reg = runTests(LANES.B.regression);
  return {
    metric: {
      name: "v2_sharpe_replication_within_10pct",
      runnable_offline: false,
      status: "BLOCKED_NEEDS_HISTORY",
      reason:
        "THS-64 backtest engine is unit-green offline, but replicating the v2 hand-scored Sharpe within ±10% requires multi-year point-in-time price/score history (prices_raw + scores_history) that is not present offline. Documented in docs/SESSION_NOTES.md (THS-64 row). The v2 reference Sharpe + which v2 strategy row to anchor against is a [TERRY] methodology slot — see program.md Lane B.",
      terry_slot: true,
      reference_csv: "engine/data/results_36m_v2.csv (candidate v2 anchor — NOT yet confirmed by Terry)",
    },
    regression: reg,
    runnable_offline: false,
    pass: null, // headline cannot be asserted offline; regression is the only offline signal
  };
}

function buildLaneC() {
  // Deterministic citation/parse-validation surface runs offline; the memo
  // citation-VALIDATOR (THS-10/THS-113) that the leak-rate metric scores does
  // not exist in-tree yet — flagged honestly, not stubbed.
  const reg = runTests(LANES.C.regression);
  return {
    metric: {
      name: "memo_citation_leak_rate",
      runnable_offline: false,
      status: "NEEDS_VALIDATOR",
      reason:
        "compute-daily-memo (THS-65) synthesizes memos via Claude but ships NO deterministic citation validator in-tree as of this baseline. The nearest existing deterministic citation surface is aiq-drafts.ts (parseAiqDraft + range validation), exercised by the regression below. A memo citation-validation harness over a held-out ticker set (leak rate → 0) is the BUILD TARGET of this lane, not an artifact to reuse. THS-10/THS-113 are Linear refs, not code found in this tree this session.",
      terry_slot: true,
      held_out_set: "[TERRY] held-out ticker set not yet defined — see program.md Lane C",
    },
    regression: reg,
    runnable_offline: false,
    pass: null,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const lane = (process.argv[2] || "").toUpperCase();
  const labelIdx = process.argv.indexOf("--label");
  const label = labelIdx >= 0 ? process.argv[labelIdx + 1] : "run";
  if (!LANES[lane]) {
    console.error(`usage: run_lane.mjs <A|B|C> [--label <tag>]  (got "${process.argv[2]}")`);
    process.exit(2);
  }

  const cfg = LANES[lane];
  let body;
  if (lane === "A") body = await buildLaneA();
  else if (lane === "B") body = buildLaneB();
  else body = buildLaneC();

  const score = {
    schema: "autoresearch/score.v1",
    lane: cfg.id,
    title: cfg.title,
    label,
    editable_surface: cfg.surface,
    commit: gitSha(),
    generated_at: isoStamp(),
    node_version: process.version,
    ...body,
  };

  const outDir = join(REPO, "autoresearch", `lane-${lane.toLowerCase()}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "score.json");
  writeFileSync(outPath, JSON.stringify(score, null, 2) + "\n");

  // Append-only ledger (mirrors docs/EVIDENCE.md pattern, Doctrine Part VI).
  const ledgerRow = {
    ts: score.generated_at,
    lane: score.lane,
    label: score.label,
    commit: score.commit,
    pass: score.pass,
    headline:
      lane === "A"
        ? { within: body.metric.names_within_tol, of: body.metric.names_total, max_abs_delta: body.metric.max_abs_delta, deterministic: body.metric.deterministic }
        : { status: body.metric.status, regression_green: body.regression.all_green, tests: body.regression.passed },
  };
  appendFileSync(
    join(REPO, "autoresearch", "score_ledger.jsonl"),
    JSON.stringify(ledgerRow) + "\n",
  );

  console.log(`lane ${lane} (${label}) → ${outPath}`);
  console.log(JSON.stringify(ledgerRow.headline, null, 2));
}

main().catch((e) => {
  console.error("run_lane failed:", e);
  process.exit(1);
});
