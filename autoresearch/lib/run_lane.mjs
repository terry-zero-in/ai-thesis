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
      "supabase/functions/_shared/memo-citations.ts (the validator), aiq-drafts.ts (parse/range validation), memo-context.ts",
    regression: ["memo-citations.test.ts", "aiq-drafts.test.ts", "memo-context.test.ts"],
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
      anchor:
        "DECIDED 2026-06-24: v2 = realized backtest of the hand-scored 20-name slate (spec Part 3), equal-weight, monthly rebalance, 10bps/side, Tier-A only. Automated THS-64 (top-N from full universe) must land within ±10% of that book's Sharpe. HP-1 results_36m_v2.csv is a filename collision, NOT the anchor.",
      runnable_offline: false,
      status: "BLOCKED_NEEDS_HISTORY",
      reason:
        "THS-64 engine is unit-green offline, but the ±10% v2-Sharpe replication needs multi-year point-in-time history (prices_raw + scores_history) absent offline (docs/SESSION_NOTES.md, THS-64 row). Anchor is now defined (above); the headline remains a documented history-backfill dependency, not a failing gate.",
      terry_slot: false,
    },
    regression: reg,
    runnable_offline: false,
    pass: null, // headline cannot be asserted offline; regression is the only offline signal
  };
}

function buildLaneC() {
  // The deterministic memo citation validator now EXISTS (memo-citations.ts,
  // built 2026-06-24 on Terry's STRICT contract) and is unit-green offline.
  // The live leak-rate HEADLINE is measured over LLM-generated memos for the
  // held-out ticker set — an online step (memo generation needs the model),
  // so it is not produced by this offline harness. Honest, not stubbed.
  const reg = runTests(LANES.C.regression);
  let heldOut = null;
  try {
    heldOut = JSON.parse(
      readFileSync(join(REPO, "autoresearch", "lane-c", "held-out.json"), "utf-8"),
    ).held_out_tickers ?? null;
  } catch { /* held-out set optional */ }
  return {
    metric: {
      name: "memo_citation_leak_rate",
      contract: "strict — tickers + numbers (deltas/scores/$values/macro) must trace to context; tol ±0.1 / $2%",
      validator: "supabase/functions/_shared/memo-citations.ts (validateMemoCitations)",
      validator_present: true,
      validator_unit_green: reg.all_green,
      held_out_tickers: heldOut,
      runnable_offline: false,
      status: "VALIDATOR_BUILT_LIVE_PENDING",
      reason:
        "Deterministic validator built + unit-green offline (memo-citations.test.ts). The leak-rate headline requires generating memos for the held-out tickers via the model (online) + wiring the validator as a post-generation gate in compute-daily-memo — that wiring is the lane's first experiment, not done here, so live memo behavior is unchanged. Target: leak_rate = 0, unhandled = 0.",
      terry_slot: false,
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
