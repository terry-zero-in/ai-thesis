/* Is 75 minutes special, and does the prior-session TREND predict anything?
 *
 *   node btc-session-edge-v3/analysis/lookback-sweep.mjs   (from repo root)
 *
 * Terry, S41: "is the 75mn starting point important or no" and, harder:
 * "For this thing to be 100x more accurate it's got to be taking into account
 *  the trend in prior sessions ... IT MUST be looking at this."
 *
 * driftNudge is the only signed term in the whole model. It reads
 * net = strike − px75, where px75 is the opening price five sessions back, and
 * nudges AGAINST that move. So the model already holds a directional view — the
 * question is whether 5 sessions is the right window, and whether the SHAPE of
 * the prior move (a streak, a pattern) carries anything beyond its SIZE.
 *
 * Two different claims get tested separately here, because S40 found they do
 * not behave the same way:
 *
 *   SIZE  — how far price has travelled over the last L sessions
 *   SHAPE — how many of the last L sessions closed the same direction (a streak)
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
const tmp = join(ROOT, '.sweep.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length;
const fin = (i) => S[i][15];
/* Wilson, so a bucket that looks extreme on 40 samples cannot masquerade as a
   finding. Every claim below lives or dies on whether this bracket clears 50. */
const wil = (k, n) => { if (!n) return [0, 100]; const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n,
  c = p + z2 / (2 * n), m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return [100 * (c - m) / d, 100 * (c + m) / d]; };
const netOver = (i, L) => { let s = 0; for (let j = i - L; j < i; j++) s += fin(j); return s; };

console.log('Prior-session signal sweep — ' + N.toLocaleString() + ' sessions, ' + D.META.span);
console.log('Sessions are 15 min, so L sessions = L*15 minutes of lookback.\n');

/* ---------- 1. SIZE. Does a big prior move fade? ---------- */
console.log('== 1. SIZE — does the last L sessions\' net move predict the next? ==');
console.log('   "fade" = big move up is followed by a DOWN session. Split at |net| >= $80,');
console.log('   the threshold S40 found; the row is the up-move bucket vs the down-move bucket.\n');
console.log('   L   mins   n(up)  next-up%   [95% CI]      n(dn)  next-up%   [95% CI]     separation');
let best = null;
for (const L of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]) {
  const up = [], dn = [];
  for (let i = L; i < N; i++) {
    const f = fin(i); if (f === 0) continue;
    const net = netOver(i, L);
    if (net >= 80) up.push(f > 0); else if (net <= -80) dn.push(f > 0);
  }
  if (up.length < 30 || dn.length < 30) continue;
  const uw = up.filter(Boolean).length, dw = dn.filter(Boolean).length;
  const ur = 100 * uw / up.length, dr = 100 * dw / dn.length;
  const [ul, uh] = wil(uw, up.length), [dl, dh] = wil(dw, dn.length);
  /* Separation only counts when NEITHER interval straddles 50 — otherwise the
     two buckets are not distinguishable from one coin. */
  const clean = uh < 50 && dl > 50;
  const sep = dr - ur;
  if (clean && (!best || sep > best.sep)) best = { L, sep };
  console.log('  ' + String(L).padStart(2) + String(L * 15).padStart(6) +
    String(up.length).padStart(8) + ur.toFixed(1).padStart(9) + '%  [' + ul.toFixed(0).padStart(2) + ',' + uh.toFixed(0).padStart(3) + ']' +
    String(dn.length).padStart(9) + dr.toFixed(1).padStart(9) + '%  [' + dl.toFixed(0).padStart(2) + ',' + dh.toFixed(0).padStart(3) + ']' +
    (sep >= 0 ? '+' : '') + sep.toFixed(1).padStart(9) + 'pp' + (clean ? '  *' : ''));
}
console.log('\n  * = both buckets clear 50 with the whole interval. Best separation: ' +
  (best ? 'L=' + best.L + ' (' + best.L * 15 + ' min), ' + best.sep.toFixed(1) + 'pp' : 'none clean'));

/* ---------- 2. SHAPE. Does a STREAK predict, beyond size? ---------- */
console.log('\n== 2. SHAPE — does a run of same-direction sessions predict the next? ==');
console.log('   This is the candlestick claim: N greens in a row means something.\n');
console.log('   streak   n(up run)  next-up%   [95% CI]     n(dn run)  next-up%   [95% CI]');
for (const R of [2, 3, 4, 5, 6]) {
  const au = [], ad = [];
  for (let i = R; i < N; i++) {
    const f = fin(i); if (f === 0) continue;
    let allUp = true, allDn = true;
    for (let j = i - R; j < i; j++) { if (fin(j) <= 0) allUp = false; if (fin(j) >= 0) allDn = false; }
    if (allUp) au.push(f > 0); if (allDn) ad.push(f > 0);
  }
  if (au.length < 20 || ad.length < 20) continue;
  const aw = au.filter(Boolean).length, dw = ad.filter(Boolean).length;
  const [al, ah] = wil(aw, au.length), [dl, dh] = wil(dw, ad.length);
  console.log('   ' + String(R).padStart(2) + ' in a row' + String(au.length).padStart(9) +
    (100 * aw / au.length).toFixed(1).padStart(9) + '%  [' + al.toFixed(0).padStart(2) + ',' + ah.toFixed(0).padStart(3) + ']' +
    String(ad.length).padStart(11) + (100 * dw / ad.length).toFixed(1).padStart(9) + '%  [' + dl.toFixed(0).padStart(2) + ',' + dh.toFixed(0).padStart(3) + ']');
}

/* ---------- 3. SIZE vs SHAPE, head to head ---------- */
console.log('\n== 3. Head to head — hold the streak fixed, vary the size ==');
console.log('   If SHAPE carried information the two size buckets inside one streak length');
console.log('   would agree. If only SIZE matters they separate and the streak is irrelevant.\n');
console.log('   3-session run   bucket             n   next-up%   [95% CI]');
for (const [lab, want] of [['up run', true], ['down run', false]]) {
  for (const [blab, lo, hi] of [['small |net| < $80', 0, 80], ['big |net| >= $80', 80, 1e9]]) {
    const hits = [];
    for (let i = 3; i < N; i++) {
      const f = fin(i); if (f === 0) continue;
      let run = true;
      for (let j = i - 3; j < i; j++) { if ((fin(j) > 0) !== want) { run = false; break; } }
      if (!run) continue;
      const a = Math.abs(netOver(i, 3));
      if (a >= lo && a < hi) hits.push(f > 0);
    }
    if (hits.length < 20) continue;
    const w = hits.filter(Boolean).length, [l, h] = wil(w, hits.length);
    console.log('   ' + lab.padEnd(15) + blab.padEnd(19) + String(hits.length).padStart(4) +
      (100 * w / hits.length).toFixed(1).padStart(10) + '%  [' + l.toFixed(0).padStart(2) + ',' + h.toFixed(0).padStart(3) + ']');
  }
}

/* ---------- 4. How big is any of this next to volatility? ---------- */
console.log('\n== 4. Scale check — direction vs volatility ==');
const halves = [[], []];
for (let i = 5; i < N; i++) {
  const f = fin(i); if (f === 0) continue;
  halves[Math.abs(netOver(i, 5)) >= 80 ? 1 : 0].push(Math.abs(f));
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('   mean |final move| after a small 5-session net: $' + mean(halves[0]).toFixed(1));
console.log('   mean |final move| after a big   5-session net: $' + mean(halves[1]).toFixed(1) +
  '   (' + (100 * (mean(halves[1]) / mean(halves[0]) - 1)).toFixed(0) + '% larger)');
console.log('\n   The prior move predicts HOW FAR far better than WHICH WAY. That is the');
console.log('   asymmetry the model already exploits — mult() reads size, driftNudge reads');
console.log('   direction, and size is the one carrying the weight.');
