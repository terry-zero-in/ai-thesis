/* Does the model look at up/down trend? And should it?
 *
 *   node btc-session-edge-v3/analysis/trend-signal.mjs      (run from repo root)
 *
 * Terry's question, S40: "IS our data even doing the equivalent of looking at
 * the up/down trends to estimate?" Two halves — what the code reads, and what
 * the data supports. This regenerates every number quoted in
 * docs/2026-08-07-S40-btc-edge-trend-signal-audit.md.
 *
 * No dependencies. Reads the dataset out of index.html's bundle manifest the
 * same way tools/behaviour.mjs does, so it can never drift from a fixture.
 *
 * Read-only. It does not import, patch, or re-fit anything the artifact ships.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.analysis.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length, SH = D.SHAPE, SS2 = D.SUM_SHAPE2;
/* SESS row = [ realised per-minute sigma x100, cumulative delta at minutes 1..15 ]. */
const fin = S.map((r) => r[15]);
const sig = S.map((r) => r[0] / 100);
/* Per-minute moves, recovered by differencing the cumulative path. */
const mv = S.map((r) => { const a = []; let p = 0; for (let k = 1; k <= 15; k++) { a.push(r[k] - p); p = r[k]; } return a; });
const hr = (i) => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour12: false, hour: '2-digit' })
  .format(new Date((D.META.start + i * 900) * 1000)) % 24;

const wil = (k, n) => { if (!n) return [0, 0];
  const z = 1.96, p = k / n, z2 = z * z, den = 1 + z2 / n, c = p + z2 / (2 * n), m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return [(c - m) / den, (c + m) / den]; };
const pct = (x) => (100 * x).toFixed(1) + '%';
const row = (label, k, n) => { const [lo, hi] = wil(k, n);
  console.log('  ' + label.padEnd(40) + pct(k / n).padStart(7) + '   [' + pct(lo) + ', ' + pct(hi) + ']  n=' + n +
    (lo > 0.5 || hi < 0.5 ? '   <- 50% excluded' : '')); };
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; sxy += u * v; sxx += u * u; syy += v * v; }
  return sxy / Math.sqrt(sxx * syy); };
const rmseLog = (pred, act) => { let s = 0; for (let i = 0; i < pred.length; i++) { const e = Math.log(pred[i] / act[i]); s += e * e; } return Math.sqrt(s / pred.length); };
const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));

console.log('Dataset: ' + D.META.source + ', ' + D.META.span + ', ' + N + ' sessions (' + (N * 15 / 60 / 24).toFixed(0) + ' days)\n');

/* ---- 1. Does the direction of prior sessions predict this one? -------------
   Terry's stated intuition: "4 up sessions leading in -> probability says down."
   A genuine reversal signal must put the two run-directions on OPPOSITE sides
   of 50%. Same side = noise, however far from 50% either one lands. */
console.log('=== 1. Run of same-direction sessions -> next session direction ===');
row('base rate P(session up)', fin.filter((f) => f > 0).length, fin.filter((f) => f !== 0).length);
for (const R of [2, 3, 4, 5]) {
  for (const dir of [1, -1]) {
    let tot = 0, up = 0;
    for (let i = R; i < N; i++) {
      if (fin[i] === 0) continue;
      if (!fin.slice(i - R, i).every((f) => Math.sign(f) === dir)) continue;
      tot++; if (fin[i] > 0) up++;
    }
    row('after ' + R + ' straight ' + (dir > 0 ? 'UP  ' : 'DOWN') + ' -> P(next UP)', up, tot);
  }
}

/* ---- 2. Does the SIZE of the 5-session net move predict a fade? ------------
   This is what driftNudge already encodes. net = open(i) - open(i-5), i.e. the
   sum of the last five session finals — the same 75-minute anchor px75 uses.
   Buckets match driftNudge's own $20 / $80 / $200 breakpoints. */
console.log('\n=== 2. 5-session NET move -> next session direction (this is driftNudge) ===');
const net5 = (i) => fin.slice(i - 5, i).reduce((a, b) => a + b, 0);
for (const [lo, hi] of [[20, 80], [80, 200], [200, Infinity]]) {
  for (const dir of [1, -1]) {
    let tot = 0, up = 0;
    for (let i = 5; i < N; i++) {
      if (fin[i] === 0) continue;
      const n = net5(i), a = Math.abs(n);
      if (a < lo || a >= hi || Math.sign(n) !== dir) continue;
      tot++; if (fin[i] > 0) up++;
    }
    const tag = (hi === Infinity ? '$' + lo + '+' : '$' + lo + '-' + hi).padEnd(9);
    row('lead-in ' + tag + (dir > 0 ? 'UP  ' : 'DOWN') + ' -> P(next UP)  [fade wants ' + (dir > 0 ? '<' : '>') + '50%]', up, tot);
  }
}

/* ---- 3. Within a session, does displacement predict continuation? ----------
   The model assumes a pure random walk from wherever you are: P(the rest of the
   session moves further the same way) = 50% at every minute, regardless of how
   far out you already are. If that is wrong the whole z-score framing is wrong. */
console.log('\n=== 3. Within-session continuation (model assumes exactly 50% at every k) ===');
for (const k of [3, 5, 8, 11, 13]) {
  let n = 0, cont = 0;
  for (let i = 0; i < N; i++) {
    const dk = S[i][k], rest = fin[i] - dk;
    if (dk === 0 || rest === 0) continue;
    n++; if (Math.sign(rest) === Math.sign(dk)) cont++;
  }
  row('minute ' + String(k).padStart(2) + ': P(rest continues same way)', cont, n);
}

/* ---- 4. Volatility clustering — where the signal actually is ---------------
   Realised sigma over the REMAINING minutes of a session is what sigmaRem has
   to predict. Shape-normalise each minute by SHAPE[] first so the intra-session
   volatility profile is not mistaken for forecast skill. */
const remSigma = (i, k) => { let a = 0, n = 0; for (let j = k; j < 15; j++) { const u = mv[i][j] / SH[j]; a += u * u; n++; } return n ? Math.sqrt(a / n) : null; };
const curSigma = (i, k) => { if (k < 2) return null; let a = 0, n = 0; for (let j = 0; j < k; j++) { const u = mv[i][j] / SH[j]; a += u * u; n++; } return Math.sqrt(a / n); };

console.log('\n=== 4. Which lookback predicts this session\'s volatility? (corr at minute 6) ===');
{
  const rows = [];
  for (let i = 24; i < N; i++) {
    const act = remSigma(i, 6), cur = curSigma(i, 6);
    if (!act || !cur) continue;
    const mean = (W) => sig.slice(i - W, i).reduce((a, b) => a + b, 0) / W;
    rows.push({ act, cur, h: D.HOUR_SIGMA[hr(i)], t24: mean(24), t12: mean(12), t4: mean(4) });
  }
  const A = rows.map((r) => r.act);
  for (const [n, f] of [['hour-of-day sigma (28d) — HOUR_SIGMA', (r) => r.h], ['trailing 24 sessions (6h)', (r) => r.t24],
    ['trailing 12 sessions (3h)', (r) => r.t12], ['trailing 4 sessions (1h)', (r) => r.t4], ['this session so far — sigmaCur', (r) => r.cur]])
    console.log('  ' + n.padEnd(38) + corr(rows.map(f), A).toFixed(3));
}

/* ---- 5. M's estimator vs its window ---------------------------------------
   mult() builds M from |finalDelta| — ONE number per session, the net 15-minute
   move. A session that ran +$200 and came back to +$5 is recorded as $5 of
   volatility. Mpath is the same construction from the session's realised
   per-minute sigma, which uses all 15. Both are compared on the shipped basis
   (HOUR_SIGMA x M) so the comparison is like-for-like.

   NOT A PROPOSED CHANGE. sigmaUnit feeds z, and B=1.49 was fitted to z — moving
   this re-miscalibrates, and the score that matters is Brier on real outcomes,
   which this does not measure. Replication first. See HANDOFF.md rule 2. */
const M_of = (i, W) => { const r = [];
  for (let j = i - 1; j >= 0 && r.length < W; j--) { const den = D.HOUR_SIGMA[hr(j)] * Math.sqrt(SS2) * 0.798; if (den > 0) r.push(Math.abs(fin[j]) / den); }
  return r.length < 4 ? 1 : clamp(med(r), 0.5, 2.5); };
const Mpath_of = (i, W) => { const r = [];
  for (let j = i - 1; j >= 0 && r.length < W; j--) { const den = D.HOUR_SIGMA[hr(j)]; if (den > 0 && sig[j] > 0) r.push(sig[j] / den); }
  return r.length < 4 ? 1 : clamp(med(r), 0.5, 2.5); };

console.log('\n=== 5. M: is the problem the window, or the estimator? ===');
console.log('  correlation with realised session sigma');
{
  const A = [], a = [[], [], []];
  for (let i = 24; i < N; i++) {
    if (sig[i] <= 0) continue;
    const HS = D.HOUR_SIGMA[hr(i)];
    A.push(sig[i]); a[0].push(HS * M_of(i, 12)); a[1].push(HS * M_of(i, 4)); a[2].push(HS * Mpath_of(i, 4));
  }
  console.log('    HOUR_SIGMA x M12   SHIPPED, from |finalDelta| ' + corr(a[0], A).toFixed(3));
  console.log('    HOUR_SIGMA x M4    same estimator, 4-session   ' + corr(a[1], A).toFixed(3) + '   <- shorter window is WORSE');
  console.log('    HOUR_SIGMA x Mpath4  from per-minute sigma      ' + corr(a[2], A).toFixed(3) + '   <- better estimator wins');
}
console.log('\n  forecast error for the REST of the session, RMSE(log), lower better');
console.log('   k | SHIPPED HS*M12 | HS*Mpath12 | SHIPPED .6/.4 | Mpath12 .6/.4');
for (const k of [2, 4, 6, 8, 10, 12]) {
  const rows = [];
  for (let i = 24; i < N; i++) {
    const act = remSigma(i, k), cur = curSigma(i, k);
    if (!act || !cur || act <= 0 || cur <= 0) continue;
    const HS = D.HOUR_SIGMA[hr(i)];
    rows.push({ act, cur, ship: HS * M_of(i, 12), path: HS * Mpath_of(i, 12) });
  }
  const A = rows.map((r) => r.act), e = (f) => rmseLog(rows.map(f), A).toFixed(4);
  console.log('  ' + String(k).padStart(2) + ' |         ' + e((r) => r.ship) + ' |     ' + e((r) => r.path) +
    ' |        ' + e((r) => 0.6 * r.ship + 0.4 * r.cur) + ' |        ' + e((r) => 0.6 * r.path + 0.4 * r.cur));
}

/* ---- 6. Defect 9 — the whole-minute clock --------------------------------- */
console.log('\n=== 6. Defect 9: probability error from the whole-minute REMVAR lookup ===');
{
  const B = 1.49, su = D.HOUR_SIGMA[0], delta = -10;
  const p = (rv) => 1 / (1 + Math.exp(-(B * (delta / (su * Math.sqrt(rv))))));
  /* Linear within the minute; minute 14 runs down to zero remaining variance. */
  const rv = (k, sec) => { const a = D.REMVAR[k - 1], b = k < 14 ? D.REMVAR[k] : 0; return a + (sec / 60) * (b - a); };
  console.log('  delta=$-10  sigmaUnit=HOUR_SIGMA[0]=' + su + '  B=' + B + '  M=1  no sigmaCur  no drift');
  console.log('  min | shown |  30s in |  50s in |  error');
  for (const k of [2, 5, 8, 10, 12, 13, 14]) {
    const a = p(D.REMVAR[k - 1]) * 100, b = p(rv(k, 30)) * 100, c = p(rv(k, 50)) * 100;
    console.log('  ' + String(k).padStart(3) + ' | ' + a.toFixed(1).padStart(5) + ' | ' + b.toFixed(1).padStart(6) +
      ' | ' + c.toFixed(1).padStart(6) + ' | ' + (a - c).toFixed(1).padStart(5) + 'pp');
  }

  /* The live catch: 36s to close, $2.41 below target. Kalshi 21%.
     A = straight-line, same treatment as minutes 1-13.
     B = settlement-average shrink. Averaging over a shorter remaining window
         shrinks variance by the CUBE of the fraction left, not linearly.
     B+ = B plus the elapsed-window (Brownian bridge) term s^3/12, i.e. the
         uncertainty about where the already-banked prices actually sat. */
  console.log('\n  Terry\'s live catch — 36s left, $2.41 below target, Kalshi said 21%:');
  const d = -2.41, T = 1, f = 24 / 60;
  const pOf = (remVar) => 1 / (1 + Math.exp(-(B * (d / (su * Math.sqrt(remVar))))));
  const full = D.REMVAR[13];
  const opts = [
    ['today  whole-minute lookup', full],
    ['A.     straight-line interpolation', full * (1 - f)],
    ['B.     settlement-average cube shrink', full * Math.pow(1 - f, 3)],
    ['B+.    cube + elapsed-window term', full * (Math.pow(1 - f, 3) + Math.pow(f, 3) / 4)]
  ];
  for (const [label, remVar] of opts)
    console.log('    ' + label.padEnd(38) + 'sigmaRem=$' + (su * Math.sqrt(remVar)).toFixed(2).padStart(5) + '   p(up)=' + (pOf(remVar) * 100).toFixed(1) + '%');
  /* Kalshi's implied sigmaRem is DERIVED by inverting our own logit at 21%, so
     it carries B=1.49 with it. An estimate, not a measurement. */
  const zK = Math.log(0.21 / 0.79) / B;
  console.log('    ' + 'Kalshi (implied, inverted at B=1.49)'.padEnd(38) + 'sigmaRem=$' + (d / zK).toFixed(2).padStart(5) + '   p(up)=21.0%');
}
