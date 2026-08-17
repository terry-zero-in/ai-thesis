/* The M estimator, measured on the thing that matters: Brier on real outcomes.
 *
 *   node btc-session-edge-v3/analysis/m-estimator-brier.mjs   (from repo root)
 *
 * S40 found that `mult()` builds the volatility multiplier M out of
 * |finalDelta| — one number per session, and the single worst statistic
 * available for the job, because a session that travels $400 and comes back to
 * $5 records $5. Rebuilding the same estimator from realised per-minute
 * volatility scored 0.527 vs 0.464 on a vol-forecast measure.
 *
 * It was deliberately NOT shipped, for two stated reasons:
 *
 *   1. HANDOFF.md rule 2 — `sigmaUnit` feeds `z`, and `B = 1.49` was fitted to
 *      `z`. Moving the estimator re-miscalibrates unless B moves with it, so a
 *      naive swap measures staleness in B, not information in M.
 *   2. RMSE on a volatility forecast is NOT Brier on outcomes. A better vol
 *      forecast is not automatically a better probability, and the probability
 *      is the product.
 *
 * This script removes reason 2 and controls for reason 1. It is the measurement
 * the S40 handoff named as the gate on shipping the change.
 *
 * PROTOCOL — HANDOFF.md, "Methodological warning", verbatim:
 *   70/30 split BY SESSION DATE; refit B per variant on TRAIN only; evaluate on
 *   TEST only; paired bootstrap CLUSTERED BY SESSION (14 minutes inside one
 *   session are correlated — clustering by row shrinks error bars ~4x and
 *   manufactures significance).
 *
 * And the standing decision rule from the same section, which this script
 * applies rather than leaving to the reader:
 *   |dBrier| < 0.0002 between near-duplicate models is NOISE regardless of how
 *   thin the CI is. That band is why the momentum claim was withdrawn even
 *   though its arithmetic held.
 *
 * BOTH VARIANTS ARE REPORTED TWO WAYS, because they answer different questions:
 *   - vol-forecast skill: does the estimator predict the next session's
 *     realised volatility? (this is what S40 measured)
 *   - Brier on outcomes:  does that translate into a better probability?
 *     (this is what was never measured, and the only one that decides shipping)
 *
 * A gain on the first with nothing on the second means the vol forecast is
 * genuinely better and the model cannot use it — which would be a real finding,
 * not a null result.
 *
 * THE TWO VARIANTS
 *   shipped   r_j = |finalDelta_j| / (HOUR_SIGMA[hr_j] * sqrt(SUM_SHAPE2) * 0.798)
 *   perMin    r_j = rmsPerMinute_j / HOUR_SIGMA[hr_j]
 * where rmsPerMinute_j is the RMS of the 14 per-minute moves. HOUR_SIGMA and
 * sigmaCur are both per-minute unit vols, so the second needs no shape factor
 * and no 0.798 mean-absolute correction — it is already in the right units.
 * Everything downstream of r is identical: rolling median over the last 12
 * resolved sessions, clamp [0.5, 2.5], inert below 4 samples. Exactly mult().
 *
 * Read-only. Re-fits B for measurement ONLY and writes nothing back. The
 * shipped artifact is untouched by this file.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.mbrier.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length;
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit'
}).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* realised per-minute RMS for each session — the truth both estimators try to
   forecast, and the input the perMin variant is built from. */
const rms = [];
for (let i = 0; i < N; i++) {
  let acc = 0, prev = 0;
  for (let k = 1; k <= 14; k++) { const mv = S[i][k] - prev; prev = S[i][k]; acc += mv * mv; }
  rms.push(Math.sqrt(acc / 14));
}

const ratio = {
  shipped: (j) => { const den = D.HOUR_SIGMA[HRS[j]] * Math.sqrt(D.SUM_SHAPE2) * 0.798; return den > 0 ? Math.abs(fin(j)) / den : null; },
  perMin:  (j) => { const den = D.HOUR_SIGMA[HRS[j]]; return den > 0 ? rms[j] / den : null; },
};

/* mult() verbatim, parameterised only by which ratio feeds it. */
const buildM = (which) => {
  const f = ratio[which], out = new Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    const r = [];
    for (let j = i - 1; j >= 0 && r.length < 12; j--) { const v = f(j); if (v != null) r.push(v); }
    out[i] = r.length < 4 ? 1 : clamp(med(r), 0.5, 2.5);
  }
  return out;
};

/* z is independent of B, so precompute once per variant and fit B on top. */
const replay = (Mvec) => {
  const rows = [];
  for (let i = 0; i < N; i++) {
    const f = fin(i);
    if (f === 0) continue;
    const trail = D.HOUR_SIGMA[HRS[i]] * Mvec[i];
    let acc = 0, prev = 0;
    for (let k = 1; k <= 14; k++) {
      const d = S[i][k], mv = d - prev; prev = d;
      acc += mv * mv;
      const sigmaUnit = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
      const sigmaRem = sigmaUnit * Math.sqrt(D.REMVAR[k - 1]);
      if (!(sigmaRem > 0)) continue;
      rows.push({ i, k, z: d / sigmaRem, y: f > 0 ? 1 : 0 });
    }
  }
  return rows;
};

const brier = (rows, B) => {
  let s = 0;
  for (const r of rows) { const p = 1 / (1 + Math.exp(-(B * r.z))); s += (p - r.y) * (p - r.y); }
  return s / rows.length;
};
const logloss = (rows, B) => {
  let s = 0;
  for (const r of rows) {
    const p = Math.min(1 - 1e-12, Math.max(1e-12, 1 / (1 + Math.exp(-(B * r.z)))));
    s -= r.y ? Math.log(p) : Math.log(1 - p);
  }
  return s / rows.length;
};
/* coarse-then-fine grid; B is one dimension and monotone-ish, so this is exact
   to 1e-4 and leaves no optimiser behaviour to argue about. */
const fitB = (rows) => {
  let lo = 0.2, hi = 6.0;
  for (let pass = 0; pass < 5; pass++) {
    const step = (hi - lo) / 60; let best = lo, bv = Infinity;
    for (let B = lo; B <= hi + 1e-9; B += step) { const v = logloss(rows, B); if (v < bv) { bv = v; best = B; } }
    lo = Math.max(0.2, best - step); hi = Math.min(6.0, best + step);
  }
  return (lo + hi) / 2;
};

const CUT = Math.floor(N * 0.7);
const VAR = ['shipped', 'perMin'];
const fitted = {}, rowsOf = {};

console.log(`Replay of ${N.toLocaleString()} baked sessions (${D.META.span})`);
console.log(`Split by session date: train = 0-${CUT - 1}, test = ${CUT}-${N - 1}\n`);

/* ---------- 1. does the estimator forecast next-session vol at all? ----- */
console.log('=== 1. VOL-FORECAST SKILL (what S40 measured) ===\n');
console.log('  Spearman rank correlation, M_i vs realised per-minute RMS of session i.');
console.log('  Test half only. Higher is better.\n');
const spearman = (a, b) => {
  const rank = (v) => { const idx = [...v.keys()].sort((p, q) => v[p] - v[q]); const r = new Array(v.length);
    for (let n = 0; n < idx.length;) { let m = n; while (m + 1 < idx.length && v[idx[m + 1]] === v[idx[n]]) m++;
      const avg = (n + m) / 2 + 1; for (let t = n; t <= m; t++) r[idx[t]] = avg; n = m + 1; } return r; };
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - mb; num += x * y; da += x * x; db += y * y; }
  return num / Math.sqrt(da * db);
};
for (const v of VAR) {
  const M = buildM(v); fitted[v] = M;
  const idx = [...Array(N).keys()].filter((i) => i >= CUT && fin(i) !== 0);
  const r = spearman(idx.map((i) => M[i]), idx.map((i) => rms[i]));
  console.log('  ' + v.padEnd(10) + 'rho = ' + r.toFixed(4) + '   (n = ' + idx.length.toLocaleString() + ' sessions)');
}

/* ---------- 2. Brier, with B refit per variant on train only ------------ */
console.log('\n=== 2. BRIER ON OUTCOMES (what was never measured, and decides it) ===\n');
for (const v of VAR) rowsOf[v] = replay(fitted[v]);
const trainOf = {}, testOf = {}, Bof = {};
for (const v of VAR) {
  trainOf[v] = rowsOf[v].filter((r) => r.i < CUT);
  testOf[v] = rowsOf[v].filter((r) => r.i >= CUT);
  Bof[v] = fitB(trainOf[v]);
}
console.log('  variant     B (refit on train)    test Brier     test logloss      reads');
for (const v of VAR) {
  console.log('  ' + v.padEnd(12) + Bof[v].toFixed(4).padStart(14) + '   ' +
    brier(testOf[v], Bof[v]).toFixed(6).padStart(12) + '   ' +
    logloss(testOf[v], Bof[v]).toFixed(6).padStart(12) + '   ' +
    testOf[v].length.toLocaleString().padStart(8));
}
console.log('\n  For reference, the shipped constant is B = 1.49, fitted on all 2,688');
console.log('  sessions. The refits above use the train half only, per protocol.');
console.log('  Naive swap (perMin z scored with the shipped B = 1.49), the thing rule 2');
console.log('  warns against: test Brier ' + brier(testOf.perMin, 1.49).toFixed(6) +
  '  vs shipped-at-1.49 ' + brier(testOf.shipped, 1.49).toFixed(6));

/* ---------- 3. paired bootstrap, clustered by session ------------------- */
console.log('\n=== 3. PAIRED BOOTSTRAP, CLUSTERED BY SESSION (4,000 resamples) ===\n');
const bySess = new Map();
for (let n = 0; n < testOf.shipped.length; n++) {
  const r = testOf.shipped[n];
  if (!bySess.has(r.i)) bySess.set(r.i, { shipped: [], perMin: [] });
  bySess.get(r.i).shipped.push(r);
}
for (const r of testOf.perMin) { if (bySess.has(r.i)) bySess.get(r.i).perMin.push(r); }
const groups = [...bySess.values()];
const sq = (rows, B) => { let s = 0; for (const r of rows) { const p = 1 / (1 + Math.exp(-(B * r.z))); s += (p - r.y) * (p - r.y); } return s; };
const rand = rng(20260808);
const deltas = [];
for (let b = 0; b < 4000; b++) {
  let sA = 0, sB = 0, nA = 0, nB = 0;
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[(rand() * groups.length) | 0];
    sA += sq(grp.shipped, Bof.shipped); nA += grp.shipped.length;
    sB += sq(grp.perMin, Bof.perMin); nB += grp.perMin.length;
  }
  if (nA && nB) deltas.push(sB / nB - sA / nA);
}
deltas.sort((a, b) => a - b);
const dPoint = brier(testOf.perMin, Bof.perMin) - brier(testOf.shipped, Bof.shipped);
const dLo = deltas[Math.floor(0.025 * deltas.length)], dHi = deltas[Math.floor(0.975 * deltas.length)];
console.log('  dBrier (perMin - shipped) on test: ' + (dPoint >= 0 ? '+' : '−') + Math.abs(dPoint).toFixed(6));
console.log('  95% CI clustered by session:       [' + (dLo >= 0 ? '+' : '−') + Math.abs(dLo).toFixed(6) +
  ', ' + (dHi >= 0 ? '+' : '−') + Math.abs(dHi).toFixed(6) + ']');
console.log('  (negative favours perMin — Brier is a loss)');

/* ---------- 4. the standing decision rule ------------------------------- */
console.log('\n=== 4. VERDICT under the standing |dBrier| < 0.0002 rule ===\n');
const crossesZero = dLo <= 0 && dHi >= 0;
if (Math.abs(dPoint) < 0.0002) {
  console.log('  |dBrier| = ' + Math.abs(dPoint).toFixed(6) + ' < 0.0002 => NOISE BAND.');
  console.log('  Per HANDOFF.md this is "no effect" however thin the CI is. DO NOT SHIP.');
} else if (crossesZero) {
  console.log('  |dBrier| = ' + Math.abs(dPoint).toFixed(6) + ' clears the noise band, but the');
  console.log('  clustered CI spans zero. Not established. DO NOT SHIP on this evidence.');
} else {
  console.log('  |dBrier| = ' + Math.abs(dPoint).toFixed(6) + ' clears the noise band and the CI');
  console.log('  excludes zero, favouring ' + (dPoint < 0 ? 'perMin' : 'the shipped estimator') + '.');
  console.log('  This is the first of the two gates in the S40 handoff. The second is');
  console.log('  independent replication — a second implementation from the spec, not a');
  console.log('  re-run of this file.');
}
console.log('\n  IN-SAMPLE at the dataset layer: both variants see the same 2,688 sessions,');
console.log('  and B is refit within them. The split is out-of-sample in TIME, not in regime');
console.log('  — 28 days, Jul 8 - Aug 4 2026, one regime.');
