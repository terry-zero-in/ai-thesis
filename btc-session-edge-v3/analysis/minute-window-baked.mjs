/* Does the minutes 6-11 window hold up on 2,688 sessions?
 *
 *   node btc-session-edge-v3/analysis/minute-window-baked.mjs
 *
 * Terry's 40-session live run showed minutes 6-11 at $10 a bet returning
 * +14.76% of stake, with a session-clustered CI that excludes zero. That is the
 * first positive result this project has produced. It is also the third time a
 * small live sample has looked profitable, and the previous two did not survive
 * the baked set (S40: 15 sessions implied +21% on turnover; 37,408 reads put the
 * real figure at +0.7pp).
 *
 * So: replay the SAME rule — enter every minute in the window, $10 a bet, pay
 * the model's own probability plus Kalshi's taker fee — over all 2,688 baked
 * sessions, and sweep every contiguous window so 6-11 can be seen in context
 * rather than in isolation.
 *
 * Same pipeline as calibration-replay.mjs: B=1.49, the 12-session median M on
 * |finalDelta|, the 0.6/0.4 sigma blend, REMVAR[k-1]. Not a reimplementation of
 * the model's intent — the same arithmetic that file already reproduces against
 * the artifact's own methods.
 *
 * IN-SAMPLE: B was fitted on this data. Calibration this good is partly what
 * fitting produces. That caveat makes the baked set a WEAK POSITIVE test and a
 * STRONG NEGATIVE one: if a window cannot show an edge even here, where the
 * constant was tuned, it has none.
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
const tmp = join(ROOT, '.window.tmp.mjs');
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
const pnl = (conf, won) => { const p = conf / 100; return won ? STAKE / (p + fee(p)) - STAKE : -STAKE; };

/* One row per (session, minute): the confidence shown and whether it was right. */
const sessions = [];
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
  const reads = [];
  for (let k = 1; k <= 14; k++) {
    const d = S[i][k], mv = d - prev; prev = d;
    acc += mv * mv;
    const sigmaUnit = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
    const sigmaRem = sigmaUnit * Math.sqrt(D.REMVAR[k - 1]);
    if (!(sigmaRem > 0)) { reads.push(null); continue; }
    const p = 1 / (1 + Math.exp(-(B * (d / sigmaRem))));
    reads.push({ k, conf: Math.round(100 * Math.max(p, 1 - p)), won: (p >= 0.5) === (f > 0) });
  }
  sessions.push(reads);
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => sum(a) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };

/* Score a window, clustered by session. */
function score(k0, k1) {
  const per = [];
  let bets = 0, wins = 0, conf = 0;
  for (const reads of sessions) {
    let sp = 0, any = false;
    for (let k = k0; k <= k1; k++) {
      const r = reads[k - 1];
      if (!r) continue;
      sp += pnl(r.conf, r.won); bets++; conf += r.conf; if (r.won) wins++; any = true;
    }
    if (any) per.push(sp);
  }
  const total = sum(per), staked = bets * STAKE;
  const se = sd(per) / Math.sqrt(per.length);
  return { k0, k1, bets, wins, conf: conf / bets, total, pct: 100 * total / staked,
    sessions: per.length, perSess: mean(per), lo: mean(per) - 1.96 * se, hi: mean(per) + 1.96 * se };
}

console.log(`Baked replay — ${N.toLocaleString()} sessions (${D.META.span}), $${STAKE} a bet\n`);

const target = score(6, 11);
console.log('== THE WINDOW TERRY ASKED ABOUT: MINUTES 6-11 ==');
console.log(`  bets              ${target.bets.toLocaleString()}   (${target.sessions.toLocaleString()} sessions x 6 minutes)`);
console.log(`  staked            $${(target.bets * STAKE).toLocaleString()}`);
console.log(`  won               ${(100 * target.wins / target.bets).toFixed(1)}%`);
console.log(`  mean price paid   ${target.conf.toFixed(1)}c`);
console.log(`  NET               ${target.total >= 0 ? '+' : '−'}$${Math.abs(target.total).toFixed(2)}   (${target.pct.toFixed(2)}% of stake)`);
console.log(`  per session       ${target.perSess >= 0 ? '+' : '−'}$${Math.abs(target.perSess).toFixed(3)}  95% CI [${target.lo >= 0 ? '+' : '−'}$${Math.abs(target.lo).toFixed(3)}, ${target.hi >= 0 ? '+' : '−'}$${Math.abs(target.hi).toFixed(3)}]`);
console.log(`  excludes zero?    ${target.lo > 0 || target.hi < 0 ? 'YES' : 'NO'}\n`);

console.log('  LIVE 40-session run, same rule:  +$354.25 on $2,400  = +14.76%');
console.log(`  BAKED ${target.sessions.toLocaleString()}-session replay:        ` +
  `${target.total >= 0 ? '+' : '−'}$${Math.abs(target.total).toLocaleString(undefined, { maximumFractionDigits: 2 })} on $${(target.bets * STAKE).toLocaleString()}  = ${target.pct.toFixed(2)}%\n`);

console.log('== EVERY CONTIGUOUS WINDOW — is 6-11 special, or is nothing? ==');
console.log('  window    bets     won     ask      P&L        % stake   CI excl 0');
const all = [];
for (let a = 1; a <= 14; a++) for (let b = a; b <= 14; b++) all.push(score(a, b));
for (const w of all.filter((x) => x.k1 - x.k0 === 5)) {
  console.log(`  ${String(w.k0).padStart(2)}-${String(w.k1).padStart(2)}  ${String(w.bets).padStart(7)}` +
    `${(100 * w.wins / w.bets).toFixed(1).padStart(8)}%${w.conf.toFixed(1).padStart(8)}c  ` +
    `${(w.total >= 0 ? '+' : '−') + '$' + Math.abs(w.total).toFixed(0)}`.padStart(10) +
    `${w.pct.toFixed(2).padStart(9)}%   ${w.lo > 0 || w.hi < 0 ? (w.lo > 0 ? 'YES +' : 'YES −') : 'no'}`);
}

const best = [...all].sort((x, y) => y.pct - x.pct)[0];
const worst = [...all].sort((x, y) => x.pct - y.pct)[0];
console.log(`\n  best  of ${all.length} windows: ${best.k0}-${best.k1}  ${best.pct.toFixed(2)}%   (${best.bets.toLocaleString()} bets)`);
console.log(`  worst of ${all.length} windows: ${worst.k0}-${worst.k1}  ${worst.pct.toFixed(2)}%`);
console.log(`  windows profitable: ${all.filter((w) => w.pct > 0).length}/${all.length}`);
console.log('  Searching 105 windows and reporting the best one is how noise gets a');
console.log('  name. The number that matters is 6-11 on its own line, above.');

/* ---- reconcile the two runs. How surprising is the live result, IF the baked
   figure is the truth? Per-session P&L is the unit; 40 sessions is the sample. */
{
  const per = [];
  for (const reads of sessions) {
    let sp = 0;
    for (let k = 6; k <= 11; k++) { const r = reads[k - 1]; if (r) sp += pnl(r.conf, r.won); }
    per.push(sp);
  }
  const mu = mean(per), sigma = sd(per), n = 40, LIVE = 354.25 / n;
  const se = sigma / Math.sqrt(n);
  const z = (LIVE - mu) / se;
  const erf = (x) => { const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y; };
  const p2 = 1 - erf(Math.abs(z) / Math.SQRT2);
  console.log('\n== RECONCILING THE TWO ==');
  console.log(`  baked per-session P&L   mean ${mu >= 0 ? '+' : '−'}$${Math.abs(mu).toFixed(3)}  sd $${sigma.toFixed(2)}`);
  console.log(`  live  per-session P&L   mean +$${LIVE.toFixed(2)}  over ${n} sessions`);
  console.log(`  z vs the baked truth    ${z.toFixed(2)}   two-sided p ≈ ${p2.toFixed(3)}`);
  console.log(`  1 run in ${Math.round(1 / p2)} looks this good by chance.`);
  console.log(`  There are ${all.length} contiguous windows to choose from, so ~${(all.length * p2).toFixed(1)} of them`);
  console.log('  should look this good on any 40-session sample with no edge at all.');
}

/* ---- self-checks. */
let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log('  FAIL ' + n)); };
t('sessions replayed', sessions.length > 2600);
t('6-11 is six minutes per session', target.bets === target.sessions * 6);
t('105 contiguous windows', all.length === 105);
t('fee at 50c is 2c', fee(0.5) === 0.02);
t('a loss is exactly the stake', pnl(70, false) === -10);
t('full window 1-14 matches read count', score(1, 14).bets === sessions.length * 14);
console.log(`\n  self-checks: ${ok}/${ok + bad} pass`);
