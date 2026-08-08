/* Does resting orders instead of taking make the strategy profitable?
 *
 *   node btc-session-edge-v3/analysis/maker-fill-backtest.mjs   (from repo root)
 *
 * Terry, S41, after opening the Kalshi Pro ticket: it has a "Post only" box,
 * and ceilings() already computes a maker ceiling on makerMult ?? 0. On the
 * same 18,440 bets, zero fee turns -$1,112 into +$3,437. So: rest, don't take?
 *
 * THE THING THAT DECIDES IT IS NOT THE FEE, IT IS THE FILL.
 *
 * A taker transacts whenever he wants. A maker transacts when the market comes
 * to him — and on a binary contract the price IS the market's probability, so a
 * resting bid at a cents fills exactly when the market's estimate falls to a.
 * If the market is calibrated, being at a means the true chance is a, and the
 * fill is worth a. Zero fee, zero edge, exactly breakeven. That is adverse
 * selection stated precisely: on a martingale, the fill itself is the news.
 *
 * That is the null this measures. It is not a rhetorical point — the whole
 * +$3,437 depends on transacting at the model's price on demand, which is the
 * one thing a maker cannot do.
 *
 * MARKET MODEL, and it is the load-bearing assumption:
 *   The baked set has no Kalshi quotes, so the market's price path has to come
 *   from somewhere. It comes from the model itself. That is not laziness — S40
 *   established the model is calibrated to about 1pp in every band over 37,408
 *   reads, and a calibrated probability path IS an efficient market's price
 *   path. So model-as-market is the honest null: a market exactly as good as we
 *   are. Under it there is no edge to harvest by construction, and what the
 *   simulation measures is how much the FILL MECHANICS cost on top of that.
 *
 *   The consequence, stated up front so no number here is over-read: this
 *   CANNOT show maker profits from superior forecasting, because it grants the
 *   market equal skill. It can show whether resting is mechanically survivable,
 *   what fraction fills, and how much true edge over the market you would need
 *   before resting pays. That last number is the useful output.
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
const tmp = join(ROOT, '.maker.tmp.mjs');
writeFileSync(tmp, zlib.gunzipSync(Buffer.from(man[ext.find((e) => e.id === 'sessData').uuid].data, 'base64')).toString());
const D = await import('file://' + tmp);
rmSync(tmp);

const S = D.SESS, N = S.length, B = 1.49, STAKE = 10;
const LO = 60, HI = 89;
const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
const med = (a) => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const HRS = [...Array(N).keys()].map((i) => +new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', hour12: false, hour: '2-digit'
}).format(new Date((D.META.start + i * 900) * 1000)) % 24);
const fin = (i) => S[i][15];
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---- the probability path, one row per minute, same pipeline as the replay ---- */
const paths = [];
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
  const p = [];
  for (let k = 1; k <= 14; k++) {
    const d = S[i][k], mv = d - prev; prev = d;
    acc += mv * mv;
    const sigmaUnit = 0.6 * trail + 0.4 * Math.sqrt(acc / k);
    const sigmaRem = sigmaUnit * Math.sqrt(D.REMVAR[k - 1]);
    p.push(sigmaRem > 0 ? 1 / (1 + Math.exp(-(B * (d / sigmaRem)))) : null);
  }
  paths.push({ i, up: f > 0, p });
}

/* ---- 1. the taker baseline, for reference ---- */
function taker() {
  let n = 0, pl = 0, wins = 0;
  for (const s of paths) for (let k = 0; k < 14; k++) {
    const p = s.p[k]; if (p == null) continue;
    const conf = Math.round(100 * Math.max(p, 1 - p));
    if (conf < LO || conf > HI) continue;
    const won = (p >= 0.5) === s.up;
    const pr = conf / 100, a = pr + fee(pr);
    n++; if (won) wins++;
    pl += won ? STAKE / a - STAKE : -STAKE;
  }
  return { n, pl, wins };
}

/* ---- 2. the maker simulation ----
 * At minute k the model wants `side`. Instead of lifting the offer it RESTS a
 * bid `disc` cents under its own valuation and waits. The market's price for
 * that side at minute k' is the model's own probability there (see header), so
 * the order fills the first time that price touches the bid. Unfilled orders
 * expire worthless and, importantly, cost nothing — capital is only deployed on
 * a fill, which is why fill rate is reported next to P&L.                    */
function maker(disc, { cancelAfter = 99 } = {}) {
  let posted = 0, filled = 0, wins = 0, pl = 0, staked = 0, sumAsk = 0;
  for (const s of paths) {
    for (let k = 0; k < 14; k++) {
      const p = s.p[k]; if (p == null) continue;
      const conf = Math.round(100 * Math.max(p, 1 - p));
      if (conf < LO || conf > HI) continue;
      const yes = p >= 0.5;
      posted++;
      /* Rest `disc` under the model's own number. Maker fee is zero, so the
         valuation IS the raw probability — no fee-adjusted ceiling here. */
      const bid = conf - disc;
      if (bid < 1) continue;
      let hit = -1;
      for (let k2 = k; k2 < Math.min(14, k + cancelAfter); k2++) {
        const q = s.p[k2]; if (q == null) continue;
        const mkt = Math.round(100 * (yes ? q : 1 - q));   /* market ask for our side */
        if (mkt <= bid) { hit = k2; break; }
      }
      if (hit < 0) continue;                                /* never came to us */
      filled++;
      const won = yes === s.up;
      const contracts = STAKE / (bid / 100);
      staked += STAKE; sumAsk += bid;
      if (won) wins++;
      pl += won ? contracts * (1 - bid / 100) : -STAKE;
    }
  }
  return { posted, filled, wins, pl, staked, meanAsk: filled ? sumAsk / filled : 0 };
}

console.log('Maker fill backtest — ' + paths.length.toLocaleString() + ' sessions, ' + D.META.span);
console.log('Strategy: $' + STAKE + '/min, model reads ' + LO + '-' + HI + '%, either side.');
console.log('Market price path = the model itself (calibrated ~1pp over 37,408 reads). See header.\n');

const t = taker();
console.log('== BASELINE ==');
console.log('  taker, always transacts, pays fee      ' + t.n.toLocaleString() + ' bets   ' +
  usd(t.pl) + '  (' + (100 * t.pl / (t.n * STAKE)).toFixed(2) + '%)');
/* The fantasy number: transact on demand AND pay nothing. Neither role gets
   this — a taker pays the fee, a maker does not get to transact on demand. */
let zf = 0; for (const s of paths) for (let k = 0; k < 14; k++) {
  const p = s.p[k]; if (p == null) continue;
  const conf = Math.round(100 * Math.max(p, 1 - p));
  if (conf < LO || conf > HI) continue;
  const won = (p >= 0.5) === s.up, pr = conf / 100;
  zf += won ? STAKE / pr - STAKE : -STAKE;
}
console.log('  same bets at zero fee (unreachable)    ' + t.n.toLocaleString() + ' bets   ' +
  usd(zf) + '  (' + (100 * zf / (t.n * STAKE)).toFixed(2) + '%)  <- the +1.86% figure\n');

console.log('== MAKER: rest N cents under the model, zero fee, hold to expiry ==');
console.log('  disc   posted   filled   fill%   won%    P&L on filled     per $1   mean fill');
for (const d of [0, 1, 2, 3, 5, 8, 12]) {
  const m = maker(d);
  if (!m.filled) continue;
  console.log('  ' + (d + 'c').padStart(4) + m.posted.toLocaleString().padStart(9) +
    m.filled.toLocaleString().padStart(9) + (100 * m.filled / m.posted).toFixed(1).padStart(7) + '%' +
    (100 * m.wins / m.filled).toFixed(1).padStart(7) + '%' + usd(m.pl).padStart(17) +
    (m.pl / m.staked).toFixed(4).padStart(11) + m.meanAsk.toFixed(1).padStart(11) + 'c');
}

console.log('\n== WHY: what the fill tells you ==');
console.log('  If the market is calibrated, filling at a cents means the true chance IS about');
console.log('  a. Below, the realised win rate on fills is compared with the price paid.\n');
console.log('  disc   mean fill price   realised win rate   difference');
for (const d of [0, 1, 2, 3, 5, 8, 12]) {
  const m = maker(d);
  if (!m.filled) continue;
  const wr = 100 * m.wins / m.filled;
  console.log('  ' + (d + 'c').padStart(4) + m.meanAsk.toFixed(1).padStart(15) + 'c' +
    wr.toFixed(1).padStart(19) + '%' + ((wr - m.meanAsk) >= 0 ? '+' : '') + (wr - m.meanAsk).toFixed(1).padStart(12) + 'pp');
}

/* ---- 2b. the obvious objection: nobody leaves a bid sitting while the market
 * runs them over. Cancel after W minutes and repost. If the damage is a few
 * catastrophic fills on collapsing paths, a short window should dodge them. */
console.log('\n== DOES CANCELLING HELP? rest 2c under, pull the order after W minutes ==');
console.log('  W       filled   fill%   won%   mean fill    P&L         per $1');
for (const w of [1, 2, 3, 5, 14]) {
  const m = maker(2, { cancelAfter: w });
  if (!m.filled) continue;
  console.log('  ' + String(w).padStart(2) + 'min' + m.filled.toLocaleString().padStart(11) +
    (100 * m.filled / m.posted).toFixed(1).padStart(7) + '%' +
    (100 * m.wins / m.filled).toFixed(1).padStart(7) + '%' + m.meanAsk.toFixed(1).padStart(10) + 'c' +
    usd(m.pl).padStart(14) + (m.pl / m.staked).toFixed(4).padStart(11));
}

/* ---- 3. how much true edge would you need? ----
 * Grant the model a real edge over the market: the market's price is the model
 * shaded by `edge` points toward 50, so the model is genuinely better by that
 * much. Resting then fills at prices that are cheap relative to the truth.  */
console.log('\n== HOW MUCH EDGE OVER THE MARKET WOULD MAKE RESTING PAY? ==');
console.log('  The market is given the model\'s view shaded `edge` pp toward 50, so the model');
console.log('  is genuinely better by that much. Resting at 2c under, zero fee.\n');
console.log('  edge over mkt   filled   fill%    won%      P&L        per $1');
for (const e of [0, 1, 2, 3, 5]) {
  let filled = 0, posted = 0, wins = 0, pl = 0, staked = 0;
  for (const s of paths) for (let k = 0; k < 14; k++) {
    const p = s.p[k]; if (p == null) continue;
    const conf = Math.round(100 * Math.max(p, 1 - p));
    if (conf < LO || conf > HI) continue;
    const yes = p >= 0.5;
    posted++;
    const bid = conf - 2;
    if (bid < 1) continue;
    let hit = -1;
    for (let k2 = k; k2 < 14; k2++) {
      const q = s.p[k2]; if (q == null) continue;
      /* market = model shaded toward 50 by e points */
      const mq = q >= 0.5 ? q - e / 100 : q + e / 100;
      const mkt = Math.round(100 * (yes ? mq : 1 - mq));
      if (mkt <= bid) { hit = k2; break; }
    }
    if (hit < 0) continue;
    filled++;
    const won = yes === s.up;
    staked += STAKE; if (won) wins++;
    pl += won ? STAKE / (bid / 100) - STAKE : -STAKE;
  }
  if (!filled) { console.log('  ' + (e + 'pp').padStart(8) + '        never fills'); continue; }
  console.log('  ' + (e + 'pp').padStart(8) + filled.toLocaleString().padStart(16) +
    (100 * filled / posted).toFixed(1).padStart(7) + '%' + (100 * wins / filled).toFixed(1).padStart(8) + '%' +
    usd(pl).padStart(12) + (pl / staked).toFixed(4).padStart(11));
}

console.log('\n  IN-SAMPLE, and the market is a model of the market. The fill mechanics are');
console.log('  real; the edge over Kalshi is assumed, and nothing here can measure it.');
