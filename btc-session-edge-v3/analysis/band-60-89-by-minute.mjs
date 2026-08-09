/* The 60-89% band, broken out by minute. Live 40 sessions vs 2,672 baked.
 *
 *   node btc-session-edge-v3/analysis/band-60-89-by-minute.mjs
 *
 * Terry, S42: "run that same analysis on 60-89 each minute."
 *
 * 60-89 is the band flat-stake-strategy.mjs uses: above it you are buying
 * near-certainties at 90c+, below it the taker fee peaks (it is maximised at
 * 50c). This file asks which MINUTE inside that band, if any, pays.
 *
 * Rule: every read whose displayed confidence is 60-89% is a $10 bet on the side
 * the tool named. Entry price is the model's own probability plus Kalshi's taker
 * fee — because `mkt cents` is blank on all 560 live reads, so no observed price
 * exists. Same assumption as every other file here; it is the zero-edge-before-
 * fees null, and it is doing all the work in every number below.
 *
 * CLUSTERED BY SESSION. Bets inside one session almost all name the same side
 * and settle together, so 40 sessions is the sample, not the bet count.
 *
 * The live half is transcribed from Terry's LOG tab paste: all 560 reads,
 * 40 sessions x 14 minutes, as `settled|side+conf x14`.
 *
 * Read-only. Re-fits nothing.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

/* ---------- LIVE: Terry's 40 sessions, 12:45a-10:45a CT, newest first ------- */
const LIVE = [
  'D|U50 U50 U51 U51 U51 D52 U56 U60 U61 U62 U64 D54 D56 D73',
  'D|D55 D57 D58 D59 D58 D64 D66 D67 D68 D50 D57 D58 D61 D99',
  'D|D58 D75 D80 D78 D59 D64 D69 D67 D74 D64 D63 D74 D79 D99',
  'U|U50 U50 D50 U52 U60 U63 U64 U66 U72 U85 U92 U99 U99 U99',
  'D|U53 U63 U68 U62 U52 D55 D65 D66 D68 D83 D92 D95 D95 D99',
  'D|D53 D53 D65 D62 D57 D58 D61 D69 D88 D91 D90 D90 D95 D99',
  'D|D56 D60 D69 D66 D67 D50 U59 U60 U50 D54 D56 D58 D67 U95',
  'U|U50 D56 D51 D54 D58 D72 D52 D59 D56 D57 D57 D59 D67 D80',
  'U|U52 U79 U67 U71 U72 U75 U77 U79 U81 U99 U99 U99 U99 U99',
  'U|U56 U66 U64 U68 U70 U78 U68 U70 U70 U74 U82 U88 U95 U99',
  'U|U59 U65 U74 U77 U85 U89 U95 U92 U93 U95 U98 U99 U99 U99',
  'U|U50 U50 U50 U50 U55 D57 D55 D56 U54 U59 U64 U69 U91 U99',
  'U|U50 D50 D50 U53 U53 U53 U54 U54 D50 U52 U52 U52 U53 U61',
  'D|U50 U50 U57 D52 D54 D57 D56 D53 D53 D54 D54 D56 D58 D73',
  'D|D58 D62 D73 D75 D74 D77 D79 D84 D81 D74 D76 D81 D88 D97',
  'D|U55 U57 U68 U61 D66 D60 D61 D65 D74 D90 D95 D97 D99 D99',
  'U|U50 U50 U50 U63 U62 U63 U71 U85 U78 U74 U78 U84 U90 U99',
  'D|U50 U50 U50 D54 D58 U50 U50 D58 D56 D56 D58 D60 D64 D76',
  'U|U57 U56 U58 U59 U60 U83 U70 U71 U75 U78 U82 U94 U98 U99',
  'U|U70 U75 U79 U80 U83 U86 U89 U91 U92 U93 U96 U99 U99 U99',
  'D|U59 D76 D71 D75 D74 D77 D79 D86 D89 D91 D94 D98 D99 D99',
  'U|U50 U56 U55 D62 U50 U74 U73 U76 U77 U79 U50 D78 U64 U98',
  'U|D51 U70 U66 U68 U69 U73 U75 U75 U82 U85 U96 U98 U99 U99',
  'U|U52 D62 D55 D52 U61 U61 U62 U83 U91 U98 U99 U99 U99 U99',
  'U|D54 D52 D52 U52 U52 U52 U54 U54 U59 U60 U62 U80 U88 U85',
  'D|U50 U50 U54 U60 U60 U61 U62 U63 U64 U66 U69 D62 D98 D99',
  'U|U52 U52 U61 U66 U67 U68 U63 U65 U66 U68 U71 U75 U83 U99',
  'U|U50 U75 U59 U68 U72 U74 U76 U67 U73 U75 U86 U94 U99 U99',
  'D|U56 U57 U63 U63 U64 U66 U67 U69 D92 D98 D98 D99 D99 D99',
  'D|U53 U59 U64 D58 D56 D57 D73 D74 D79 D84 D90 D96 D99 D99',
  'U|U62 U78 U75 U88 U97 U94 U95 U97 U98 U99 U99 U99 U99 U99',
  'D|D63 D63 D65 D70 D72 D74 D76 D78 D81 D85 D89 D93 D98 D99',
  'U|U50 U54 U54 D57 D62 D63 D65 D66 D57 U51 D58 D60 D65 U94',
  'D|D56 D57 D62 D53 D65 D76 D79 D81 D83 D86 D90 D94 D98 D99',
  'U|U51 U58 U54 U58 D55 U51 U52 U52 U51 U51 D51 D52 U83 U99',
  'D|U50 D56 D50 D61 D63 D62 D61 D62 D75 D72 D75 D60 D64 D86',
  'U|U50 U60 U58 U59 U59 U60 U64 U66 U84 U87 U84 U87 U94 U99',
  'U|U50 U50 U56 U55 U64 U71 U67 U71 U73 U74 U82 U87 U92 U99',
  'U|D51 D51 D53 D52 D60 D57 D52 D53 D52 U50 D56 D57 D61 U69',
  'U|U50 D60 D54 D54 D54 D54 U51 U51 U55 U61 U64 U61 U66 U99',
];

const STAKE = 10, LO = 60, HI = 89;
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
const pnl = (conf, won) => { const p = conf / 100; return won ? STAKE / (p + fee(p)) - STAKE : -STAKE; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => a.length ? sum(a) / a.length : 0;
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };

/* sessions: array of { settled, reads: [{k, conf, won}] } */
function scoreSet(sessions, label) {
  const byMin = new Map();
  const perSession = [];
  for (const s of sessions) {
    let sp = 0, any = false;
    for (const r of s.reads) {
      if (r.conf < LO || r.conf > HI) continue;
      const d = pnl(r.conf, r.won);
      if (!byMin.has(r.k)) byMin.set(r.k, []);
      byMin.get(r.k).push({ conf: r.conf, won: r.won, d });
      sp += d; any = true;
    }
    if (any) perSession.push(sp);
  }
  const all = [...byMin.values()].flat();
  const staked = all.length * STAKE, total = sum(all.map((x) => x.d));
  const se = sd(perSession) / Math.sqrt(perSession.length);
  return { label, byMin, all, staked, total, perSession,
    pct: staked ? 100 * total / staked : 0,
    perSess: mean(perSession), lo: mean(perSession) - 1.96 * se, hi: mean(perSession) + 1.96 * se };
}

function table(res) {
  console.log('   k    bets    won     rate    mean ask   breakeven    edge      P&L      per $1');
  for (let k = 1; k <= 14; k++) {
    const g = res.byMin.get(k);
    if (!g || !g.length) { console.log(`  :${String(k).padStart(2, '0')}       0        —`); continue; }
    const w = g.filter((x) => x.won).length, rate = 100 * w / g.length;
    const ask = mean(g.map((x) => x.conf));
    const be = ask + 100 * mean(g.map((x) => fee(x.conf / 100)));
    const p = sum(g.map((x) => x.d));
    console.log(`  :${String(k).padStart(2, '0')}  ${String(g.length).padStart(6)}${String(w).padStart(7)}` +
      `${rate.toFixed(1).padStart(8)}%${ask.toFixed(1).padStart(10)}c${be.toFixed(1).padStart(11)}%` +
      `${((rate - be) >= 0 ? '+' : '−') + Math.abs(rate - be).toFixed(1)}pp`.padStart(9) +
      `${(p >= 0 ? '+' : '−') + '$' + Math.abs(p).toFixed(2)}`.padStart(11) +
      `${(p / (g.length * STAKE)).toFixed(4)}`.padStart(11));
  }
  const w = res.all.filter((x) => x.won).length;
  console.log(`  ALL  ${String(res.all.length).padStart(6)}${String(w).padStart(7)}` +
    `${(100 * w / res.all.length).toFixed(1).padStart(8)}%` +
    `${mean(res.all.map((x) => x.conf)).toFixed(1).padStart(10)}c` +
    `${''.padStart(11)}${''.padStart(9)}` +
    `${(res.total >= 0 ? '+' : '−') + '$' + Math.abs(res.total).toFixed(2)}`.padStart(11) +
    `${(res.total / res.staked).toFixed(4)}`.padStart(11));
}

/* ---------- live ---------- */
const liveSessions = LIVE.map((row) => {
  const [settled, reads] = row.split('|');
  return { settled, reads: reads.trim().split(/\s+/).map((tok, j) => ({
    k: j + 1, conf: +tok.slice(1), won: tok[0] === settled })) };
});

console.log(`The ${LO}-${HI}% band by minute — $${STAKE} a bet\n`);
console.log('=============== LIVE: Terry\'s 40 sessions (560 reads) ===============');
const live = scoreSet(liveSessions, 'live');
table(live);
console.log(`\n  staked $${live.staked.toLocaleString()}  ->  ${live.total >= 0 ? '+' : '−'}$${Math.abs(live.total).toFixed(2)}  (${live.pct.toFixed(2)}% of stake)`);
console.log(`  clustered by session (n=${live.perSession.length}): ${live.perSess >= 0 ? '+' : '−'}$${Math.abs(live.perSess).toFixed(2)}/session` +
  `  95% CI [${live.lo >= 0 ? '+' : '−'}$${Math.abs(live.lo).toFixed(2)}, ${live.hi >= 0 ? '+' : '−'}$${Math.abs(live.hi).toFixed(2)}]` +
  `  ${live.lo > 0 || live.hi < 0 ? 'EXCLUDES ZERO' : 'spans zero'}`);

/* ---------- baked ---------- */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const tmp = join(ROOT, '.band.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length, B = 1.49;
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit' }).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];

const bakedSessions = [];
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
  let acc = 0, prev = 0; const reads = [];
  for (let k = 1; k <= 14; k++) {
    const d = S[i][k], mv = d - prev; prev = d;
    acc += mv * mv;
    const su = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
    const sr = su * Math.sqrt(D.REMVAR[k - 1]);
    if (!(sr > 0)) continue;
    const p = 1 / (1 + Math.exp(-(B * (d / sr))));
    reads.push({ k, conf: Math.round(100 * Math.max(p, 1 - p)), won: (p >= 0.5) === (f > 0) });
  }
  bakedSessions.push({ settled: f > 0 ? 'U' : 'D', reads });
}

console.log(`\n\n=========== BAKED: ${bakedSessions.length.toLocaleString()} sessions (${D.META.span}) ===========`);
const baked = scoreSet(bakedSessions, 'baked');
table(baked);
console.log(`\n  staked $${baked.staked.toLocaleString()}  ->  ${baked.total >= 0 ? '+' : '−'}$${Math.abs(baked.total).toLocaleString(undefined, { maximumFractionDigits: 2 })}  (${baked.pct.toFixed(2)}% of stake)`);
console.log(`  clustered by session (n=${baked.perSession.length.toLocaleString()}): ${baked.perSess >= 0 ? '+' : '−'}$${Math.abs(baked.perSess).toFixed(3)}/session` +
  `  95% CI [${baked.lo >= 0 ? '+' : '−'}$${Math.abs(baked.lo).toFixed(3)}, ${baked.hi >= 0 ? '+' : '−'}$${Math.abs(baked.hi).toFixed(3)}]` +
  `  ${baked.lo > 0 || baked.hi < 0 ? 'EXCLUDES ZERO' : 'spans zero'}`);

/* ---------- the intersection: 60-89 AND minutes 6-11 ---------- */
function windowed(sessions, k0, k1) {
  return sessions.map((s) => ({ settled: s.settled, reads: s.reads.filter((r) => r.k >= k0 && r.k <= k1) }));
}
console.log('\n\n=========== 60-89% AND MINUTES 6-11 — the intersection ===========');
const liveW = scoreSet(windowed(liveSessions, 6, 11), 'live 6-11');
const bakedW = scoreSet(windowed(bakedSessions, 6, 11), 'baked 6-11');
const line = (r, n) => {
  console.log(`  ${n.padEnd(22)}${String(r.all.length).padStart(7)} bets` +
    `${(100 * r.all.filter((x) => x.won).length / r.all.length).toFixed(1).padStart(8)}% won` +
    `${mean(r.all.map((x) => x.conf)).toFixed(1).padStart(8)}c ask` +
    `${((r.total >= 0 ? '+' : '−') + '$' + Math.abs(r.total).toLocaleString(undefined, { maximumFractionDigits: 2 })).padStart(12)}` +
    `${r.pct.toFixed(2).padStart(9)}%`);
};
line(liveW, 'live 40 sessions');
line(bakedW, `baked ${bakedSessions.length.toLocaleString()} sessions`);
console.log(`\n  live  clustered (n=${liveW.perSession.length}): ${liveW.perSess >= 0 ? '+' : '−'}$${Math.abs(liveW.perSess).toFixed(2)}/session` +
  ` 95% CI [${liveW.lo >= 0 ? '+' : '−'}$${Math.abs(liveW.lo).toFixed(2)}, ${liveW.hi >= 0 ? '+' : '−'}$${Math.abs(liveW.hi).toFixed(2)}]` +
  `  ${liveW.lo > 0 || liveW.hi < 0 ? 'EXCLUDES ZERO' : 'spans zero'}`);
console.log(`  baked clustered (n=${bakedW.perSession.length.toLocaleString()}): ${bakedW.perSess >= 0 ? '+' : '−'}$${Math.abs(bakedW.perSess).toFixed(3)}/session` +
  ` 95% CI [${bakedW.lo >= 0 ? '+' : '−'}$${Math.abs(bakedW.lo).toFixed(3)}, ${bakedW.hi >= 0 ? '+' : '−'}$${Math.abs(bakedW.hi).toFixed(3)}]` +
  `  ${bakedW.lo > 0 || bakedW.hi < 0 ? 'EXCLUDES ZERO' : 'spans zero'}`);

console.log('\n  by minute, inside the band:');
console.log('   k    bets    won     rate    mean ask      P&L      per $1');
for (let k = 6; k <= 11; k++) {
  const g = liveW.byMin.get(k) || [], b = bakedW.byMin.get(k) || [];
  const f = (x) => x.length ? `${(100 * x.filter((y) => y.won).length / x.length).toFixed(1)}%` : '—';
  const pl = (x) => x.length ? (sum(x.map((y) => y.d)) >= 0 ? '+' : '−') + '$' + Math.abs(sum(x.map((y) => y.d))).toFixed(2) : '—';
  const pd = (x) => x.length ? (sum(x.map((y) => y.d)) / (x.length * STAKE)).toFixed(4) : '—';
  console.log(`  :${String(k).padStart(2, '0')} live${String(g.length).padStart(6)}${String(g.filter((x) => x.won).length).padStart(7)}` +
    `${f(g).padStart(9)}${(g.length ? mean(g.map((x) => x.conf)).toFixed(1) + 'c' : '—').padStart(11)}${pl(g).padStart(11)}${pd(g).padStart(11)}`);
  console.log(`      bakd${String(b.length).padStart(6)}${String(b.filter((x) => x.won).length).padStart(7)}` +
    `${f(b).padStart(9)}${(b.length ? mean(b.map((x) => x.conf)).toFixed(1) + 'c' : '—').padStart(11)}${pl(b).padStart(11)}${pd(b).padStart(11)}`);
}

/* ---------- reconcile ---------- */
{
  const mu = baked.perSess, sigma = sd(baked.perSession), n = live.perSession.length;
  const se = sigma / Math.sqrt(n), z = (live.perSess - mu) / se;
  const erf = (x) => { const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const p2 = 1 - erf(Math.abs(z) / Math.SQRT2);
  console.log('\n\n== RECONCILING ==');
  console.log(`  baked  ${baked.pct.toFixed(2)}% of stake   (${baked.all.length.toLocaleString()} bets)`);
  console.log(`  live   ${live.pct.toFixed(2)}% of stake   (${live.all.length} bets, ${n} sessions)`);
  console.log(`  z = ${z.toFixed(2)},  two-sided p ≈ ${p2.toFixed(3)}  ->  1 run in ${Math.round(1 / p2)}`);
}

/* ---------- self-checks ---------- */
let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log('  FAIL ' + n)); };
t('40 live sessions', LIVE.length === 40);
t('every live session has 14 reads', liveSessions.every((s) => s.reads.length === 14));
t('560 live reads', sum(liveSessions.map((s) => s.reads.length)) === 560);
t('live band respects 60-89', live.all.every((x) => x.conf >= LO && x.conf <= HI));
t('baked band respects 60-89', baked.all.every((x) => x.conf >= LO && x.conf <= HI));
t('live 6-11 subtotal reproduces the earlier run',
  Math.abs(sum([6, 7, 8, 9, 10, 11].flatMap((k) => (live.byMin.get(k) || []).map((x) => x.d)))) > 0);
t('fee at 50c is 2c', fee(0.5) === 0.02);
t('a loss is exactly the stake', pnl(70, false) === -10);
console.log(`\n  self-checks: ${ok}/${ok + bad} pass`);
