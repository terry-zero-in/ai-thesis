/* Which lookback interval actually predicts the next session?
 *
 *   node btc-session-edge-v3/analysis/interval-search.mjs   (from repo root)
 *
 * Terry, S41: "i can actually easily go back any amount easily. hours, 1-2
 * sessions etc all from the same screen so we need to find the interval thats
 * most accurate."
 *
 * The anchor is no longer constrained to whatever session happened to be logged
 * 75 minutes ago — he can read any lookback off the chart. So this is a clean
 * search: over L = 1..48 sessions (15 min .. 12 h), which L carries the most
 * signal about the NEXT session's direction?
 *
 * TWO FLAWS IN lookback-sweep.mjs THAT THIS FIXES. Both inflate the winner:
 *
 *   1. FIXED THRESHOLD. That sweep bucketed on |net| >= $80 at every L. Over
 *      one session $80 is a huge move; over 24 it is nothing, so the buckets
 *      were not comparable and long lookbacks were handicapped by construction.
 *      Here every L is scored by AUC, which is rank-based and therefore immune
 *      to scale, and the bucket tests use PERCENTILES of that L's own
 *      distribution rather than a dollar figure.
 *
 *   2. PICKED AND SCORED ON THE SAME DATA. Searching 48 intervals and reporting
 *      the best one guarantees an inflated number even if nothing predicts —
 *      the max of 48 noisy estimates is not an estimate of anything. So the
 *      search runs on the FIRST half only, and the winner is then scored once
 *      on the SECOND half, which it has never touched. The held-out number is
 *      the only one worth acting on.
 *
 * OVERLAP: consecutive net_L windows share L-1 sessions, so nearby rows are
 * correlated and naive intervals run narrow. Every headline is therefore also
 * reported on a NON-OVERLAPPING subsample (stride L), which costs sample size
 * and buys independence.
 *
 * Read-only. Re-fits nothing, changes no weights.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.isearch.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length;
const fin = (i) => S[i][15];
const netOver = (i, L) => { let s = 0; for (let j = i - L; j < i; j++) s += fin(j); return s; };
const LMAX = 48;

const wil = (k, n) => { if (!n) return [0, 100]; const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n,
  c = p + z2 / (2 * n), m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return [100 * (c - m) / d, 100 * (c + m) / d]; };

/* AUC via Mann-Whitney, ties at half credit. Predictor is -net (the fade view):
   AUC > 0.5 means a big DOWN move is followed by an UP session, i.e. it fades. */
function auc(pairs) {
  const pos = pairs.filter((p) => p.y).map((p) => p.x).sort((a, b) => a - b);
  const neg = pairs.filter((p) => !p.y).map((p) => p.x).sort((a, b) => a - b);
  if (!pos.length || !neg.length) return null;
  let i = 0, j = 0, acc = 0;
  const all = [...pairs].sort((a, b) => a.x - b.x);
  /* rank-sum form, average ranks over ties */
  let r = 0, sumPos = 0;
  while (r < all.length) {
    let e = r; while (e + 1 < all.length && all[e + 1].x === all[r].x) e++;
    const avg = (r + e) / 2 + 1;
    for (let k = r; k <= e; k++) if (all[k].y) sumPos += avg;
    r = e + 1;
  }
  const nP = pos.length, nN = neg.length;
  return (sumPos - nP * (nP + 1) / 2) / (nP * nN);
}

/* Rows for one lookback. stride>1 gives a non-overlapping subsample. */
function rows(L, lo, hi, stride = 1) {
  const out = [];
  for (let i = Math.max(L, lo); i < hi; i += stride) {
    const f = fin(i); if (f === 0) continue;
    out.push({ x: -netOver(i, L), y: f > 0 });   /* x = fade view */
  }
  return out;
}

/* Fade win rate in the extreme deciles of THIS L's own move distribution. */
function decileFade(rs, frac = 0.2) {
  const sorted = [...rs].sort((a, b) => a.x - b.x);
  const k = Math.max(10, Math.floor(sorted.length * frac));
  const bigUp = sorted.slice(0, k);           /* x most negative = biggest UP move */
  const bigDn = sorted.slice(-k);             /* x most positive = biggest DOWN move */
  const uw = bigUp.filter((p) => p.y).length, dw = bigDn.filter((p) => p.y).length;
  return { n: k, upRate: 100 * uw / k, dnRate: 100 * dw / k,
    upCI: wil(uw, k), dnCI: wil(dw, k), sep: 100 * dw / k - 100 * uw / k };
}

const HALF = Math.floor(N / 2);
console.log('Interval search — ' + N.toLocaleString() + ' sessions, ' + D.META.span);
console.log('Sessions are 15 min. Search on sessions 0-' + (HALF - 1) + ', hold out ' + HALF + '-' + (N - 1) + '.\n');

/* ---------- 1. the search, IN-SAMPLE (first half only) ---------- */
console.log('== 1. SEARCH (first half only) — AUC of fading the prior L-session move ==');
console.log('   AUC .500 = no information. Extreme-quintile fade separation in pp.\n');
console.log('   L   window     n      AUC     top/bottom quintile fade      separation');
const search = [];
for (let L = 1; L <= LMAX; L++) {
  const rs = rows(L, 0, HALF);
  if (rs.length < 200) continue;
  const a = auc(rs), d = decileFade(rs);
  search.push({ L, auc: a, sep: d.sep });
  const hrs = L * 15 >= 60 ? (L * 15 / 60).toFixed(1) + 'h' : L * 15 + 'm';
  if (L <= 12 || L % 4 === 0) {
    console.log('  ' + String(L).padStart(2) + hrs.padStart(8) + String(rs.length).padStart(7) +
      a.toFixed(3).padStart(9) + '   ' + d.upRate.toFixed(1).padStart(5) + '% / ' + d.dnRate.toFixed(1).padStart(5) + '%' +
      (d.sep >= 0 ? '+' : '') + d.sep.toFixed(1).padStart(14) + 'pp');
  }
}
const bestAuc = [...search].sort((a, b) => b.auc - a.auc)[0];
const bestSep = [...search].sort((a, b) => b.sep - a.sep)[0];
console.log('\n   best AUC in-sample: L=' + bestAuc.L + ' (' + bestAuc.L * 15 + ' min), AUC ' + bestAuc.auc.toFixed(3));
console.log('   best fade separation in-sample: L=' + bestSep.L + ' (' + bestSep.L * 15 + ' min), ' + bestSep.sep.toFixed(1) + 'pp');

/* ---------- 2. HOLD OUT. Score the in-sample winners once. ---------- */
console.log('\n== 2. HELD OUT (second half, never searched) ==');
console.log('   The only numbers here that mean anything.\n');
console.log('   pick           L    window      n      AUC    quintile fade      separation');
const picks = [...new Set([bestAuc.L, bestSep.L, 5, 1])];
const labels = { [bestAuc.L]: 'best AUC', [bestSep.L]: 'best separation', 5: 'px75 (current)', 1: 'last session' };
for (const L of picks) {
  const rs = rows(L, HALF, N);
  const a = auc(rs), d = decileFade(rs);
  const hrs = L * 15 >= 60 ? (L * 15 / 60).toFixed(1) + 'h' : L * 15 + 'm';
  console.log('   ' + (labels[L] || '').padEnd(16) + String(L).padStart(2) + hrs.padStart(9) +
    String(rs.length).padStart(7) + a.toFixed(3).padStart(9) + '   ' +
    d.upRate.toFixed(1).padStart(5) + '% / ' + d.dnRate.toFixed(1).padStart(5) + '%' +
    (d.sep >= 0 ? '+' : '') + d.sep.toFixed(1).padStart(12) + 'pp');
}

/* ---------- 3. does ANY interval beat chance out of sample? ---------- */
console.log('\n== 3. Every interval, held-out AUC — is any of this real? ==');
const held = [];
for (let L = 1; L <= LMAX; L++) {
  const rs = rows(L, HALF, N);
  if (rs.length < 200) continue;
  held.push({ L, auc: auc(rs) });
}
const hs = held.map((h) => h.auc);
const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
const sd = Math.sqrt(hs.reduce((a, b) => a + (b - mean) ** 2, 0) / hs.length);
const bestHeld = [...held].sort((a, b) => b.auc - a.auc)[0];
const worstHeld = [...held].sort((a, b) => a.auc - b.auc)[0];
console.log('   held-out AUC across all ' + held.length + ' intervals: mean ' + mean.toFixed(3) +
  ', sd ' + sd.toFixed(3));
console.log('   best  L=' + bestHeld.L + ' AUC ' + bestHeld.auc.toFixed(3) +
  '   worst L=' + worstHeld.L + ' AUC ' + worstHeld.auc.toFixed(3));
/* Rank correlation between the in-sample ranking and the held-out ranking. If
   the search found something structural, good intervals stay good. */
const common = search.filter((s) => held.some((h) => h.L === s.L));
const rank = (arr, key) => { const s = [...arr].sort((a, b) => b[key] - a[key]); const m = new Map();
  s.forEach((v, i) => m.set(v.L, i + 1)); return m; };
const rIn = rank(common, 'auc'), rOut = rank(held.filter((h) => rIn.has(h.L)), 'auc');
const ls = [...rIn.keys()];
const dm = ls.map((L) => rIn.get(L) - rOut.get(L));
const rho = 1 - 6 * dm.reduce((a, d) => a + d * d, 0) / (ls.length * (ls.length ** 2 - 1));
console.log('   Spearman rank correlation, in-sample vs held-out ordering: ' + rho.toFixed(3));
console.log('     (near 0 = the ranking did not carry over; the "best" interval was noise)');

/* ---------- 4. non-overlapping sanity check on the current setting ---------- */
console.log('\n== 4. Non-overlapping check (stride = L, so no shared sessions) ==');
console.log('   L    n     up-quintile / down-quintile      separation   [95% CI on separation]');
for (const L of [1, 2, 4, 5, 8, 12]) {
  const rs = rows(L, 0, N, L);
  if (rs.length < 60) continue;
  const d = decileFade(rs, 0.25);
  const se = Math.sqrt((d.upRate / 100) * (1 - d.upRate / 100) / d.n + (d.dnRate / 100) * (1 - d.dnRate / 100) / d.n) * 100;
  console.log('  ' + String(L).padStart(2) + String(rs.length).padStart(6) +
    d.upRate.toFixed(1).padStart(12) + '% / ' + d.dnRate.toFixed(1).padStart(5) + '%' +
    (d.sep >= 0 ? '+' : '') + d.sep.toFixed(1).padStart(13) + 'pp   [' +
    (d.sep - 1.96 * se).toFixed(1) + ', ' + (d.sep + 1.96 * se).toFixed(1) + ']');
}
console.log('\n  A separation whose interval spans 0 is not a tradeable interval, however');
console.log('  good it looked in the search.');
