/* What would a flat $10-per-minute, 60–89%-only strategy have won?
 *
 *   node btc-session-edge-v3/analysis/flat-stake-strategy.mjs   (from repo root)
 *
 * Terry, S41: "calculate the winnings if I was to use the strategy of $10/min
 * based on the model and placing bet only when between 60-89% regardless of it
 * is taking the up or down position — across the entire data set, and then also
 * on night time trading between 10-2am."
 *
 * This is calibration-replay.mjs's pipeline with a staking rule bolted on. It
 * reuses that file's shadowRead() reconstruction verbatim (same B, same mult(),
 * same sigmaFromPts(), same REMVAR[k-1]) so the two scripts cannot drift on the
 * probability and disagree only on what is done with it.
 *
 * THE ASSUMPTION THAT DECIDES THE ANSWER — read before believing any number:
 *
 *   The baked dataset has NO Kalshi quotes. It is 2,688 sessions of Bitstamp
 *   BTCUSD prices and nothing else. So "what would I have won" cannot be
 *   answered without supplying an entry price, and this script supplies the
 *   only one the data justifies: you pay the model's own probability, plus
 *   Kalshi's taker fee. Buy a 72% call for 72c + 2c fee.
 *
 *   That is not a neutral choice, it is the pessimistic-but-honest one. It
 *   assumes Kalshi quotes exactly what the model thinks, which is the same as
 *   assuming zero edge before fees. If the book is systematically cheaper than
 *   the model at these confidences, the real answer is better than this one —
 *   and if it is dearer, worse. Nothing here measures that gap. The GAP tab
 *   does, on live reads, and it is the only thing that can.
 *
 *   So the honest headline is not "the strategy loses $X." It is "the strategy
 *   needs the book to be asking below Yc to break even, and here is Y."
 *
 * ALSO IN-SAMPLE: B = 1.49 was fitted on these same 2,688 sessions. Calibration
 * this good is partly what fitting produces. See calibration-replay.mjs.
 *
 * Read-only. Re-fits nothing.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.strategy.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

/* Stake is overridable so the same study can be re-run at a different bet size
   without forking the file: `node ... --stake=5`. Default is the $10 the
   original run used, so every number previously reported still reproduces. */
const STAKE = (() => {
  const a = process.argv.find((x) => x.startsWith('--stake='));
  const v = a ? Number(a.slice(8)) : 10;
  if (!(v > 0)) throw new Error('--stake must be a positive number');
  return v;
})();
const S = D.SESS, N = S.length, B = 1.49;
const LO = 60, HI = 89;                        /* inclusive band, as Terry stated it */
const NIGHT = [22, 23, 0, 1];                  /* 10pm -> 2am CT, 2am exclusive */

const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
/* Chicago, because HOUR_SIGMA is indexed that way and the app's hhmm() prints
 * that way — the hour Terry reads off the LOG tab is this hour. */
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit'
}).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];
/* Kalshi taker fee, dollars per contract, same rounding as ceilings(). */
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* THE READS INSIDE ONE SESSION ARE NOT INDEPENDENT. All 14 resolve against the
 * same finalDelta, so when a session goes the model's way most of that
 * session's bets win together. Treating 18,440 reads as 18,440 independent
 * trials — which a plain Wilson interval does — understates the error by
 * roughly sqrt(reads/session) and will happily label noise "significant".
 * Everything below therefore bootstraps over SESSIONS, resampling whole
 * sessions with replacement. Seeded, so the numbers reproduce exactly. */
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const BOOT = 4000;
function bootstrap(rs, stat) {
  const by = new Map();
  for (const r of rs) { if (!by.has(r.i)) by.set(r.i, []); by.get(r.i).push(r); }
  const groups = [...by.values()], G = groups.length, rnd = mulberry(20260808);
  const out = [];
  for (let b = 0; b < BOOT; b++) {
    const samp = [];
    for (let g = 0; g < G; g++) samp.push(...groups[(rnd() * G) | 0]);
    out.push(stat(samp));
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * BOOT)], out[Math.floor(0.975 * BOOT)]];
}

/* ---- replay: identical to calibration-replay.mjs, plus hour + session id ---- */
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
    reads.push({
      i, k, hr: HRS[i],
      conf: Math.round(100 * Math.max(p, 1 - p)),
      side: p >= 0.5 ? 'U' : 'D',
      won: (p >= 0.5) === (f > 0),
    });
  }
}

/* ---- staking ----
 * ask   = model probability + taker fee, dollars per contract
 * cont  = how many contracts $10 buys. Continuous is the idealisation the
 *         calibration replay uses; integer is what Kalshi actually fills, and
 *         the leftover cents stay in your pocket. Both are reported.        */
const price = (r) => { const p = r.conf / 100; return p + fee(p); };
function book(rs) {
  let staked = 0, pl = 0, iStaked = 0, iPl = 0, wins = 0, askSum = 0, confSum = 0, fees = 0;
  for (const r of rs) {
    const a = price(r);
    askSum += a;
    confSum += r.conf;
    staked += STAKE;
    pl += r.won ? STAKE / a - STAKE : -STAKE;
    const n = Math.floor(STAKE / a), cost = n * a;
    iStaked += cost;
    iPl += r.won ? n * (1 - a) : -cost;
    if (r.won) wins++;
    fees += (STAKE / a) * fee(r.conf / 100);   /* what the taker fee cost, in dollars */
  }
  const n = rs.length;
  return { n, wins, staked, pl, iStaked, iPl, fees, meanAsk: askSum / n, meanConf: confSum / n, rate: 100 * wins / n };
}
const rateOf = (rs) => 100 * rs.filter((r) => r.won).length / rs.length;
const roiOf = (rs) => { let pl = 0; for (const r of rs) { const a = price(r); pl += r.won ? STAKE / a - STAKE : -STAKE; }
  return 100 * pl / (rs.length * STAKE); };

const band = (r) => r.conf >= LO && r.conf <= HI;
const inBand = reads.filter(band);
const night = inBand.filter((r) => NIGHT.includes(r.hr));
const day = inBand.filter((r) => !NIGHT.includes(r.hr));

const sessAll = new Set(inBand.map((r) => r.i)).size;
const sessNight = new Set(night.map((r) => r.i)).size;

console.log('$' + STAKE + '/min flat stake, bet only when the model reads ' + LO + '-' + HI + '%, either side.');
console.log('Dataset: ' + N.toLocaleString() + ' baked sessions, ' + D.META.span + ' (' + D.META.source + ')');
console.log('Entry price = model probability + Kalshi taker fee. NO market quotes in this data.\n');

function report(label, rs, sessions) {
  const g = book(rs);
  const rCI = bootstrap(rs, rateOf), pCI = bootstrap(rs, roiOf);
  console.log('== ' + label + ' ==');
  console.log('  bets                 ' + g.n.toLocaleString() + '  across ' + sessions.toLocaleString() + ' sessions');
  console.log('  total staked         ' + usd(g.staked));
  console.log('  won                  ' + g.wins.toLocaleString() + '  (' + g.rate.toFixed(1) + '%  [' +
    rCI[0].toFixed(1) + ', ' + rCI[1].toFixed(1) + '] 95% CI, clustered by session)');
  console.log('  model said           ' + g.meanConf.toFixed(1) + '%  ->  raw edge before fees ' +
    ((g.rate - g.meanConf) >= 0 ? '+' : '') + (g.rate - g.meanConf).toFixed(1) + 'pp');
  console.log('  taker fee            ' + (100 * g.meanAsk - g.meanConf).toFixed(1) + 'c per contract');
  console.log('  mean all-in ask      ' + (100 * g.meanAsk).toFixed(1) + 'c   <- break-even needs the win rate to beat this');
  console.log('  fees paid            ' + usd(g.fees) + '   (P&L would be ' + usd(g.pl + g.fees) + ' at zero fee)');
  console.log('  NET P&L              ' + usd(g.pl) + '   (' + (100 * g.pl / g.staked).toFixed(2) + '% of stake, 95% CI [' +
    pCI[0].toFixed(2) + '%, ' + pCI[1].toFixed(2) + '%])');
  console.log('                       -> P&L CI in dollars ' + usd(g.staked * pCI[0] / 100) + ' to ' + usd(g.staked * pCI[1] / 100));
  console.log('  integer contracts    ' + usd(g.iPl) + '   on ' + usd(g.iStaked) + ' actually deployed (' +
    (100 * g.iPl / g.iStaked).toFixed(2) + '%)');
  console.log('  break-even ask       ' + g.rate.toFixed(1) + 'c all-in  vs  ' + (100 * g.meanAsk).toFixed(1) +
    'c paid  ->  ' + ((g.rate - 100 * g.meanAsk) >= 0 ? '+' : '') + (g.rate - 100 * g.meanAsk).toFixed(1) + 'c per contract\n');
  return g;
}

const bA = report('ENTIRE DATASET', inBand, sessAll);
const bN = report('NIGHT 10pm-2am CT (hours 22, 23, 0, 1)', night, sessNight);
const bD = report('REST OF DAY (2am-10pm CT), for contrast', day, new Set(day.map((r) => r.i)).size);

/* ---- is night actually different? bootstrap the DIFFERENCE, clustered ---- */
{
  const grp = (rs) => { const m = new Map(); for (const r of rs) { if (!m.has(r.i)) m.set(r.i, []); m.get(r.i).push(r); } return [...m.values()]; };
  const gN = grp(night), gD = grp(day), rnd = mulberry(20260809), out = [];
  for (let b = 0; b < BOOT; b++) {
    const sN = [], sD = [];
    for (let g = 0; g < gN.length; g++) sN.push(...gN[(rnd() * gN.length) | 0]);
    for (let g = 0; g < gD.length; g++) sD.push(...gD[(rnd() * gD.length) | 0]);
    out.push(rateOf(sN) - rateOf(sD));
  }
  out.sort((a, b) => a - b);
  const lo = out[Math.floor(0.025 * BOOT)], hi = out[Math.floor(0.975 * BOOT)];
  const diff = bN.rate - bD.rate;
  console.log('== NIGHT vs DAY ==');
  console.log('  win-rate difference  ' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + 'pp   95% CI [' +
    lo.toFixed(2) + ', ' + hi.toFixed(2) + ']  ->  ' +
    (lo > 0 || hi < 0 ? 'holds up' : 'NOT distinguishable from noise'));
  console.log('  mean ask night ' + (100 * bN.meanAsk).toFixed(1) + 'c  vs  day ' + (100 * bD.meanAsk).toFixed(1) + 'c');
  console.log('  (and this is one window chosen after seeing the data — 24 hours give 24 chances');
  console.log('   to find a "bad" one, so even a CI excluding 0 would need a fresh month to trust.)\n');
}

/* ---- per-hour, so the night window is checkable rather than asserted ---- */
console.log('== BY HOUR (CT), 60-89% band only ==');
console.log('  hr    bets    won    rate   ask    P&L        per $1');
for (let h = 0; h < 24; h++) {
  const g = inBand.filter((r) => r.hr === h);
  if (!g.length) continue;
  const b = book(g);
  console.log('  ' + String(h).padStart(2, '0') + ':00' + b.n.toLocaleString().padStart(7) +
    b.wins.toLocaleString().padStart(7) + b.rate.toFixed(1).padStart(7) + '%' +
    (100 * b.meanAsk).toFixed(1).padStart(7) + 'c' + usd(b.pl).padStart(11) +
    (b.pl / b.staked).toFixed(3).padStart(9) + (NIGHT.includes(h) ? '   <- night' : ''));
}

/* ---- by position in the session ----
 * The 15 minutes are not interchangeable. remVar drains as the session runs, so
 * a late read needs a far smaller delta to reach the same confidence, and the
 * band therefore selects a structurally different bet early vs late. Reads run
 * k = 1..14, so the last block holds 4 minutes, not 5 — the count is printed
 * rather than assumed. CIs are bootstrapped over sessions, same as everywhere.  */
const BLOCKS = [['1st 5 min', 1, 5], ['2nd 5 min', 6, 10], ['3rd 5 min', 11, 14]];
console.log('\n== BY POSITION IN SESSION, ' + LO + '-' + HI + '% band only ==');
console.log('  block        bets    won    rate   model    edge     ask     P&L      per $1   95% CI on ROI');
for (const [label, klo, khi] of BLOCKS) {
  const g = inBand.filter((r) => r.k >= klo && r.k <= khi);
  if (!g.length) continue;
  const b = book(g), ci = bootstrap(g, roiOf);
  console.log('  ' + label.padEnd(12) + b.n.toLocaleString().padStart(6) +
    b.wins.toLocaleString().padStart(7) + b.rate.toFixed(1).padStart(7) + '%' +
    b.meanConf.toFixed(1).padStart(8) + '%' +
    ((b.rate - b.meanConf) >= 0 ? '+' : '−') + Math.abs(b.rate - b.meanConf).toFixed(1).padStart(4) + 'pp' +
    (100 * b.meanAsk).toFixed(1).padStart(8) + 'c' + usd(b.pl).padStart(10) +
    (b.pl / b.staked).toFixed(3).padStart(9) +
    ('  [' + ci[0].toFixed(2) + '%, ' + ci[1].toFixed(2) + '%]').padStart(20));
}
console.log('  ("edge" is realised rate minus what the model claimed — before the fee.');
console.log('   The fee is already inside "ask", so a positive edge can still lose money.)');

/* Same split, night only — the two cuts Terry asked about, crossed. */
console.log('\n  night 10pm-2am only:');
console.log('  block        bets    won    rate   model    edge     ask     P&L      per $1');
for (const [label, klo, khi] of BLOCKS) {
  const g = night.filter((r) => r.k >= klo && r.k <= khi);
  if (!g.length) continue;
  const b = book(g);
  console.log('  ' + label.padEnd(12) + b.n.toLocaleString().padStart(6) +
    b.wins.toLocaleString().padStart(7) + b.rate.toFixed(1).padStart(7) + '%' +
    b.meanConf.toFixed(1).padStart(8) + '%' +
    ((b.rate - b.meanConf) >= 0 ? '+' : '−') + Math.abs(b.rate - b.meanConf).toFixed(1).padStart(4) + 'pp' +
    (100 * b.meanAsk).toFixed(1).padStart(8) + 'c' + usd(b.pl).padStart(10) +
    (b.pl / b.staked).toFixed(3).padStart(9));
}

/* Minute by minute, because a 5-minute block can hide a trend inside it. */
console.log('\n  per single minute:');
console.log('  k     bets    won    rate   model    edge      P&L      per $1');
for (let k = 1; k <= 14; k++) {
  const g = inBand.filter((r) => r.k === k);
  if (!g.length) continue;
  const b = book(g);
  console.log('  ' + String(k).padStart(2) + b.n.toLocaleString().padStart(9) +
    b.wins.toLocaleString().padStart(7) + b.rate.toFixed(1).padStart(7) + '%' +
    b.meanConf.toFixed(1).padStart(8) + '%' +
    ((b.rate - b.meanConf) >= 0 ? '+' : '−') + Math.abs(b.rate - b.meanConf).toFixed(1).padStart(4) + 'pp' +
    usd(b.pl).padStart(10) + (b.pl / b.staked).toFixed(3).padStart(9));
}

/* ---- the number that actually matters: what must the book ask? ---- */
console.log('\n== WHAT THE BOOK WOULD HAVE TO ASK ==');
console.log('  Same bets, but assume you fill at a FIXED discount to the model price');
console.log('  (this is what a real gap would look like). Cents are per contract.\n');
console.log('  discount   entire dataset        night 10pm-2am');
for (const dc of [0, 1, 2, 3, 4, 5, 7, 10]) {
  const run = (rs) => {
    let pl = 0, staked = 0;
    for (const r of rs) {
      const a = Math.max(0.01, price(r) - dc / 100);
      staked += STAKE;
      pl += r.won ? STAKE / a - STAKE : -STAKE;
    }
    return { pl, roi: 100 * pl / staked };
  };
  const a = run(inBand), b = run(night);
  console.log('  -' + String(dc).padStart(2) + 'c    ' + usd(a.pl).padStart(12) + ' (' +
    (a.roi >= 0 ? '+' : '') + a.roi.toFixed(2) + '%)' + usd(b.pl).padStart(14) + ' (' +
    (b.roi >= 0 ? '+' : '') + b.roi.toFixed(2) + '%)');
}

console.log('\n  IN-SAMPLE. B was fitted on this data. Entry price is assumed, not observed.');

/* ---- self-checks: pin the shape of the result, not just print it ---- */
{
  let ok = 0, fail = 0;
  const t = (name, cond) => { if (cond) { ok++; } else { fail++; console.log('  FAIL: ' + name); } };
  const fmt = (i) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: true })
    .format(new Date((D.META.start + i * 900) * 1000));

  t('band is inclusive 60..89', inBand.every((r) => r.conf >= 60 && r.conf <= 89));
  t('no read outside the band leaked in', !inBand.some((r) => r.conf < 60 || r.conf > 89));
  t('every bet takes the model side, both sides present',
    inBand.some((r) => r.side === 'U') && inBand.some((r) => r.side === 'D'));
  t('night set is exactly 10PM/11PM/12AM/1AM CT',
    [...new Set(night.map((r) => fmt(r.i)))].sort().join(',') === '1 AM,10 PM,11 PM,12 AM');
  t('night is 4/24 of sessions', Math.abs(sessNight / sessAll - 4 / 24) < 0.02);
  t('night + day partitions the band', night.length + day.length === inBand.length);
  t('flat sessions excluded', !reads.some((r) => fin(r.i) === 0));
  t('reads are minutes 1..14 only', reads.every((r) => r.k >= 1 && r.k <= 14));
  /* Fee must bite: mean all-in ask strictly above mean stated confidence. */
  t('fee makes ask exceed model price', 100 * bA.meanAsk > bA.meanConf);
  /* The headline: raw edge is positive but smaller than the fee. If either half
   * of that flips, the conclusion below is stale and must be rewritten. */
  t('raw edge before fees is positive', bA.rate - bA.meanConf > 0);
  t('raw edge is smaller than the fee', bA.rate - bA.meanConf < 100 * bA.meanAsk - bA.meanConf);
  t('=> net loss at the model price', bA.pl < 0);
  /* Integer-contract fills must not change the sign of the answer. */
  t('integer fills agree in sign with continuous', Math.sign(bA.iPl) === Math.sign(bA.pl));
  t('P&L is internally consistent', Math.abs(bA.staked - inBand.length * STAKE) < 1e-9);

  console.log('\n  self-checks: ' + ok + '/' + (ok + fail) + (fail ? '  *** ' + fail + ' FAILED ***' : ' pass'));
  if (fail) process.exitCode = 1;
}
