/* Is there edge in the probability alone? Replay the shadow pipeline over
 * every baked session and score it band by band.
 *
 *   node btc-session-edge-v3/analysis/calibration-replay.mjs   (from repo root)
 *
 * Terry, S40, after 15 live shadow sessions: "what do you do with the 60s, or
 * do we divide the 60s between +/- 65? Need more data here."
 *
 * The live log had 209 reads across 15 sessions — nowhere near enough to split
 * a band. The baked dataset has 2,688 sessions, so replaying the exact
 * shadowRead() pipeline over it yields ~37k reads and answers it directly.
 *
 * WHAT THIS REPLICATES — shadowRead() (src/app.html), not read():
 *   strike     = the session OPEN, so delta at minute k is SESS[i][k]
 *   net        = null   (shadow hard-codes it; see defect 11)
 *   settleAvg  = true
 *   sigmaUnit  = 0.6 * (HOUR_SIGMA[hr] * M) + 0.4 * sigmaCur
 *   M          = median over the last 12 resolved sessions of
 *                |finalDelta| / (HOUR_SIGMA[hr] * sqrt(SUM_SHAPE2) * 0.798),
 *                clamped [0.5, 2.5], inert below 4 — exactly mult()
 *   sigmaCur   = RMS of |dPrice| / sqrt(dMinutes) over the chain so far,
 *                NOT shape-normalised — exactly sigmaFromPts()
 *   B          = 1.49
 *   remVar     = remVarAt(k, sec=0, settleAvg=true), which is REMVAR[k-1]
 *
 * THE RESULT, and it is the important one: the model is calibrated to within
 * about a point in every band, and after Kalshi's taker fee EVERY band sits
 * between -1.8pp and +0.2pp of breakeven. There is no profitable confidence
 * band, no useful split of the 60s, and no filter over the probability that
 * beats fees. A calibrated model betting at its own price is a slow loss —
 * that is what calibration means. Only a gap against Kalshi's actual quoted
 * price can pay, which is what the GAP tab exists to measure.
 *
 * CAVEAT, stated loudly: this is IN-SAMPLE. B = 1.49 was fitted on these same
 * 2,688 sessions, so near-perfect calibration is partly what fitting produces.
 * It does not prove the model is calibrated on future data. It does remove any
 * basis for claiming an edge — an edge would have to show up here first.
 *
 * Read-only. Imports nothing from the artifact and re-fits nothing.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.replay.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length, B = 1.49, STAKE = 10;
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit'
}).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];
/* Kalshi taker fee in dollars per contract, same rounding as ceilings(). */
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
const wil = (k, n) => { const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n, c = p + z2 / (2 * n),
  m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n); return [100 * (c - m) / d, 100 * (c + m) / d]; };

const reads = [];
for (let i = 0; i < N; i++) {
  const f = fin(i);
  if (f === 0) continue;                       /* flat: never resolves U or D */
  const r = [];
  for (let j = i - 1; j >= 0 && r.length < 12; j--) {
    const den = D.HOUR_SIGMA[HRS[j]] * Math.sqrt(D.SUM_SHAPE2) * 0.798;
    if (den > 0) r.push(Math.abs(fin(j)) / den);
  }
  const M = r.length < 4 ? 1 : clamp(med(r), 0.5, 2.5);
  const trail = D.HOUR_SIGMA[HRS[i]] * M;
  let acc = 0, prev = 0;
  for (let k = 1; k <= 14; k++) {
    const d = S[i][k], mv = d - prev; prev = d;
    acc += mv * mv;                            /* consecutive minutes, so dm = 1 */
    const sigmaUnit = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
    const sigmaRem = sigmaUnit * Math.sqrt(D.REMVAR[k - 1]);
    if (!(sigmaRem > 0)) continue;
    const p = 1 / (1 + Math.exp(-(B * (d / sigmaRem))));
    reads.push({ k, conf: Math.round(100 * Math.max(p, 1 - p)), won: (p >= 0.5) === (f > 0) });
  }
}

console.log('Replay of ' + N.toLocaleString() + ' baked sessions (' + D.META.span + ') -> ' +
  reads.length.toLocaleString() + ' reads\n');
console.log('  band       bets     won    rate   [95% CI]    breakeven    edge    per $1');
for (const [lo, hi] of [[50,55],[55,60],[60,65],[65,70],[70,75],[75,80],[80,85],[85,90],[90,95],[95,101]]) {
  const g = reads.filter((r) => r.conf >= lo && r.conf < hi);
  if (!g.length) continue;
  const w = g.filter((r) => r.won).length, rate = 100 * w / g.length, [cl, ch] = wil(w, g.length);
  const mid = g.reduce((a, r) => a + r.conf, 0) / g.length / 100, be = 100 * (mid + fee(mid));
  const pl = g.reduce((a, r) => { const p = r.conf / 100; return a + (r.won ? STAKE / (p + fee(p)) - STAKE : -STAKE); }, 0);
  console.log('  ' + (lo + '-' + (hi - 1) + '%').padEnd(10) + g.length.toLocaleString().padStart(6) +
    w.toLocaleString().padStart(8) + rate.toFixed(1).padStart(7) + '%  [' + cl.toFixed(0).padStart(2) + ',' +
    ch.toFixed(0).padStart(3) + ']' + be.toFixed(0).padStart(9) + '%  ' +
    ((rate - be) >= 0 ? '+' : '−') + Math.abs(rate - be).toFixed(1).padStart(4) + 'pp   ' +
    (pl >= 0 ? '+' : '−') + '$' + Math.abs(pl / (g.length * STAKE)).toFixed(3));
}
const w = reads.filter((r) => r.won).length;
const meanConf = reads.reduce((a, r) => a + r.conf, 0) / reads.length;
console.log('\n  overall: mean stated ' + meanConf.toFixed(1) + '%  vs  actual ' +
  (100 * w / reads.length).toFixed(1) + '%   (gap ' +
  ((100 * w / reads.length - meanConf) >= 0 ? '+' : '−') +
  Math.abs(100 * w / reads.length - meanConf).toFixed(1) + 'pp)');
console.log('  IN-SAMPLE — B was fitted on this data. See the header.');
