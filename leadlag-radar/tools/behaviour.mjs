#!/usr/bin/env node
// Behaviour tests for leadlag-radar. Zero dependencies. Run from repo root:
//   node leadlag-radar/tools/behaviour.mjs
// Extracts the <script id="engine-js"> block out of index.html and drives the
// REAL engine — the same code the browser runs. Same discipline as
// btc-session-edge-v3/tools/behaviour.mjs.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="engine-js">([\s\S]*?)<\/script>/);
if (!m) { console.error('FATAL: engine-js block not found'); process.exit(1); }
const Engine = new Function(m[1] + '\n;return Engine;')();

let pass = 0, fail = 0;
function ok(cond, name, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
function approx(a, b, tol, name) {
  ok(Math.abs(a - b) <= tol, name, `got ${a}, want ${b} ±${tol}`);
}

/* ---------- 1. normal distribution ---------- */
{
  approx(Engine.normCdf(0), 0.5, 1e-9, 'normCdf(0)=0.5');
  approx(Engine.normCdf(1.959964), 0.975, 1e-4, 'normCdf(1.96)≈0.975');
  approx(Engine.normCdf(-1.959964), 0.025, 1e-4, 'normCdf(-1.96)≈0.025');
  approx(Engine.normCdf(3), 0.99865, 1e-4, 'normCdf(3)');
}

/* ---------- 2. wilson ---------- */
{
  const w = Engine.wilson(8, 10);
  ok(w.lo > 0.4 && w.lo < 0.55 && w.hi > 0.9, 'wilson(8/10) sane', JSON.stringify(w));
  const z = Engine.wilson(0, 0);
  ok(z.lo === 0 && z.hi === 1, 'wilson(0/0) = [0,1]');
}

/* ---------- 3. SecondSeries ---------- */
{
  const s = new Engine.SecondSeries(10);
  s.push(1000_000, 100); s.push(1000_400, 101); // same second → overwrite
  ok(s.size() === 1 && s.lastPrice() === 101, 'same-second overwrite keeps last');
  s.push(1001_000, 102); s.push(1003_000, 104); // gap at 1002
  ok(s.size() === 3, 'gap does not fabricate a row');
  ok(s.priceAtOrBefore(1002) === 102, 'priceAtOrBefore spans gap backward');
  ok(s.priceAtOrBefore(999) === null, 'priceAtOrBefore before series → null');
  s.push(1002_500, 999); // out of order — ignored
  ok(s.lastT() === 1003 && s.lastPrice() === 104, 'out-of-order second ignored');
  const r = s.returns1s();
  ok(r.t.length === 1 && r.t[0] === 1001, 'returns only from consecutive seconds (gap skipped)');
  approx(r.r[0], Math.log(102 / 101), 1e-12, '1s log return value');
  // capacity trim
  for (let i = 0; i < 20; i++) s.push((1010 + i) * 1000, 100 + i);
  ok(s.size() === 10, 'capacity respected');
}

/* ---------- 4. windowAverage ---------- */
{
  const s = new Engine.SecondSeries();
  for (let t = 100; t < 160; t++) s.push(t * 1000, 200 + (t - 100));
  const w = s.windowAverage(130, 159);
  approx(w.avg, (230 + 259) / 2, 1e-9, 'windowAverage arithmetic');
  ok(w.nSeconds === 30 && w.coverage === 1, 'windowAverage coverage full');
  const partial = s.windowAverage(150, 209);
  approx(partial.coverage, 10 / 60, 1e-9, 'windowAverage partial coverage');
}

/* ---------- 4b. settlementAverage (carry-forward, the settlement rule) ---------- */
{
  const s = new Engine.SecondSeries();
  // dense window: identical to a plain mean
  for (let t = 100; t < 160; t++) s.push(t * 1000, 200 + (t - 100));
  const dense = s.settlementAverage(100, 159);
  approx(dense.avg, (200 + 259) / 2, 1e-9, 'settlementAverage dense = plain mean');
  ok(dense.coverage === 1 && dense.observedFrac === 1 && dense.worstCarry === 0, 'dense window fully observed');

  // sparse window: a price that ticks once then goes quiet still fills the window
  const q = new Engine.SecondSeries();
  q.push(1000 * 1000, 50);
  q.push(1010 * 1000, 60);
  const sparse = q.settlementAverage(1000, 1019);
  // seconds 1000-1009 carry 50, 1010-1019 carry 60
  approx(sparse.avg, (50 * 10 + 60 * 10) / 20, 1e-9, 'settlementAverage carries a quiet tape forward');
  ok(sparse.coverage === 1, 'carry fills every second of the window');
  approx(sparse.observedFrac, 2 / 20, 1e-9, 'observedFrac reports true tick density');
  ok(sparse.worstCarry === 9, 'worstCarry reports the longest stale stretch');

  // seed from just before the window (5s stale — within the 30s guard)
  const seeded = new Engine.SecondSeries();
  seeded.push(995 * 1000, 7);
  const sd = seeded.settlementAverage(1000, 1009);
  approx(sd.avg, 7, 1e-9, 'window seeds from the last price before it opened');
  ok(sd.observed === 0 && sd.coverage === 1, 'seeded window has zero in-window ticks but full coverage');
  ok(sd.worstCarry === 14, 'worstCarry counts age from the seed tick');

  // too stale to stand behind: a seed 100s before the window
  const stale = new Engine.SecondSeries();
  stale.push(900 * 1000, 7);
  ok(stale.settlementAverage(1000, 1009, 30) === null, 'carry beyond maxCarrySec returns null');
  ok(stale.settlementAverage(1000, 1009, 200) !== null, 'generous maxCarrySec allows the same window');

  // no data at all
  ok(new Engine.SecondSeries().settlementAverage(0, 59) === null, 'empty series → null');
}

/* ---------- 4c. atOrBefore returns the timestamp too ---------- */
{
  const s = new Engine.SecondSeries();
  s.push(500 * 1000, 10); s.push(520 * 1000, 11);
  const e = s.atOrBefore(519);
  ok(e.t === 500 && e.p === 10, 'atOrBefore returns {t,p} of the carrying row');
  ok(s.atOrBefore(499) === null, 'atOrBefore before series → null');
  ok(s.priceAtOrBefore(519) === 10, 'priceAtOrBefore still works');
}

/* ---------- 5. TickTape ---------- */
{
  const t = new Engine.TickTape(10_000);
  ok(t.moveOver(1000, 5000) === null, 'empty tape → null move');
  t.push(1000, 100); t.push(1500, 100.5); t.push(2000, 101);
  approx(t.moveOver(1000, 2000), 101 / 100 - 1, 1e-12, 'moveOver picks tick at window start');
  ok(t.moveOver(5000, 2000) === null, 'window reaching before tape start → null');
  t.push(20000, 102); // tape trims to capMs
  ok(t.t[0] >= 10000, 'tape trimmed to capacity');
}

/* ---------- 6. VolEstimator ---------- */
{
  const v = new Engine.VolEstimator(300);
  ok(v.sigma1s() === null, 'cold vol → null');
  for (let i = 0; i < 200; i++) v.update(0.001 * (i % 2 === 0 ? 1 : -1));
  approx(v.sigma1s(), 0.001, 1e-4, 'constant |r| converges to |r|');
  const before = v.sigma1s();
  v.update(0.5); // absurd print — winsorized to 8σ
  ok(v.sigma1s() < before * 1.5, 'winsorization caps a wild print', `σ ${before} → ${v.sigma1s()}`);
}

/* ---------- 7. xcorr recovers a known lag ---------- */
{
  const rng = Engine.makeRng(7), gauss = Engine.makeGauss(rng);
  const N = 1200, LAG = 4;
  const lead = { t: [], r: [] }, foll = { t: [], r: [] };
  const buf = [];
  for (let t = 0; t < N; t++) {
    const rl = gauss();
    buf.push(rl);
    lead.t.push(t); lead.r.push(rl);
    const src = buf.length > LAG ? buf[buf.length - 1 - LAG] : 0;
    foll.t.push(t); foll.r.push(0.8 * src + 0.3 * gauss());
  }
  const x = Engine.xcorr(lead, foll, 15, 1000);
  ok(x.bestLag === LAG, `xcorr recovers lag ${LAG}`, `got ${x.bestLag}`);
  ok(x.bestCorr > 0.8, 'xcorr strength high on synthetic', String(x.bestCorr));
  ok(x.significant === true, 'xcorr significance flag');
  // independent series → nothing significant
  const ind = { t: [], r: [] };
  for (let t = 0; t < N; t++) { ind.t.push(t); ind.r.push(gauss()); }
  const x2 = Engine.xcorr(lead, ind, 15, 1000);
  ok(Math.abs(x2.bestCorr) < 0.15, 'independent series → weak best corr', String(x2.bestCorr));
}

/* ---------- 8. impulseZ ---------- */
{
  approx(Engine.impulseZ(0.003, 0.001, 9), 1.0, 1e-9, 'impulse z = move/(σ√w)');
  ok(Engine.impulseZ(null, 0.001, 9) === null, 'impulse null-safe');
  ok(Engine.impulseZ(0.003, 0, 9) === null, 'impulse needs σ>0');
}

/* ---------- 9. fairProb analytic properties ---------- */
{
  // point mode = plain Brownian
  const a = Engine.fairProb({ spot: 100, strike: 100, sigma1s: 0.001, tRemainSec: 400, settleMode: 'point' });
  approx(a.p, 0.5, 1e-9, 'ATM point-mode p=0.5');
  const b = Engine.fairProb({ spot: 101, strike: 100, sigma1s: 0.001, tRemainSec: 400, settleMode: 'point' });
  approx(b.p, Engine.normCdf(1 / (0.001 * 101 * 20)), 1e-9, 'point-mode matches Φ((S−K)/σS√τ)');
  // avg mode outside window = reduced-time point mode
  const c = Engine.fairProb({ spot: 101, strike: 100, sigma1s: 0.001, tRemainSec: 400, settleMode: 'avg', settleWindowSec: 60 });
  const cRef = Engine.fairProb({ spot: 101, strike: 100, sigma1s: 0.001, tRemainSec: 400 - 60 + 20, settleMode: 'point' });
  approx(c.p, cRef.p, 1e-9, 'avg-mode pre-window = point mode with τ−w+w/3');
  // inside window with observed average → variance collapses monotonically
  const pMid = Engine.fairProb({ spot: 100.5, strike: 100, sigma1s: 0.001, tRemainSec: 30, settleMode: 'avg', settleWindowSec: 60, avgSoFar: 100.4 });
  const pLate = Engine.fairProb({ spot: 100.5, strike: 100, sigma1s: 0.001, tRemainSec: 5, settleMode: 'avg', settleWindowSec: 60, avgSoFar: 100.45 });
  ok(pLate.sd < pMid.sd, 'observed-average variance shrinks toward expiry');
  ok(pLate.p > pMid.p, 'certainty grows when mean stays above strike');
  // τ=0 with avg observed → degenerate
  const done = Engine.fairProb({ spot: 100.5, strike: 100, sigma1s: 0.001, tRemainSec: 0, settleMode: 'avg', settleWindowSec: 60, avgSoFar: 100.45 });
  ok(done.p === 1, 'τ=0 avg>strike → p=1');
}

/* ---------- 10. fairProb vs Monte Carlo (the load-bearing test) ---------- */
{
  // Simulate driftless BM in price space; settlement = mean of the final 60
  // per-second prices. Check fairProb at three standpoints:
  //   (a) 600s out (pre-window), (b) 30s out with observed running average,
  //   (c) 30s out withOUT the running average (re-widening formula).
  const sigma1s = 0.0008, S0 = 100, K = 100.15, T = 600, W = 60;
  const PATHS = 20000;
  const rng = Engine.makeRng(2026), gauss = Engine.makeGauss(rng);
  const sAbs = sigma1s * S0; // constant absolute vol — matches engine's local assumption
  let hitA = 0, hitB = 0, sumPb = 0, sumPc = 0;
  for (let p = 0; p < PATHS; p++) {
    let s = S0;
    const path = new Float64Array(T + 1); path[0] = s;
    for (let t = 1; t <= T; t++) { s += sAbs * gauss(); path[t] = s; }
    let settle = 0; for (let t = T - W + 1; t <= T; t++) settle += path[t];
    settle /= W;
    if (settle > K) hitA++;
    // standpoint (b): t = T−30 (30s remain, 30 of 60 window seconds observed)
    const tb = T - 30;
    let avgObs = 0; for (let t = T - W + 1; t <= tb; t++) avgObs += path[t];
    avgObs /= (tb - (T - W));
    const fb = Engine.fairProb({ spot: path[tb], strike: K, sigma1s, tRemainSec: 30, settleMode: 'avg', settleWindowSec: W, avgSoFar: avgObs });
    sumPb += (settle > K) === (fb.p > 0.5) ? 1 : 0; // direction agreement
    const fc = Engine.fairProb({ spot: path[tb], strike: K, sigma1s, tRemainSec: 30, settleMode: 'avg', settleWindowSec: W });
    sumPc += fc.p;
    if (p === 0) {
      // sanity: with avg observed, sd = σ·S_t·sqrt(W·(1/2)^3/3) — the engine
      // scales by CURRENT spot (local vol), not the path's start price
      approx(fb.sd, sigma1s * path[tb] * Math.sqrt(W * 0.125 / 3), 1e-9, 'in-window sd formula (observed avg)');
    }
  }
  const pA = Engine.fairProb({ spot: S0, strike: K, sigma1s, tRemainSec: T, settleMode: 'avg', settleWindowSec: W });
  approx(hitA / PATHS, pA.p, 0.011, `MC pre-window: empirical ${hitA / PATHS} vs model ${pA.p.toFixed(4)}`);
  ok(sumPb / PATHS > 0.85, 'in-window observed-avg calls direction right >85%', String(sumPb / PATHS));
  // calibration of (b): bucket predicted p vs realized — rough single check
  // (full calibration is the tool's own job at runtime)
  ok(sumPc / PATHS > 0.3 && sumPc / PATHS < 0.7, 'no-avg in-window p not degenerate', String(sumPc / PATHS));
}

/* ---------- 11. fee + edge ---------- */
{
  approx(Engine.feeTaker(0.5), 0.02, 1e-9, 'fee at 50c = ceil(1.75c) = 2c');
  approx(Engine.feeTaker(0.05), 0.01, 1e-9, 'fee at 5c rounds up to 1c');
  ok(Engine.feeTaker(0) === 0 && Engine.feeTaker(1) === 0, 'fee edge cases');
  approx(Engine.edgeAfterFees(0.62, 0.55), 0.62 - 0.55 - 0.02, 1e-9, 'edge = p − price − fee');
  ok(Engine.edgeAfterFees(null, 0.5) === null, 'edge null-safe');
}

/* ---------- 12. signal lifecycle + calibration ---------- */
{
  const sigs = [];
  // ten impulse signals on NEAR: six correct, three wrong, one flat
  const px = new Engine.SecondSeries();
  for (let t = 0; t <= 100; t += 1) px.push(t * 1000, 1.0 + (t >= 50 ? 0.01 : 0)); // step up at t=50
  const mk = (id, tMs, dir, p) => Engine.makeSignal({ id, tMs, asset: 'NEAR', kind: 'impulse', dir, p, horizonSec: 10, refPrice: px.priceAtOrBefore(Math.floor(tMs / 1000)) });
  sigs.push(mk('a', 45_000, +1, 0.8));  // ref 1.0, due 55 → 1.01 → up → hit
  sigs.push(mk('b', 46_000, -1, 0.7));  // due 56 → up → miss
  sigs.push(mk('c', 80_000, +1, 0.9));  // ref 1.01, due 90 → 1.01 → flat
  const priceAt = (asset, tSec) => px.priceAtOrBefore(tSec);
  const n1 = Engine.resolveSignals(sigs, priceAt, 54); // nothing due yet at 54
  ok(n1 === 0 && !sigs[0].resolved, 'resolver waits for due time');
  const n2 = Engine.resolveSignals(sigs, priceAt, 200);
  ok(n2 === 3, 'resolver settles all due');
  ok(sigs[0].outcome === 1 && sigs[1].outcome === 0, 'hit/miss classified');
  ok(sigs[2].flat === true && sigs[2].outcome === null, 'flat excluded');
  const stats = Engine.hitStats(sigs);
  ok(stats.n === 2 && stats.hits === 1, 'hitStats counts non-flat resolved');
  const table = Engine.calibTable(sigs, 0.1);
  const band8 = table.find(r => r.lo <= 0.8 && 0.8 < r.hi);
  ok(band8.n === 1 && band8.hits === 1, 'calib table bands by p');
  const bs = Engine.brierScore(sigs);
  approx(bs, ((0.8 - 1) ** 2 + (0.7 - 0) ** 2) / 2, 1e-9, 'brier over resolved non-flat');
  // edge-kind resolution vs strike
  const e = Engine.makeSignal({ id: 'e', tMs: 40_000, asset: 'NEAR', kind: 'edge', dir: +1, p: 0.75, horizonSec: 20, refPrice: 1.0, strike: 1.005 });
  Engine.resolveSignals([e], priceAt, 200);
  ok(e.outcome === 1, 'edge signal resolves vs strike');
  // edge-kind prefers the settlement average when provided
  const e2 = Engine.makeSignal({ id: 'e2', tMs: 40_000, asset: 'NEAR', kind: 'edge', dir: +1, p: 0.75, horizonSec: 20, refPrice: 1.0, strike: 1.005, meta: { fair: 0.75, mkt: 0.6 } });
  Engine.resolveSignals([e2], priceAt, 200, 0.0001, (asset, tSec) => 1.001); // avg below strike
  ok(e2.outcome === 0 && e2.outPrice === 1.001, 'edge signal uses settleAt average when given');
  ok(e2.meta && e2.meta.mkt === 0.6, 'meta passthrough survives');
  // impulse kinds never use settleAt
  const i2 = Engine.makeSignal({ id: 'i2', tMs: 45_000, asset: 'NEAR', kind: 'impulse', dir: +1, p: null, horizonSec: 10, refPrice: 1.0 });
  Engine.resolveSignals([i2], priceAt, 200, 0.0001, () => { throw new Error('settleAt must not be called for impulse'); });
  ok(i2.outcome === 1, 'impulse resolution ignores settleAt');
  // CSV
  const csv = Engine.signalsToCsv([...sigs, e2]);
  ok(csv.split('\n').length === 5 && csv.startsWith('id,'), 'csv shape');
  ok(csv.split('\n')[0].split(',').length === 16, 'csv 16 columns');
  ok(csv.includes('""mkt""'), 'meta json escaped into csv');
}

/* ---------- 13. sim: deterministic + xcorr recovers built-in lags ---------- */
{
  const t1 = Engine.makeSim(42), t2 = Engine.makeSim(42);
  const a = t1(), b = t2();
  ok(Math.abs(a.NEAR - b.NEAR) < 1e-12, 'sim deterministic under same seed');
  // run 25 sim minutes, feed SecondSeries, xcorr BTC→NEAR must find lag 5
  const sim = Engine.makeSim(1234);
  const btc = new Engine.SecondSeries(4000), near = new Engine.SecondSeries(4000);
  for (let t = 0; t < 1500; t++) {
    const px = sim();
    btc.push(t * 1000, px.BTC); near.push(t * 1000, px.NEAR);
  }
  const x = Engine.xcorr(btc.returns1s(), near.returns1s(), 15, 1200);
  ok(x.bestLag === Engine.SIM_SPEC.NEAR.lag, `sim end-to-end: xcorr finds NEAR lag ${Engine.SIM_SPEC.NEAR.lag}`, `got ${x.bestLag} (corr ${x.bestCorr.toFixed(3)})`);
  ok(x.significant, 'sim lag significant');
}

console.log(`\nleadlag-radar behaviour: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
