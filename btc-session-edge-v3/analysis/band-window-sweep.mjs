/* Is 60-89% actually the best band, and is 9am-10pm actually a good window?
 *
 *   node btc-session-edge-v3/analysis/band-window-sweep.mjs [--stake=5]
 *
 * Terry, S41: "so 9-22 is good or bad? and r ur returns still only bettering
 * in between 60-89?"
 *
 * Two fair questions, and both have the same shape: they ask whether a cut
 * chosen from the data is good. So this script reports each cut honestly AND
 * reports how many cuts were looked at to find it — because the second number
 * is what makes the first one meaningful or worthless.
 *
 * The 60-89% band was never derived. Terry named it, and every study since has
 * inherited it. Whether it is the best band has genuinely never been checked,
 * so the band sweep below is new information rather than a re-run.
 *
 * The 9-22 window HAS the night-trading problem baked into it: 22:00-02:00 was
 * already identified as the worst stretch, so "trade 09:00-22:00" is close to
 * "trade everything except the bit that looked bad." That is the definition of
 * a cut chosen after seeing the data, and the S41 night result already died
 * exactly this way — -3.04pp collapsed to a CI of [-6.73, +0.53] once errors
 * were clustered by session.
 *
 * So this prints, alongside every result, the count of alternatives searched.
 * A window that wins out of 100 tried is not the same object as a window
 * predicted in advance, and the two must never be quoted the same way.
 *
 * Pipeline is calibration-replay.mjs's shadowRead() reconstruction verbatim —
 * same B = 1.49, mult(), sigmaFromPts(), REMVAR[k-1], fee rounding, flat-session
 * exclusion. Entry is the model price + taker fee, so the book is assumed, not
 * observed. CIs bootstrap over whole sessions, 4,000 resamples, mulberry32.
 *
 * Read-only. Writes nothing, re-fits nothing.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.bwsweep.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const STAKE = (() => {
  const a = process.argv.find((x) => x.startsWith('--stake='));
  const v = a ? Number(a.slice(8)) : 5;
  if (!(v > 0)) throw new Error('--stake must be positive');
  return v;
})();

const S = D.SESS, N = S.length, B = 1.49;
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit'
}).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const reads = [];
for (let i = 0; i < N; i++) {
  const f = fin(i);
  if (f === 0) continue;
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
    const q = conf / 100, a = q + fee(q);
    reads.push({ i, k, hr: HRS[i], conf, won: (p >= 0.5) === (f > 0), ask: a,
      pnl: ((p >= 0.5) === (f > 0)) ? STAKE / a - STAKE : -STAKE });
  }
}

const book = (rs) => {
  if (!rs.length) return null;
  let pnl = 0, wins = 0, askSum = 0, confSum = 0;
  for (const r of rs) { pnl += r.pnl; wins += r.won ? 1 : 0; askSum += r.ask; confSum += r.conf; }
  return { n: rs.length, wins, pnl, staked: rs.length * STAKE, rate: 100 * wins / rs.length,
    meanConf: confSum / rs.length, meanAsk: 100 * askSum / rs.length, roi: 100 * pnl / (rs.length * STAKE) };
};

const boot = (rs, seed) => {
  const by = new Map();
  for (const r of rs) { if (!by.has(r.i)) by.set(r.i, []); by.get(r.i).push(r); }
  const g = [...by.values()];
  if (!g.length) return [NaN, NaN];
  const rand = rng(seed), out = [];
  for (let b = 0; b < 4000; b++) {
    let pnl = 0, n = 0;
    for (let x = 0; x < g.length; x++) { const grp = g[(rand() * g.length) | 0]; for (const r of grp) { pnl += r.pnl; n++; } }
    out.push(n ? 100 * pnl / (n * STAKE) : 0);
  }
  out.sort((a, b) => a - b);
  return [out[100], out[3899]];
};

console.log(`$${STAKE}/bet, one bet per minute. ${N.toLocaleString()} sessions, ${D.META.span}.`);
console.log('Entry = model probability + taker fee. Book assumed, not observed.\n');

/* ---------- 1. is 60-89 the best band? ---------- */
const BANDS = [[50,101],[50,60],[55,90],[60,90],[60,70],[60,80],[65,90],[70,90],[70,80],[80,90],[80,101],[90,101],[95,101],[60,101],[65,101]];
console.log('=== 1. BAND SWEEP — is 60-89% special? ===\n');
console.log('  band        bets     rate   model    edge     ask      P&L       ROI      95% CI on ROI');
let seed = 1000;
const bandRows = [];
for (const [lo, hi] of BANDS) {
  const g = book(reads.filter((r) => r.conf >= lo && r.conf < hi));
  if (!g) continue;
  const ci = boot(reads.filter((r) => r.conf >= lo && r.conf < hi), seed++);
  bandRows.push({ lo, hi, g, ci });
  console.log('  ' + (lo + '-' + (hi - 1) + '%').padEnd(11) + g.n.toLocaleString().padStart(6) +
    g.rate.toFixed(1).padStart(8) + '%' + g.meanConf.toFixed(1).padStart(8) + '%' +
    ((g.rate - g.meanConf) >= 0 ? '+' : '−') + Math.abs(g.rate - g.meanConf).toFixed(1).padStart(4) + 'pp' +
    g.meanAsk.toFixed(1).padStart(8) + 'c' + usd(g.pnl).padStart(11) +
    (g.roi >= 0 ? '+' : '−') + Math.abs(g.roi).toFixed(2).padStart(5) + '%' +
    ('  [' + ci[0].toFixed(2) + ', ' + ci[1].toFixed(2) + ']').padStart(20));
}
const bestBand = bandRows.reduce((a, b) => (b.g.roi > a.g.roi ? b : a));
console.log('\n  best by ROI: ' + bestBand.lo + '-' + (bestBand.hi - 1) + '% at ' +
  (bestBand.g.roi >= 0 ? '+' : '') + bestBand.g.roi.toFixed(2) + '%  — chosen from ' + bandRows.length + ' bands tried.');
console.log('  Every band CI that spans 0 is a band you cannot distinguish from break-even.');

/* ---------- 2. minutes 9-11: the decisive test is out of sample ---------- */
const inBand = reads.filter((r) => r.conf >= 60 && r.conf < 90);
const CUT = Math.floor(N * 0.7);
console.log('\n=== 2. MINUTES 9-11, the arc off the per-minute table ===\n');
console.log('  In-sample it looks like the answer. The only question that matters is');
console.log('  whether it survives on sessions it was not chosen from, so the same rule');
console.log('  is scored on the first 70% (where it would have been found) and then on');
console.log('  the last 30% (which it has never seen).\n');
console.log('  slice                    bets     rate   model    edge      P&L       ROI      95% CI on ROI');
const k911 = (rs) => rs.filter((r) => r.k >= 9 && r.k <= 11);
for (const [label, rs, sd] of [
  ['k9-11, all sessions', k911(inBand), 601],
  ['k9-11, TRAIN (first 70%)', k911(inBand.filter((r) => r.i < CUT)), 602],
  ['k9-11, TEST  (last 30%)', k911(inBand.filter((r) => r.i >= CUT)), 603],
  ['all minutes, TEST', inBand.filter((r) => r.i >= CUT), 604],
]) {
  const g = book(rs); if (!g) continue;
  const ci = boot(rs, sd);
  console.log('  ' + label.padEnd(26) + g.n.toLocaleString().padStart(5) +
    g.rate.toFixed(1).padStart(8) + '%' + g.meanConf.toFixed(1).padStart(8) + '%' +
    ((g.rate - g.meanConf) >= 0 ? '+' : '−') + Math.abs(g.rate - g.meanConf).toFixed(1).padStart(4) + 'pp' +
    usd(g.pnl).padStart(10) + (g.roi >= 0 ? '+' : '−') + Math.abs(g.roi).toFixed(2).padStart(6) + '%' +
    ('  [' + ci[0].toFixed(2) + ', ' + ci[1].toFixed(2) + ']').padStart(20));
}

/* ---------- 2b. the three windows Terry asked to see side by side ----------
   Note these OVERLAP: k5-7 and k7-9 share minute 7, k7-9 and k9-11 share
   minute 9. They are therefore not three independent readings, and a session
   that goes the model's way contributes to more than one of them. The
   non-overlapping partition (k5-6 / k7-8 / k9-10 / k11-12) is printed under it
   so the trend can be read without the shared minutes propping it up. */
console.log('\n=== 2b. k5-7 vs k7-9 vs k9-11, 60-89% band ===\n');
console.log('  window   bets    rate   model    edge      P&L      ROI     TRAIN    TEST    95% CI on ROI');
const winRow = (lo, hi, sd) => {
  const all = inBand.filter((r) => r.k >= lo && r.k <= hi);
  const g = book(all); if (!g) return;
  const tr = book(all.filter((r) => r.i < CUT)), te = book(all.filter((r) => r.i >= CUT));
  const ci = boot(all, sd);
  console.log('  ' + ('k' + lo + '-' + hi).padEnd(9) + g.n.toLocaleString().padStart(5) +
    g.rate.toFixed(1).padStart(8) + '%' + g.meanConf.toFixed(1).padStart(8) + '%' +
    ((g.rate - g.meanConf) >= 0 ? '+' : '−') + Math.abs(g.rate - g.meanConf).toFixed(1).padStart(4) + 'pp' +
    usd(g.pnl).padStart(10) + (g.roi >= 0 ? '+' : '−') + Math.abs(g.roi).toFixed(2).padStart(5) + '%' +
    (tr ? ((tr.roi >= 0 ? '+' : '−') + Math.abs(tr.roi).toFixed(2) + '%').padStart(9) : '        —') +
    (te ? ((te.roi >= 0 ? '+' : '−') + Math.abs(te.roi).toFixed(2) + '%').padStart(9) : '        —') +
    ('  [' + ci[0].toFixed(2) + ', ' + ci[1].toFixed(2) + ']').padStart(20));
};
winRow(5, 7, 701); winRow(7, 9, 702); winRow(9, 11, 703);
console.log('\n  same cut, NON-overlapping pairs so no minute is double-counted:');
console.log('  window   bets    rate   model    edge      P&L      ROI     TRAIN    TEST    95% CI on ROI');
winRow(1, 2, 710); winRow(3, 4, 711); winRow(5, 6, 712); winRow(7, 8, 713);
winRow(9, 10, 714); winRow(11, 12, 715); winRow(13, 14, 716);

/* ---------- 3. how many minute windows look good by chance? ---------- */
console.log('\n=== 3. EVERY CONTIGUOUS MINUTE WINDOW, ranked — the selection problem, shown ===\n');
const wins = [];
for (let start = 1; start <= 14; start++) {
  for (let end = start + 1; end <= 14; end++) {
    const g = book(inBand.filter((r) => r.k >= start && r.k <= end));
    if (g && g.n >= 1000) wins.push({ start, end, g });
  }
}
wins.sort((a, b) => b.g.roi - a.g.roi);
console.log('  ' + wins.length + ' contiguous minute windows tried (min 1,000 bets).\n');
console.log('  rank  window     bets     rate     ROI      ROI on the held-out 30%');
for (const w of wins.slice(0, 6)) {
  const te = book(inBand.filter((r) => r.i >= CUT && r.k >= w.start && r.k <= w.end));
  console.log('   ' + (wins.indexOf(w) + 1 + '.').padEnd(5) + ('k' + w.start + '-' + w.end).padEnd(10) +
    w.g.n.toLocaleString().padStart(7) + w.g.rate.toFixed(1).padStart(8) + '%' +
    (w.g.roi >= 0 ? '+' : '−') + Math.abs(w.g.roi).toFixed(2).padStart(5) + '%' +
    (te ? ((te.roi >= 0 ? '  +' : '  −') + Math.abs(te.roi).toFixed(2) + '%').padStart(24) : '   —'));
}
const r911 = wins.find((w) => w.start === 9 && w.end === 11);
if (r911) console.log('\n  k9-11 ranks ' + (wins.indexOf(r911) + 1) + ' of ' + wins.length +
  ' in sample at ' + (r911.g.roi >= 0 ? '+' : '') + r911.g.roi.toFixed(2) + '%.');
const pos = wins.filter((w) => w.g.roi > 0).length;
console.log('  ' + pos + ' of ' + wins.length + ' windows (' + (100 * pos / wins.length).toFixed(0) +
  '%) show an in-sample profit. They overlap heavily and share sessions, so that');
console.log('  count is not ' + wins.length + ' independent chances — but it is not one chance either.');
console.log('\n  Minute range was ALREADY an axis in conditional-edge-search.mjs, whose');
console.log('  5,292-rule back-solve produced a winner scoring +$0.0490/$1 out of sample');
console.log('  and still failed its null at p = 0.323. If k9-11 were real it had every');
console.log('  opportunity to survive that search. Compare the two ROI columns above.');
console.log('\n  IN-SAMPLE. B = 1.49 was fitted on these sessions. Book assumed, not observed.');
