/* Does conditioning the confidence band on prior-session trend produce an edge
 * that survives the fee — and survives the search that found it?
 *
 *   node btc-session-edge-v3/analysis/conditional-edge-search.mjs   (from repo root)
 *
 * Terry, S41: "why are we still not looking into the combined outcomes of
 * things like after 3 or 4 down or up sessions and then only betting if between
 * 60-89? Also why cant we back solve for trends that result in profitability?"
 *
 * Both are fair, and the first is a genuine gap. Prior sessions tested these
 * ONE AT A TIME and never crossed them:
 *
 *   - streak alone  (S40) — after 4 up, 52.6% [44.7, 60.4]; after 4 down,
 *                   54.5% [46.7, 62.2]. Same side of 50% ⇒ noise.
 *   - band alone    (S40) — calibrated to ~1pp everywhere; after fees every
 *                   band is between −1.8pp and +0.2pp of breakeven.
 *   - 60–89% flat   (S41) — 74.6% actual vs 73.3% stated. The model is
 *                   genuinely UNDER-CONFIDENT there, worth +$3,437 gross,
 *                   and the taker fee then takes $4,549.
 *
 * That last line is why the crossed test is worth running rather than assumed
 * dead. The band already has +1.3pp of real under-confidence in it. The fee at
 * p≈0.73 costs about 2.5pp. So the live question is narrow and answerable:
 *
 *     IS THERE A SUBSET WHERE UNDER-CONFIDENCE EXCEEDS ~2.5pp?
 *
 * Nothing about "the model is calibrated on average" forbids that. Calibration
 * is a marginal statement; it is silent about conditional structure.
 *
 * ON BACK-SOLVING — the second question. You can search for a profitable rule.
 * What you cannot do is believe the number the search reports, because the
 * search itself manufactures it. This session already produced one such
 * artifact: the "night trading loses 4.55%" result came from picking the window
 * after seeing the data, and it collapsed to −3.04pp [−6.73, +0.53] once the
 * error bars were computed over sessions instead of reads. 24 hours give 24
 * chances to find a bad one; this grid gives 6,048 chances to find a good one.
 *
 * So the back-solve is run properly, three guards deep:
 *
 *   1. SPLIT — 70/30 by session date. Search only on train. The test half is
 *      touched exactly once, by the single rule the train half nominated.
 *   2. NULL — the whole search is re-run against permuted data, where session
 *      trend features are shuffled across sessions. That destroys any real
 *      feature→outcome link while preserving the model's calibration, the
 *      band structure, and the within-session clustering exactly. Whatever the
 *      search "finds" there is pure selection bias, and it is the yardstick the
 *      real result has to clear.
 *   3. CLUSTERED CI — bootstrap over whole SESSIONS, never reads. The 14 reads
 *      inside one session all resolve against the same finalDelta; clustering
 *      by read understates the error by ~sqrt(14) and invents significance.
 *      (This is the defect that flipped the S41 night result from SIGNIFICANT
 *      to indistinguishable.)
 *
 * A rule is only reported as real if it beats fees on the HELD-OUT half AND
 * lands beyond the null distribution's mass. Beating fees on train proves
 * nothing whatsoever — the grid guarantees some rule will.
 *
 * WHICH TREND VARIABLE. Terry named the streak (3–4 up/down). S40 measured that
 * as noise. What S40 measured as REAL was the dollar SIZE of the 5-session net
 * move — an ~5–6pp fade with a CI excluding 50%, which is what driftNudge
 * already encodes. Both are searched here; magnitude is the one with prior
 * evidence behind it, so watch that column.
 *
 * PIPELINE. shadowRead()'s reconstruction is reused verbatim from
 * calibration-replay.mjs — same B = 1.49, same mult(), sigmaFromPts(),
 * REMVAR[k-1], same fee rounding, same flat-session exclusion. The two scripts
 * therefore cannot disagree on a probability, only on what is bet.
 *
 * CAVEAT, unchanged and load-bearing: B = 1.49 was fitted on these same 2,688
 * sessions, so the whole exercise is in-sample at the calibration layer even
 * where it is out-of-sample at the rule layer. And the assumed fill is the
 * model's own price plus the fee — the book is not in this dataset. A rule that
 * clears the bar here has earned a live gap test, not a position.
 *
 * Read-only. Imports nothing from the artifact, re-fits nothing, writes nothing.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.condsearch.tmp.mjs');
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
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;

/* mulberry32 — the LCG this repo used before 2026-08-06 produced 16,403
   distinct values in 200,000 draws and invalidated every CI it touched. */
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ---------- session-level trend features ------------------------------- */
/* streak  = consecutive prior NON-FLAT sessions sharing one sign, and its sign.
   net5    = signed sum of finalDelta over the 5 prior non-flat sessions. This
             is the variable S40 found real; magnitude is what carries it. */
const feat = [];
for (let i = 0; i < N; i++) {
  let streak = 0, dir = 0;
  for (let j = i - 1; j >= 0; j--) {
    const f = fin(j); if (f === 0) continue;
    const s = f > 0 ? 1 : -1;
    if (dir === 0) { dir = s; streak = 1; } else if (s === dir) streak++; else break;
  }
  let net5 = 0, got = 0;
  for (let j = i - 1; j >= 0 && got < 5; j--) { const f = fin(j); if (f === 0) continue; net5 += f; got++; }
  feat.push({ streak, dir, net5 });
}

/* ---------- replay: shadowRead() verbatim ------------------------------ */
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
    acc += mv * mv;
    const sigmaUnit = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
    const sigmaRem = sigmaUnit * Math.sqrt(D.REMVAR[k - 1]);
    if (!(sigmaRem > 0)) continue;
    const p = 1 / (1 + Math.exp(-(B * (d / sigmaRem))));
    const conf = Math.round(100 * Math.max(p, 1 - p));
    const won = (p >= 0.5) === (f > 0);
    const q = conf / 100;
    reads.push({
      i, k, conf, won,
      pickUp: p >= 0.5,
      pnl: won ? STAKE / (q + fee(q)) - STAKE : -STAKE,
      be: 100 * (q + fee(q)),                  /* breakeven % this read needs */
    });
  }
}

/* ---------- the grid --------------------------------------------------- */
const BANDS = [[60, 90], [55, 90], [60, 85], [65, 90], [70, 90], [60, 80], [55, 85]];
const KMIN = [1, 3, 5, 8], KMAX = [7, 14];
const STREAK = [0, 2, 3, 4];                    /* Terry's "after 3 or 4"      */
const NET5 = [0, 80, 200];                      /* S40's real magnitude effect */
const REL = ['any', 'with', 'against'];         /* pick agrees with trend?     */

const RULES = [];
for (const b of BANDS) for (const kmin of KMIN) for (const kmax of KMAX)
  for (const sMin of STREAK) for (const sRel of REL)
    for (const nMin of NET5) for (const nRel of REL)
      if (kmax > kmin) RULES.push({ b, kmin, kmax, sMin, sRel, nMin, nRel });

const relOk = (rel, agree) => rel === 'any' || (rel === 'with') === agree;

/* featOf is indirected through a permutation so the null can shuffle which
   session's trend features attach to which session's outcomes. */
const evalRule = (r, rows, perm) => {
  let bets = 0, pnl = 0, wins = 0, beSum = 0;
  for (const x of rows) {
    if (x.conf < r.b[0] || x.conf >= r.b[1]) continue;
    if (x.k < r.kmin || x.k > r.kmax) continue;
    const F = feat[perm[x.i]];
    if (F.streak < r.sMin) continue;
    if (Math.abs(F.net5) < r.nMin) continue;
    if (r.sMin > 0 && !relOk(r.sRel, x.pickUp === (F.dir > 0))) continue;
    if (r.nMin > 0 && !relOk(r.nRel, x.pickUp === (F.net5 > 0))) continue;
    bets++; pnl += x.pnl; wins += x.won ? 1 : 0; beSum += x.be;
  }
  return { bets, pnl, wins, beSum };
};

/* ---------- 70/30 split by session date -------------------------------- */
const CUT = Math.floor(N * 0.7);
const train = reads.filter((x) => x.i < CUT);
const test = reads.filter((x) => x.i >= CUT);
const ident = [...Array(N).keys()];
const MIN_BETS = 300;

const search = (rows, perm) => {
  let best = null;
  for (const r of RULES) {
    const e = evalRule(r, rows, perm);
    if (e.bets < MIN_BETS) continue;
    const per = e.pnl / (e.bets * STAKE);
    if (!best || per > best.per) best = { r, per, ...e };
  }
  return best;
};

/* ---------- clustered bootstrap over sessions --------------------------- */
const bootCI = (r, rows, seed) => {
  const bySess = new Map();
  for (const x of rows) {
    if (x.conf < r.b[0] || x.conf >= r.b[1]) continue;
    if (x.k < r.kmin || x.k > r.kmax) continue;
    const F = feat[x.i];
    if (F.streak < r.sMin) continue;
    if (Math.abs(F.net5) < r.nMin) continue;
    if (r.sMin > 0 && !relOk(r.sRel, x.pickUp === (F.dir > 0))) continue;
    if (r.nMin > 0 && !relOk(r.nRel, x.pickUp === (F.net5 > 0))) continue;
    if (!bySess.has(x.i)) bySess.set(x.i, []);
    bySess.get(x.i).push(x);
  }
  const groups = [...bySess.values()];
  if (!groups.length) return [NaN, NaN];
  const rand = rng(seed), out = [];
  for (let b = 0; b < 4000; b++) {
    let pnl = 0, bets = 0;
    for (let g = 0; g < groups.length; g++) {
      const grp = groups[(rand() * groups.length) | 0];
      for (const x of grp) { pnl += x.pnl; bets++; }
    }
    out.push(bets ? 100 * pnl / (bets * STAKE) : 0);
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * out.length)], out[Math.floor(0.975 * out.length)]];
};

const show = (r) => `${r.b[0]}-${r.b[1] - 1}%  k${r.kmin}-${r.kmax}` +
  (r.sMin ? `  streak>=${r.sMin}(${r.sRel})` : '  streak:any') +
  (r.nMin ? `  |net5|>=$${r.nMin}(${r.nRel})` : '  net5:any');

/* ---------- 1. Terry's exact rule, no search --------------------------- */
console.log(`Replay of ${N.toLocaleString()} baked sessions (${D.META.span}) -> ${reads.length.toLocaleString()} reads`);
console.log(`Split: train = sessions 0-${CUT - 1} (${train.length.toLocaleString()} reads), ` +
  `test = ${CUT}-${N - 1} (${test.length.toLocaleString()} reads)\n`);

console.log('=== 1. THE EXACT RULE ASKED FOR: 60-89%, after a streak of N, no search ===\n');
console.log('  streak   rel        bets     won    rate   breakeven    edge     net/$1');
for (const sMin of [0, 2, 3, 4]) {
  for (const sRel of (sMin ? ['any', 'with', 'against'] : ['any'])) {
    const r = { b: [60, 90], kmin: 1, kmax: 14, sMin, sRel, nMin: 0, nRel: 'any' };
    const e = evalRule(r, reads, ident);
    if (!e.bets) continue;
    const rate = 100 * e.wins / e.bets, be = e.beSum / e.bets;
    console.log('  ' + (sMin ? '>=' + sMin : 'any').padEnd(8) + sRel.padEnd(10) +
      e.bets.toLocaleString().padStart(6) + e.wins.toLocaleString().padStart(8) +
      rate.toFixed(1).padStart(7) + '%' + be.toFixed(1).padStart(11) + '%  ' +
      ((rate - be) >= 0 ? '+' : '−') + Math.abs(rate - be).toFixed(1).padStart(4) + 'pp  ' +
      (e.pnl >= 0 ? '+' : '−') + '$' + Math.abs(e.pnl / (e.bets * STAKE)).toFixed(4));
  }
}

console.log('\n=== 2. Same, conditioned on the 5-session net MOVE (the effect S40 found real) ===\n');
console.log('  |net5|   rel        bets     won    rate   breakeven    edge     net/$1');
for (const nMin of [0, 80, 200]) {
  for (const nRel of (nMin ? ['any', 'with', 'against'] : ['any'])) {
    const r = { b: [60, 90], kmin: 1, kmax: 14, sMin: 0, sRel: 'any', nMin, nRel };
    const e = evalRule(r, reads, ident);
    if (!e.bets) continue;
    const rate = 100 * e.wins / e.bets, be = e.beSum / e.bets;
    console.log('  ' + (nMin ? '>=$' + nMin : 'any').padEnd(8) + nRel.padEnd(10) +
      e.bets.toLocaleString().padStart(6) + e.wins.toLocaleString().padStart(8) +
      rate.toFixed(1).padStart(7) + '%' + be.toFixed(1).padStart(11) + '%  ' +
      ((rate - be) >= 0 ? '+' : '−') + Math.abs(rate - be).toFixed(1).padStart(4) + 'pp  ' +
      (e.pnl >= 0 ? '+' : '−') + '$' + Math.abs(e.pnl / (e.bets * STAKE)).toFixed(4));
  }
}

/* ---------- 3. the back-solve --------------------------------------------- */
console.log(`\n=== 3. THE BACK-SOLVE: best of ${RULES.length.toLocaleString()} rules on TRAIN, then tested once ===\n`);
const bestTrain = search(train, ident);
if (!bestTrain) {
  console.log('  no rule cleared the ' + MIN_BETS + '-bet floor on train.');
} else {
  const te = evalRule(bestTrain.r, test, ident);
  const trRate = 100 * bestTrain.wins / bestTrain.bets, trBe = bestTrain.beSum / bestTrain.bets;
  console.log('  winner on train:  ' + show(bestTrain.r));
  console.log('    train:  ' + bestTrain.bets.toLocaleString().padStart(6) + ' bets   ' +
    trRate.toFixed(1) + '% vs ' + trBe.toFixed(1) + '% breakeven   edge ' +
    ((trRate - trBe) >= 0 ? '+' : '−') + Math.abs(trRate - trBe).toFixed(1) + 'pp   net ' +
    (bestTrain.per >= 0 ? '+' : '−') + '$' + Math.abs(bestTrain.per).toFixed(4) + '/$1');
  if (te.bets) {
    const teRate = 100 * te.wins / te.bets, teBe = te.beSum / te.bets, tePer = te.pnl / (te.bets * STAKE);
    const [lo, hi] = bootCI(bestTrain.r, test, 20260808);
    console.log('    TEST:   ' + te.bets.toLocaleString().padStart(6) + ' bets   ' +
      teRate.toFixed(1) + '% vs ' + teBe.toFixed(1) + '% breakeven   edge ' +
      ((teRate - teBe) >= 0 ? '+' : '−') + Math.abs(teRate - teBe).toFixed(1) + 'pp   net ' +
      (tePer >= 0 ? '+' : '−') + '$' + Math.abs(tePer).toFixed(4) + '/$1');
    console.log('            95% CI on TEST net, bootstrapped over sessions: [' +
      lo.toFixed(2) + '%, ' + hi.toFixed(2) + '%]');
  } else {
    console.log('    TEST:   rule selects no reads out of sample.');
  }

  /* ---------- 4. the null: how good does the search look on shuffled data? */
  const R = 200;
  console.log(`\n=== 4. THE NULL: same search, ${R} times, with trend features shuffled across sessions ===\n`);
  console.log('  This preserves calibration, bands, and session clustering, and destroys only');
  console.log('  the feature->outcome link. Anything the search finds here is selection bias.\n');
  const nullTest = [], nullTrain = [];
  const rand = rng(987654321);
  for (let b = 0; b < R; b++) {
    const perm = [...ident];
    for (let j = perm.length - 1; j > 0; j--) { const t = (rand() * (j + 1)) | 0; [perm[j], perm[t]] = [perm[t], perm[j]]; }
    const bt = search(train, perm);
    if (!bt) continue;
    nullTrain.push(bt.per);
    const e = evalRule(bt.r, test, perm);
    if (e.bets) nullTest.push(e.pnl / (e.bets * STAKE));
  }
  const pct = (a, q) => { const x = [...a].sort((p, r) => p - r); return x[Math.min(x.length - 1, Math.floor(q * x.length))]; };
  console.log('  best-on-train net/$1, shuffled:   median ' + (pct(nullTrain, .5) >= 0 ? '+' : '−') + '$' +
    Math.abs(pct(nullTrain, .5)).toFixed(4) + '   95th pct +$' + Math.abs(pct(nullTrain, .95)).toFixed(4));
  console.log('    -> a rule this good on TRAIN appears routinely in data with no signal at all.');
  if (nullTest.length) {
    console.log('  that rule carried to TEST, shuffled: median ' + (pct(nullTest, .5) >= 0 ? '+' : '−') + '$' +
      Math.abs(pct(nullTest, .5)).toFixed(4) + '   95th pct ' + (pct(nullTest, .95) >= 0 ? '+' : '−') + '$' +
      Math.abs(pct(nullTest, .95)).toFixed(4));
    const te2 = evalRule(bestTrain.r, test, ident);
    if (te2.bets) {
      const real = te2.pnl / (te2.bets * STAKE);
      const beat = nullTest.filter((v) => v >= real).length;
      console.log('\n  REAL test result: ' + (real >= 0 ? '+' : '−') + '$' + Math.abs(real).toFixed(4) + '/$1');
      console.log('  Null runs matching or beating it: ' + beat + '/' + nullTest.length +
        '   => empirical p = ' + ((beat + 1) / (nullTest.length + 1)).toFixed(3));
      console.log('\n  VERDICT: ' + (((beat + 1) / (nullTest.length + 1)) < 0.05 && real > 0
        ? 'survives the null AND is profitable out of sample. Worth a live gap test.'
        : 'does NOT clear the null. The back-solve found the search, not an edge.'));
    }
  }
}
console.log('\n  IN-SAMPLE at the calibration layer — B = 1.49 was fitted on this data.');
console.log('  Fill assumed at the model price + fee; the book is not in this dataset.');
