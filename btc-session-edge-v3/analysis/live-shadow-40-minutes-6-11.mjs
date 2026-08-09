/* "What are the returns if I bet on minutes 6-11, $10 each?" — Terry, S42.
 *
 *   node btc-session-edge-v3/analysis/live-shadow-40-minutes-6-11.mjs
 *
 * Scored on HIS OWN 40-session shadow run (12:45a-10:45a CT), not the baked set.
 * 40 sessions x 6 minutes = 240 bets. Transcribed from the LOG tab paste:
 * per read, the side the tool called, the confidence it showed, and whether the
 * session settled that way.
 *
 * THE ASSUMPTION THAT DECIDES EVERY NUMBER BELOW — read it before believing any:
 *
 *   `mkt cents` is BLANK on all 560 reads in this run. Kalshi's API is closed to
 *   browsers, so shadow never recorded what the book was actually asking. A
 *   return therefore cannot be computed without inventing an entry price, and
 *   this file invents the only one the data justifies: YOU PAY THE MODEL'S OWN
 *   PROBABILITY, PLUS KALSHI'S TAKER FEE. Buy a 72% call for 72c + 2c.
 *
 *   That is the zero-edge-before-fees assumption. It is not neutral and it is
 *   not pessimistic-for-effect: it is what "we never observed the price" forces.
 *   If Kalshi was cheaper than the model at these confidences the real answer is
 *   better; if dearer, worse. NOTHING IN THIS RUN MEASURES THAT. Only the GAP
 *   tab can, and it needs the market price typed on a live read.
 *
 * CLUSTERING. Bets inside one session are not independent — in most sessions all
 * six minutes call the same side and settle together. So the confidence interval
 * is computed over the 40 SESSIONS (each contributing its summed P&L), never over
 * the 240 bets. Treating them as 240 independent trials shrinks the error bar by
 * ~sqrt(6) and manufactures significance.
 *
 * Read-only. Re-fits nothing.
 */

/* [settled, [ [k6side,k6conf], ... [k11side,k11conf] ] ] — newest session first. */
const RAW = [
  ['D', [['D',52],['U',56],['U',60],['U',61],['U',62],['U',64]]],
  ['D', [['D',64],['D',66],['D',67],['D',68],['D',50],['D',57]]],
  ['D', [['D',64],['D',69],['D',67],['D',74],['D',64],['D',63]]],
  ['U', [['U',63],['U',64],['U',66],['U',72],['U',85],['U',92]]],
  ['D', [['D',55],['D',65],['D',66],['D',68],['D',83],['D',92]]],
  ['D', [['D',58],['D',61],['D',69],['D',88],['D',91],['D',90]]],
  ['D', [['D',50],['U',59],['U',60],['U',50],['D',54],['D',56]]],
  ['U', [['D',72],['D',52],['D',59],['D',56],['D',57],['D',57]]],
  ['U', [['U',75],['U',77],['U',79],['U',81],['U',99],['U',99]]],
  ['U', [['U',78],['U',68],['U',70],['U',70],['U',74],['U',82]]],
  ['U', [['U',89],['U',95],['U',92],['U',93],['U',95],['U',98]]],
  ['U', [['D',57],['D',55],['D',56],['U',54],['U',59],['U',64]]],
  ['U', [['U',53],['U',54],['U',54],['D',50],['U',52],['U',52]]],
  ['D', [['D',57],['D',56],['D',53],['D',53],['D',54],['D',54]]],
  ['D', [['D',77],['D',79],['D',84],['D',81],['D',74],['D',76]]],
  ['D', [['D',60],['D',61],['D',65],['D',74],['D',90],['D',95]]],
  ['U', [['U',63],['U',71],['U',85],['U',78],['U',74],['U',78]]],
  ['D', [['U',50],['U',50],['D',58],['D',56],['D',56],['D',58]]],
  ['U', [['U',83],['U',70],['U',71],['U',75],['U',78],['U',82]]],
  ['U', [['U',86],['U',89],['U',91],['U',92],['U',93],['U',96]]],
  ['D', [['D',77],['D',79],['D',86],['D',89],['D',91],['D',94]]],
  ['U', [['U',74],['U',73],['U',76],['U',77],['U',79],['U',50]]],
  ['U', [['U',73],['U',75],['U',75],['U',82],['U',85],['U',96]]],
  ['U', [['U',61],['U',62],['U',83],['U',91],['U',98],['U',99]]],
  ['U', [['U',52],['U',54],['U',54],['U',59],['U',60],['U',62]]],
  ['D', [['U',61],['U',62],['U',63],['U',64],['U',66],['U',69]]],
  ['U', [['U',68],['U',63],['U',65],['U',66],['U',68],['U',71]]],
  ['U', [['U',74],['U',76],['U',67],['U',73],['U',75],['U',86]]],
  ['D', [['U',66],['U',67],['U',69],['D',92],['D',98],['D',98]]],
  ['D', [['D',57],['D',73],['D',74],['D',79],['D',84],['D',90]]],
  ['U', [['U',94],['U',95],['U',97],['U',98],['U',99],['U',99]]],
  ['D', [['D',74],['D',76],['D',78],['D',81],['D',85],['D',89]]],
  ['U', [['D',63],['D',65],['D',66],['D',57],['U',51],['D',58]]],
  ['D', [['D',76],['D',79],['D',81],['D',83],['D',86],['D',90]]],
  ['U', [['U',51],['U',52],['U',52],['U',51],['U',51],['D',51]]],
  ['D', [['D',62],['D',61],['D',62],['D',75],['D',72],['D',75]]],
  ['U', [['U',60],['U',64],['U',66],['U',84],['U',87],['U',84]]],
  ['U', [['U',71],['U',67],['U',71],['U',73],['U',74],['U',82]]],
  ['U', [['D',57],['D',52],['D',53],['D',52],['U',50],['D',56]]],
  ['U', [['D',54],['U',51],['U',51],['U',55],['U',61],['U',64]]],
];

const STAKE = 10;
/* Kalshi taker fee, dollars per contract, same ceil-to-the-cent as ceilings(). */
const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
/* $10 buys STAKE/(price+fee) contracts; each returns $1 if it settles your way. */
const pnl = (conf, won) => { const p = conf / 100; return won ? STAKE / (p + fee(p)) - STAKE : -STAKE; };

const bets = [], perSession = [], perMinute = new Map();
RAW.forEach(([settled, reads], si) => {
  let sp = 0;
  reads.forEach(([side, conf], j) => {
    const k = j + 6, won = side === settled, d = pnl(conf, won);
    bets.push({ k, conf, won, d }); sp += d;
    if (!perMinute.has(k)) perMinute.set(k, []);
    perMinute.get(k).push({ conf, won, d });
  });
  perSession.push({ si, settled, d: sp });
});

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => sum(a) / a.length;
const total = sum(bets.map((b) => b.d));
const staked = bets.length * STAKE;
const wins = bets.filter((b) => b.won).length;
const meanConf = mean(bets.map((b) => b.conf));

console.log('Minutes 6-11, $10 a bet — Terry\'s 40-session live shadow run\n');
console.log('== THE HEADLINE ==');
console.log(`  bets              ${bets.length}   (40 sessions x 6 minutes)`);
console.log(`  staked            $${staked.toFixed(2)}`);
console.log(`  won               ${wins}/${bets.length} = ${(100 * wins / bets.length).toFixed(1)}%`);
console.log(`  mean price paid   ${meanConf.toFixed(1)}c + ${(100 * mean(bets.map((b) => fee(b.conf / 100)))).toFixed(1)}c fee`);
console.log(`  breakeven needed  ${(meanConf + 100 * mean(bets.map((b) => fee(b.conf / 100)))).toFixed(1)}%`);
console.log(`  NET               ${total >= 0 ? '+' : '−'}$${Math.abs(total).toFixed(2)}   (${(100 * total / staked).toFixed(2)}% of stake)\n`);

/* ---- clustered CI: 40 sessions, not 240 bets. */
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };
const sess = perSession.map((s) => s.d);
const se = sd(sess) / Math.sqrt(sess.length);
const lo = mean(sess) - 1.96 * se, hi = mean(sess) + 1.96 * se;
console.log('== IS IT REAL? CLUSTERED BY SESSION (n=40, not 240) ==');
console.log(`  P&L per session   ${mean(sess) >= 0 ? '+' : '−'}$${Math.abs(mean(sess)).toFixed(2)}  ± $${(1.96 * se).toFixed(2)}`);
console.log(`  95% CI            [${lo >= 0 ? '+' : '−'}$${Math.abs(lo).toFixed(2)}, ${hi >= 0 ? '+' : '−'}$${Math.abs(hi).toFixed(2)}] per session`);
console.log(`  over 40 sessions  [${(40 * lo) >= 0 ? '+' : '−'}$${Math.abs(40 * lo).toFixed(2)}, ${(40 * hi) >= 0 ? '+' : '−'}$${Math.abs(40 * hi).toFixed(2)}]`);
console.log(`  excludes zero?    ${lo > 0 || hi < 0 ? 'YES' : 'NO  -> not distinguishable from break-even'}\n`);

console.log('== BY MINUTE — is any one of the six carrying it? ==');
console.log('  k     bets   won    rate   mean ask    P&L');
for (const k of [...perMinute.keys()].sort((a, b) => a - b)) {
  const g = perMinute.get(k), w = g.filter((x) => x.won).length, p = sum(g.map((x) => x.d));
  console.log(`  :${String(k).padStart(2, '0')}   ${String(g.length).padStart(5)}` +
    `${String(w).padStart(6)}${(100 * w / g.length).toFixed(1).padStart(8)}%` +
    `${mean(g.map((x) => x.conf)).toFixed(1).padStart(9)}c   ${p >= 0 ? '+' : '−'}$${Math.abs(p).toFixed(2)}`);
}

console.log('\n== WHAT THE BOOK WOULD HAVE TO ASK ==');
console.log('  Same 240 bets, but you fill a fixed discount under the model price.');
console.log('  This is what a real gap would look like.\n');
console.log('  discount    P&L        % of stake');
for (const d of [0, 1, 2, 3, 5, 7, 10]) {
  const t = sum(bets.map((b) => { const p = Math.max(1, b.conf - d) / 100; return b.won ? STAKE / (p + fee(p)) - STAKE : -STAKE; }));
  console.log(`  −${String(d).padStart(2)}c      ${t >= 0 ? '+' : '−'}$${Math.abs(t).toFixed(2).padStart(8)}    ${(100 * t / staked).toFixed(2)}%`);
}

console.log('\n== FOR CONTRAST: THE SAME RULE ON ALL 14 MINUTES ==');
console.log('  (transcribed only for 6-11, so this is the 60-89% band figure from');
console.log('   the 2,688-session baked replay, not from this run)');
console.log('  18,440 bets, taker fee, model price: −$1,112.35 (−0.60%)');

/* ---- self-checks. */
let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log('  FAIL ' + n)); };
t('40 sessions', RAW.length === 40);
t('6 reads each', RAW.every((r) => r[1].length === 6));
t('240 bets', bets.length === 240);
t('minutes are 6..11', [...perMinute.keys()].sort((a, b) => a - b).join() === '6,7,8,9,10,11');
t('session P&L sums to total', Math.abs(sum(sess) - total) < 1e-9);
t('fee at 50c is 2c', fee(0.5) === 0.02);
t('a loss is exactly the stake', pnl(70, false) === -10);
console.log(`\n  self-checks: ${ok}/${ok + bad} pass`);
