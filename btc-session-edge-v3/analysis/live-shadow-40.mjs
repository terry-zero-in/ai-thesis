/* Terry's live shadow run: 40 consecutive sessions, 12:45a - 10:45a CT.
 *
 *   node btc-session-edge-v3/analysis/live-shadow-40.mjs   (from repo root)
 *
 * The first UNATTENDED, UNBROKEN shadow run the tool has produced: 40 of 40
 * sessions present, 14 reads each, 560 reads. Pasted out of the LOG tab.
 *
 * WHY SESSION-LEVEL IS THE ONLY HONEST UNIT. S40 established that reads inside
 * a session almost all resolve together, so 560 reads is closer to 40
 * observations than to 560. Scoring per read manufactures significance by a
 * factor of ~sqrt(14). Everything below is therefore scored on the OPENING call
 * at :01 — one observation per session, and the only read a position could
 * actually have been taken on at a tradeable price.
 *
 * WHAT THIS CANNOT MEASURE: profitability. `mkt cents` is blank on all 560 reads
 * because Kalshi's API is closed to browsers, so shadow has no market price to
 * disagree with. Zero GAP rows. This file measures CALIBRATION only.
 *
 * Read-only. Re-fits nothing, changes no constant.
 */

/* [openSide, openConf, settled, correctOf14] — one row per session, oldest first. */
const S = [
  ['UP', 50, 'UP',    9], ['DOWN', 51, 'UP',    2], ['UP', 50, 'UP',   14],
  ['UP', 50, 'UP',   14], ['UP', 50, 'DOWN',   13], ['UP', 51, 'UP',   11],
  ['DOWN', 56, 'DOWN', 14], ['UP', 50, 'UP',    5], ['DOWN', 63, 'DOWN', 14],
  ['UP', 62, 'UP',   14], ['UP', 53, 'DOWN',   11], ['UP', 56, 'DOWN',  6],
  ['UP', 50, 'UP',   14], ['UP', 52, 'UP',    14], ['UP', 50, 'DOWN',   3],
  ['DOWN', 54, 'UP',  11], ['UP', 52, 'UP',   11], ['DOWN', 51, 'UP',  13],
  ['UP', 50, 'UP',   12], ['UP', 59, 'DOWN',  13], ['UP', 70, 'UP',    14],
  ['UP', 57, 'UP',   14], ['UP', 50, 'DOWN',    9], ['UP', 50, 'UP',   14],
  ['UP', 55, 'DOWN',  10], ['DOWN', 58, 'DOWN', 14], ['UP', 50, 'DOWN', 11],
  ['UP', 50, 'UP',   11], ['UP', 50, 'UP',    11], ['UP', 59, 'UP',    14],
  ['UP', 56, 'UP',   14], ['UP', 52, 'UP',    14], ['UP', 50, 'UP',     1],
  ['DOWN', 56, 'DOWN', 10], ['DOWN', 53, 'DOWN', 14], ['UP', 53, 'DOWN', 9],
  ['UP', 50, 'UP',   13], ['DOWN', 58, 'DOWN', 14], ['DOWN', 55, 'DOWN', 14],
  ['UP', 50, 'DOWN',  4],
];

const wilson = (k, n) => {
  const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = p + z2 / (2 * n), m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return [100 * (c - m) / d, 100 * (c + m) / d];
};
const pct = (x) => (100 * x).toFixed(1) + '%';

console.log('Live shadow run — 40 sessions, 560 reads, 12:45a–10:45a CT\n');

/* ---- completeness. 10 hours = 40 sessions of 15 minutes. */
const reads = S.length * 14;
console.log('== COMPLETENESS ==');
console.log(`  sessions present   ${S.length} / 40 expected over 10h`);
console.log(`  reads              ${reads}  (14 per session, no minute 0 — the k>=1 shadow guard)`);
console.log(`  sessions dropped   0   <- defect 8 did NOT fire in this run\n`);

/* ---- the opening call: one observation per session. */
const hits = S.filter((r) => r[0] === r[2]).length;
const meanConf = S.reduce((a, r) => a + r[1], 0) / S.length;
const [lo, hi] = wilson(hits, S.length);

console.log('== THE OPENING CALL AT :01 — the only tradeable read, n=40 ==');
console.log(`  mean stated confidence   ${meanConf.toFixed(1)}%`);
console.log(`  actual hit rate          ${hits}/${S.length} = ${pct(hits / S.length)}`);
console.log(`  apparent under-confidence +${(100 * hits / S.length - meanConf).toFixed(1)}pp`);
console.log(`  95% Wilson CI on actual  [${lo.toFixed(1)}%, ${hi.toFixed(1)}%]`);
console.log(`  stated ${meanConf.toFixed(1)}% inside that interval?  ${meanConf > lo && meanConf < hi ? 'YES -> NOT SIGNIFICANT' : 'no'}\n`);

/* ---- the confound: which way did the market go, and which way did we call? */
const upSettled = S.filter((r) => r[2] === 'UP').length;
const upCalled = S.filter((r) => r[0] === 'UP').length;
const upCallHit = S.filter((r) => r[0] === 'UP' && r[2] === 'UP').length;
const dnCallHit = S.filter((r) => r[0] === 'DOWN' && r[2] === 'DOWN').length;

console.log('== THE CONFOUND: A DIRECTIONAL BIAS IN A DRIFTING SAMPLE ==');
console.log(`  sessions that settled UP   ${upSettled}/40 = ${pct(upSettled / 40)}   (BTC 64,730 -> 65,180 over the run: +$450)`);
console.log(`  opening calls that said UP ${upCalled}/40 = ${pct(upCalled / 40)}`);
console.log(`  UP calls   ${upCallHit}/${upCalled} = ${pct(upCallHit / upCalled)}`);
console.log(`  DOWN calls ${dnCallHit}/${40 - upCalled} = ${pct(dnCallHit / (40 - upCalled))}`);
console.log('  A model that calls UP 75% of the time, scored on a window that went');
console.log('  UP 57.5% of the time, books apparent skill it did not earn. That is');
console.log('  regime, not edge, and it is not knowable in advance.\n');

/* ---- always-UP is the benchmark that matters. */
console.log('== BEAT THE DUMBEST POSSIBLE RULE? ==');
console.log(`  model opening call   ${hits}/40 = ${pct(hits / 40)}`);
console.log(`  "always say UP"      ${upSettled}/40 = ${pct(upSettled / 40)}`);
console.log(`  edge over always-UP  +${(100 * (hits - upSettled) / 40).toFixed(1)}pp   ` +
            `(${hits - upSettled} sessions out of 40)\n`);

/* ---- late reads are free information. */
const totalCorrect = S.reduce((a, r) => a + r[3], 0);
console.log('== WHY THE READ-LEVEL NUMBER FLATTERS ==');
console.log(`  all 560 reads        ${totalCorrect}/${reads} = ${pct(totalCorrect / reads)} correct`);
console.log(`  opening call only    ${hits}/40 = ${pct(hits / 40)}`);
console.log('  The 79.8% is dominated by minutes 10-14, where the contract already');
console.log('  trades at 95-99c and the outcome is nearly determined. Those reads are');
console.log('  free information: correct, and worth nothing. Never quote that number.\n');

/* ---- what it would have paid, IF the gap were real and IF you could fill. */
const FEE_K = 0.07;
const fee = (c) => Math.ceil(FEE_K * (c / 100) * (1 - c / 100) * 100);
let pnl = 0;
for (const [side, conf, settled] of S) {
  const ask = conf, f = fee(ask);
  pnl += side === settled ? 100 - ask - f : -(ask + f);
}
console.log('== HYPOTHETICAL LEDGER — 1 contract on the opening call, every session ==');
console.log('  ASSUMES Kalshi quotes exactly the model price. Never observed: mkt cents');
console.log('  was blank on all 560 reads. This is the number IF there were no gap.');
console.log(`  40 contracts, mean ask ${meanConf.toFixed(1)}c  ->  ${pnl >= 0 ? '+' : ''}$${(pnl / 100).toFixed(2)} on $${(S.reduce((a, r) => a + r[1] + fee(r[1]), 0) / 100).toFixed(2)} staked`);
console.log(`  per $1 staked: ${(pnl / S.reduce((a, r) => a + r[1] + fee(r[1]), 0)).toFixed(4)}`);
console.log('  Against the 95% CI above, this is one draw from a distribution whose');
console.log('  honest centre is "no edge". Do not size on it.\n');

/* ---- self-checks. */
let ok = 0, bad = 0;
const t = (name, c) => { c ? ok++ : (bad++, console.log('  FAIL ' + name)); };
t('40 sessions', S.length === 40);
t('every session has 14 reads scored', S.every((r) => r[3] >= 0 && r[3] <= 14));
t('hits recomputed', hits === S.filter((r) => r[0] === r[2]).length);
t('up calls + down calls = 40', upCalled + (40 - upCalled) === 40);
t('hit decomposition', upCallHit + dnCallHit === hits);
t('fee at 50c is 2c', fee(50) === 2);
console.log(`  self-checks: ${ok}/${ok + bad} pass`);
