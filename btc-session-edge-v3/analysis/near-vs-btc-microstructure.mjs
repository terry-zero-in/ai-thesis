/* NEAR vs BTC on the things that decide whether Terry's 15-minute strategy works.
 *
 *   node btc-session-edge-v3/analysis/near-vs-btc-microstructure.mjs
 *
 * Terry, S42: NEAR's chart is a stair-step, he thinks nobody trades it, and he
 * believes that once a direction is established early in a session it does not
 * flip — so entering around 60c and selling at 90-95c is close to free money.
 *
 * That reduces to ONE measurable quantity:
 *
 *     GIVEN THE SIDE AT MINUTE k, HOW OFTEN DOES THE SESSION FINISH THERE?
 *
 * Everything else is bookkeeping around it. The economics, from the quotes in
 * his own screenshots (NEAR round-trip spread 6.4-12c, mean ~9c; BTC 1c):
 *
 *   hold to expiry, entering at a 60c ask   win +40c  lose -60c  break-even 60%
 *   exit at ~81c bid when the mid shows 90  win +21c  lose -49c  break-even 70%
 *
 * Note the ordering — exiting early RAISES the bar. Giving up 19c of upside to
 * avoid 11c of downside is a bad trade at a 9c spread, which is the opposite of
 * the intuition that taking profits early is safer.
 *
 * WHAT IS MEASURED
 *   1. Volatility, in PERCENT — the only way to compare a $1.63 asset to a
 *      $65,000 one. Absolute dollars are meaningless across them.
 *   2. Trade activity — the fraction of minutes where the price does not move at
 *      all, which is what produces the stair-step. A flat minute is not low
 *      volatility, it is a minute with no trades, and the two have very
 *      different implications for what happens next.
 *   3. Sign flips per session — Terry's explicit question.
 *   4. PERSISTENCE — P(final side == side at minute k). The decisive number.
 *   5. The strategy priced with a real spread, both exit rules.
 *
 * WHAT THIS CANNOT SETTLE. Kalshi does not settle on Coinbase; it settles on an
 * index averaged over the final minute. And these are EXCHANGE prices, not the
 * Kalshi order book, so the spread used below comes from Terry's screenshots
 * rather than from history. A persistence number measured here is a property of
 * NEAR's price path; whether Kalshi's book lets you monetise it is a separate
 * question this data cannot answer.
 *
 * Read-only. Consumes analysis/data/*-1m.json from fetch-coinbase-minutes.mjs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');

/* Kalshi's 15-minute series align to :00 / :15 / :30 / :45. */
const SESSION = 900;
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function load(product) {
  const p = join(DATA, `${product}-1m.json`);
  if (!existsSync(p)) throw new Error(`missing ${p} — run fetch-coinbase-minutes.mjs first`);
  const d = JSON.parse(readFileSync(p, 'utf8'));
  /* rows: [ts, low, high, open, close, volume] */
  const byTs = new Map();
  for (const r of d.rows) byTs.set(r[0], { ts: r[0], low: r[1], high: r[2], open: r[3], close: r[4], vol: r[5] });
  return { ...d, byTs };
}

/* Build complete 15-minute sessions. A session is kept only if all 15 minutes
   are present — a gap means Coinbase had no trades, and silently treating the
   previous close as the current one would fabricate exactly the flatness this
   script exists to measure. Dropped sessions are counted and reported. */
/* FILL controls what happens to a minute Coinbase never printed:
     'strict' drops the whole session — clean, but on NEAR it discards ~87% of
              them and keeps only the busiest stretches, which biases every
              number toward NEAR looking more liquid than it is.
     'ffill'  carries the previous close forward at zero volume. A minute with
              no trade genuinely IS a minute where the price did not change, and
              Kalshi settles on an index that always has a value, so this is the
              more faithful reconstruction of what the contract saw.
   Both are reported. If they disagree, the disagreement is the finding. */
const FILL = process.argv.includes('--strict') ? 'strict' : 'ffill';

function sessions(d) {
  const out = [];
  let dropped = 0, filled = 0;
  const first = Math.ceil(d.from / SESSION) * SESSION;
  for (let t = first; t + SESSION <= d.to; t += SESSION) {
    const mins = [];
    let ok = true, prevClose = null;
    /* seed the carry from the last known close before this session */
    for (let back = 1; back <= 60 && prevClose == null; back++) {
      const c = d.byTs.get(t - back * 60);
      if (c) prevClose = c.close;
    }
    for (let m = 0; m < 15; m++) {
      const c = d.byTs.get(t + m * 60);
      if (c) { mins.push(c); prevClose = c.close; continue; }
      if (FILL === 'strict' || prevClose == null) { ok = false; break; }
      mins.push({ ts: t + m * 60, low: prevClose, high: prevClose, open: prevClose, close: prevClose, vol: 0 });
      filled++;
    }
    if (!ok) { dropped++; continue; }
    const strike = mins[0].open;
    if (!(strike > 0)) { dropped++; continue; }
    out.push({
      t, strike, mins,
      closes: mins.map((m) => m.close),
      deltas: mins.map((m) => m.close - strike),
      vol: mins.reduce((a, m) => a + m.vol, 0),
    });
  }
  return { list: out, dropped, filled };
}

const pct = (v, base) => 100 * v / base;
const fmt = (v, n = 4) => v.toFixed(n);

function analyse(product) {
  const d = load(product);
  const { list, dropped, filled } = sessions(d);
  const px = list.length ? list[Math.floor(list.length / 2)].strike : 1;

  /* ---- 1. volatility, in percent ---- */
  let absMoves = [], flatMinutes = 0, totalMinutes = 0, volSum = 0;
  for (const s of list) {
    let prev = s.strike;
    for (const c of s.mins) {
      const mv = c.close - prev; prev = c.close;
      absMoves.push(Math.abs(mv) / s.strike);
      if (mv === 0) flatMinutes++;
      totalMinutes++;
      volSum += c.vol;
    }
  }
  const rmsPct = 100 * Math.sqrt(absMoves.reduce((a, v) => a + v * v, 0) / absMoves.length);
  const meanAbsPct = 100 * absMoves.reduce((a, v) => a + v, 0) / absMoves.length;

  /* ---- 2. sign flips per session ---- */
  const flips = [], zeroEnd = [];
  for (const s of list) {
    let last = 0, n = 0;
    for (const dd of s.deltas) {
      const sg = dd > 0 ? 1 : dd < 0 ? -1 : 0;
      if (sg !== 0) { if (last !== 0 && sg !== last) n++; last = sg; }
    }
    flips.push(n);
    if (s.deltas[14] === 0) zeroEnd.push(s);
  }
  const flipHist = {};
  for (const f of flips) flipHist[Math.min(f, 6)] = (flipHist[Math.min(f, 6)] || 0) + 1;

  /* ---- 3. persistence: P(final side == side at minute k) ---- */
  const persist = [];
  for (let k = 1; k <= 14; k++) {
    let n = 0, same = 0;
    for (const s of list) {
      const dk = s.deltas[k - 1], df = s.deltas[14];
      if (dk === 0 || df === 0) continue;
      n++;
      if ((dk > 0) === (df > 0)) same++;
    }
    persist.push({ k, n, same, rate: n ? 100 * same / n : NaN });
  }

  return { product, d, list, dropped, px, rmsPct, meanAbsPct, flatMinutes, totalMinutes,
    volSum, flips, flipHist, persist, zeroEnd: zeroEnd.length, filled };
}

/* clustered bootstrap over sessions for a persistence rate */
function persistCI(list, k, seed) {
  const rows = [];
  for (const s of list) {
    const dk = s.deltas[k - 1], df = s.deltas[14];
    if (dk === 0 || df === 0) continue;
    rows.push((dk > 0) === (df > 0) ? 1 : 0);
  }
  if (!rows.length) return [NaN, NaN];
  const rand = rng(seed), out = [];
  for (let b = 0; b < 4000; b++) {
    let s = 0;
    for (let i = 0; i < rows.length; i++) s += rows[(rand() * rows.length) | 0];
    out.push(100 * s / rows.length);
  }
  out.sort((a, b) => a - b);
  return [out[100], out[3899]];
}

const A = {};
for (const p of ['NEAR-USD', 'BTC-USD']) A[p] = analyse(p);

console.log('NEAR vs BTC — 1-minute Coinbase candles, 15-minute sessions aligned to :00/:15/:30/:45\n');
console.log('  metric                          NEAR-USD          BTC-USD');
console.log('  ' + '-'.repeat(62));
const row = (label, f) => console.log('  ' + label.padEnd(30) + String(f(A['NEAR-USD'])).padStart(14) + String(f(A['BTC-USD'])).padStart(17));
row('sessions (complete)', (a) => a.list.length.toLocaleString());
row('sessions dropped (gaps)', (a) => a.dropped.toLocaleString());
row('reference price', (a) => '$' + a.px.toLocaleString(undefined, { maximumFractionDigits: 4 }));
row('per-minute RMS move', (a) => fmt(a.rmsPct, 4) + '%');
row('per-minute mean |move|', (a) => fmt(a.meanAbsPct, 4) + '%');
row('minutes with NO price change', (a) => fmt(100 * a.flatMinutes / a.totalMinutes, 1) + '%');
row('sessions ending exactly flat', (a) => a.zeroEnd.toLocaleString());
row('mean sign flips / session', (a) => fmt(a.flips.reduce((x, y) => x + y, 0) / a.flips.length, 2));
row('sessions with ZERO flips', (a) => fmt(100 * a.flips.filter((f) => f === 0).length / a.flips.length, 1) + '%');

console.log('\n=== 1. SIGN FLIPS PER SESSION — "how many times does above/below flip?" ===\n');
console.log('  flips      NEAR              BTC');
for (let f = 0; f <= 6; f++) {
  const n = A['NEAR-USD'].flipHist[f] || 0, b = A['BTC-USD'].flipHist[f] || 0;
  const nn = A['NEAR-USD'].flips.length, bb = A['BTC-USD'].flips.length;
  console.log('  ' + (f === 6 ? '6+' : String(f)).padEnd(9) +
    (n.toLocaleString() + ' (' + fmt(100 * n / nn, 1) + '%)').padEnd(18) +
    (b.toLocaleString() + ' (' + fmt(100 * b / bb, 1) + '%)'));
}

console.log('\n=== 2. PERSISTENCE — P(finishes on the side it is on at minute k) ===\n');
console.log('  THE decisive number. Terry enters at minute 1.\n');
console.log('  minute      NEAR    n        95% CI            BTC     n        95% CI');
for (const k of [1, 2, 3, 4, 5, 7, 10, 12]) {
  const n = A['NEAR-USD'].persist[k - 1], b = A['BTC-USD'].persist[k - 1];
  const nc = persistCI(A['NEAR-USD'].list, k, 3000 + k), bc = persistCI(A['BTC-USD'].list, k, 4000 + k);
  console.log('  k=' + String(k).padEnd(9) + fmt(n.rate, 1).padStart(5) + '%' +
    n.n.toLocaleString().padStart(7) + ('  [' + fmt(nc[0], 1) + ', ' + fmt(nc[1], 1) + ']').padEnd(20) +
    fmt(b.rate, 1).padStart(5) + '%' + b.n.toLocaleString().padStart(7) +
    ('  [' + fmt(bc[0], 1) + ', ' + fmt(bc[1], 1) + ']'));
}

console.log('\n=== 3. THE STRATEGY, PRICED WITH A REAL SPREAD ===\n');
console.log('  Entry at minute 1 on whichever side the price is already on.');
console.log('  Spread taken from Terry\'s own screenshots: NEAR ~9c round trip, BTC ~1c.\n');
console.log('  Break-even win rates at a 60c ask:');
console.log('    hold to expiry                win +40c  lose -60c  ->  60.0%');
console.log('    exit at ~81c bid when mid 90  win +21c  lose -49c  ->  70.0%\n');
console.log('  asset   persistence @ k=1   hold-to-expiry     exit-at-90');
for (const p of ['NEAR-USD', 'BTC-USD']) {
  const r = A[p].persist[0].rate / 100;
  const hold = r * 40 - (1 - r) * 60;
  const early = r * 21 - (1 - r) * 49;
  console.log('  ' + p.replace('-USD', '').padEnd(8) + fmt(100 * r, 1).padStart(10) + '%' +
    ((hold >= 0 ? '  +' : '  ') + fmt(hold, 1) + 'c/trade').padStart(20) +
    ((early >= 0 ? '  +' : '  ') + fmt(early, 1) + 'c/trade').padStart(18));
}
console.log('\n  Positive = the edge beats the spread. Negative = it does not.');
console.log('\n  CAVEAT: entry is assumed at a flat 60c ask on every trade. In reality the');
console.log('  ask depends on how far the price has already moved, and a session that is');
console.log('  barely off the strike at minute 1 will not be quoted at 60c. This overstates');
console.log('  the strategy when the move is small and understates it when the move is big.');
console.log('  The persistence column is the measurement; the cent columns are an');
console.log('  illustration of what it is worth at ONE assumed entry price.');
console.log('\n  Coinbase is a PROXY. Kalshi settles on an index averaged over the final');
console.log('  minute, and its order book is not in this dataset.');
