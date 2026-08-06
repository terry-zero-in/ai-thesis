/* Behavioural tests for the defects the in-artifact harness cannot reach.
 *
 *   node tools/behaviour.mjs
 *
 * selfTest() covers the model math, but Tasks 3/4/5/7/8/9/10 are behavioural —
 * a session roll, a 150-row refit, a FIFO queue drain. The build plan verifies
 * those by hand ("wait for the quarter-hour to roll"). That is not repeatable,
 * so this harness loads the real Component class out of the x-dc block, stubs
 * DCLogic and localStorage, and drives it directly. Same code, no browser.
 *
 * Exit code is the number of failures.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src', 'app.html'), 'utf8');

/* ---- pull the dataset module out of the bundle manifest so renderVals() has
   the real SHAPE/REMVAR/SESS arrays rather than a fixture that could drift. */
const bundle = readFileSync(join(ROOT, 'index.html'), 'utf8');
const man = JSON.parse(bundle.match(/<script type="__bundler\/manifest">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const ext = JSON.parse(bundle.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n {2}<\/script>/)[1]);
const dataUuid = ext.find((e) => e.id === 'sessData').uuid;
const rec = man[dataUuid];
const dataJs = zlib.gunzipSync(Buffer.from(rec.data, 'base64')).toString();
const tmp = join(ROOT, '.dataset.tmp.mjs');
writeFileSync(tmp, dataJs);
const D = await import('file://' + tmp);

/* ---- minimal host. __setLogicState mirrors the real runtime: it mutates
   logic.state synchronously, then would re-render. */
class DCLogic {
  constructor(props) { this.props = props || {}; }
  setState(update, cb) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    if (cb) cb();
  }
  forceUpdate() {}
}
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i]
};
Object.defineProperty(globalThis.localStorage, Symbol.iterator, { value: undefined });
/* Object.keys(localStorage) must see the stored keys for STORE.keys(). */
globalThis.localStorage = new Proxy(globalThis.localStorage, {
  ownKeys: () => [...store.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
});

const body = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const Component = new Function('DCLogic', body + '\nreturn Component;')(DCLogic);

/* ---- harness ---- */
let fails = 0;
const rows = [];
const t = (name, pass, got, want) => { if (!pass) fails++; rows.push({ name, pass, got, want }); };
const mk = (props = {}) => {
  const c = new Component(props);
  c.state = { now: Date.now(), view: 'trade', data: D, strike: '', priceIn: '', px75: '', mkt: '',
    macroOn: false, finalIn: '', rows: [], sess: {}, auto: false, autoPx: null, autoAt: null,
    autoErr: null, csvLabel: 'copy CSV', clearArm: false,
    shadowOn: false, srows: [], shadow: { ts: null, strike: null, pts: [], lastK: -1 },
    sAt: null, sErr: null };
  return c;
};

/* ---- Task 4: px75 carry-forward ---- */
{
  const c = mk();
  const ts = 1783486800;
  c.state.sess = { [ts - 4500]: { pts: [{ k: 3, p: 64123 }, { k: 7, p: 64200 }] } };
  t('T4 autoPx75 takes first price 5 sessions back', c.autoPx75(ts) === '64123', c.autoPx75(ts), '64123');
  t('T4 autoPx75 empty when that session absent', c.autoPx75(ts + 900) === '', c.autoPx75(ts + 900), '');
  c.state.sess = { [ts - 4500]: { pts: [] } };
  t('T4 autoPx75 empty when session never engaged', c.autoPx75(ts) === '', c.autoPx75(ts), '');
}

/* ---- Task 3: session roll clears strike and demotes it to a ghost ---- */
{
  const c = mk();
  const ts0 = Math.floor(Date.now() / 1000 / 900) * 900;
  c._sessTs = ts0;
  c.state.strike = '64850'; c.state.priceIn = '872'; c.state.mkt = '61';
  c.state.sess = { [ts0 + 900 - 4500]: { pts: [{ k: 2, p: 64010 }] } };
  /* replay exactly what the interval body does on a roll */
  const ts1 = ts0 + 900;
  c._sessTs = ts1;
  c.setState({ now: Date.now(), priceIn: '', mkt: '', strike: '',
    ghost: c.state.strike || c.state.ghost, px75: c.autoPx75(ts1) });
  t('T3 strike cleared on roll', c.state.strike === '', c.state.strike, '');
  t('T3 priceIn cleared on roll', c.state.priceIn === '', c.state.priceIn, '');
  t('T3 mkt cleared on roll', c.state.mkt === '', c.state.mkt, '');
  t('T3 old strike demoted to ghost', c.state.ghost === '64850', c.state.ghost, '64850');
  t('T3 px75 re-derived on roll', c.state.px75 === '64010', c.state.px75, '64010');
}

/* ---- Task 8: pendingSession drains FIFO ---- */
{
  const c = mk();
  const now = Math.floor(Date.now() / 1000 / 900) * 900;
  const a = now - 2700, b = now - 1800, d = now - 900;
  c.state.sess = {
    [a]: { resolved: null, window: 'A' },
    [b]: { resolved: null, window: 'B' },
    [d]: { resolved: null, window: 'D' }
  };
  t('T8 offers OLDEST unresolved, not newest', c.pendingSession().ts === a, c.pendingSession().e.window, 'A');
  c.state.sess[a].resolved = 'U';
  t('T8 drains forward after resolve', c.pendingSession().ts === b, c.pendingSession().e.window, 'B');
  c.state.sess[d].resolved = 'U';
  c.state.sess[b].resolved = null;
  t('T8 skipped session stays reachable', c.pendingSession().ts === b, c.pendingSession().e.window, 'B');
  c.state.sess[b].resolved = 'D';
  t('T8 null when queue drained', c.pendingSession() === null, c.pendingSession(), null);
}

/* ---- Task 7: maker fee is prop-driven ---- */
{
  const free = mk({ makerMult: 0 }), paid = mk({ makerMult: 1 });
  const cf = free.ceilings(0.62), cp = paid.ceilings(0.62);
  t('T7 makerMult=0 -> maker ceiling is raw probability', cf.yesM === 62, cf.yesM, 62);
  t('T7 makerMult=1 -> maker ceiling drops', cp.yesM < cf.yesM, cp.yesM, '<' + cf.yesM);
  t('T7 taker unaffected by makerMult', cf.yesT === cp.yesT, cf.yesT, cp.yesT);
  t('T7 makerLabel reads free at M=0', free.renderVals().makerLabel === '(free, M=0)', free.renderVals().makerLabel, '(free, M=0)');
  t('T7 makerLabel reads M=1', paid.renderVals().makerLabel === '(M=1)', paid.renderVals().makerLabel, '(M=1)');
}

/* ---- Task 5: B refit ---- */
{
  const c = mk();
  t('T5 refitB null below 150 v2 rows', c.refitB() === null, c.refitB(), null);
  /* 149 rows must still be inert */
  const row = (z, up, v) => ({ z, resolved: up ? 'U' : 'D', v, pFull: 0.6, ab: {}, mktCents: null });
  c.state.rows = Array.from({ length: 149 }, (_, i) => row((i % 10) / 5 - 1, i % 2 === 0, 2));
  t('T5 still inert at n=149', c.refitB() === null, c.refitB(), null);
  /* a clean separable-ish sample with a known-ish slope: y depends on z */
  c.state.rows = Array.from({ length: 400 }, (_, i) => {
    const z = ((i % 40) - 20) / 10;                       // -2.0 .. +1.9
    const p = 1 / (1 + Math.exp(-2.0 * z));               // true B = 2.0
    return row(z, (i * 2654435761 % 1000) / 1000 < p, 2);
  });
  const fit = c.refitB();
  t('T5 refits once n>=150', typeof fit === 'number', fit, 'number');
  t('T5 fit lands in [1.2,2.4] band', fit >= 1.2 && fit <= 2.4, fit, '1.2..2.4');
  /* v1 rows are excluded — 400 v1 rows alone must not trigger a fit */
  const c1 = mk();
  c1.state.rows = Array.from({ length: 400 }, (_, i) => row((i % 10) / 5 - 1, i % 2 === 0, undefined));
  t('T5 pre-fix v1 rows excluded from refit', c1.refitB() === null, c1.refitB(), null);
  /* activeB reports fitted vs ruled honestly */
  const ab0 = mk().activeB();
  t('T5 activeB falls back to ruled B', ab0.fitted === false && Math.abs(ab0.B - 1.77) < 1e-9, ab0.B + '/' + ab0.fitted, '1.77/false');
  const ab1 = c.activeB();
  t('T5 activeB reports fitted', ab1.fitted === true && ab1.n === 400, ab1.fitted + '/' + ab1.n, 'true/400');
  /* cache keyed on scored-v2 count */
  c._bCache = { n: 400, B: 1.99 };
  t('T5 activeB serves cache until count moves', c.activeB().B === 1.99, c.activeB().B, 1.99);
}

/* ---- Task 9 + 10: flip dot and saves-vs-costs ---- */
{
  const c = mk();
  /* a row whose noMom ablation crosses the 0.5 side line */
  const flipRow = { ts: Date.now(), sessionTs: 1, k: 5, strike: 64850, price: 64872, delta: 22,
    sigmaUnit: 27, z: 0.4, pFull: 0.62, macroOn: false, driftNet: null, mktCents: null,
    yesT: 55, noT: 30, resolved: 'U', finalDelta: 40, v: 2,
    ab: { noMom: 0.44, noDrift: 0.62, noSettle: 0.60, macroFlip: 0.62 } };
  c.state.rows = [flipRow];
  const rv = c.renderVals();
  const ab = rv.logRows ? rv.logRows[0].ab : rv.peek[0].ab;
  t('T9 side-flipping ablation gets a dot', ab.indexOf('●M') === 0, ab, '●M-18 …');
  t('T9 non-flipping ablation has no dot', ab.indexOf('●S') === -1, ab, 'no ●S');

  /* trade-decision flip: mkt sits between the full and ablated yes ceiling */
  const tradeRow = { ...flipRow, pFull: 0.62, yesT: 55, mktCents: 50,
    ab: { noMom: 0.52, noDrift: 0.62, noSettle: 0.62, macroFlip: 0.62 } };
  c.state.rows = [tradeRow];
  const ab2 = (c.renderVals().peek)[0].ab;
  const ceilAbl = c.ceilings(0.52).yesT;
  t('T9 trade-flip dot when mkt straddles ceilings',
    (50 <= ceilAbl) !== (50 <= 55) ? ab2.indexOf('●M') === 0 : true, ab2 + ' (abl ceil ' + ceilAbl + ')', 'dot iff straddle');

  /* aggregate: one save (full right, ablated wrong) + one cost (full wrong, ablated right) */
  const save = { ...flipRow, pFull: 0.62, resolved: 'U', ab: { noMom: 0.44, noDrift: 0.62, noSettle: 0.62, macroFlip: 0.62 } };
  const cost = { ...flipRow, pFull: 0.62, resolved: 'D', ab: { noMom: 0.44, noDrift: 0.62, noSettle: 0.62, macroFlip: 0.62 } };
  c.state.rows = [save, cost];
  const agg = c.renderVals().ablAgg.find((x) => x.letter === 'M');
  t('T10 aggregate splits saves and costs', agg.flips === '2 (1 saved · 1 cost)', agg.flips, '2 (1 saved · 1 cost)');
  /* moves p enough to enter the group, but stays on the same side of 0.5 */
  const c2 = mk();
  c2.state.rows = [{ ...flipRow, pFull: 0.62, ab: { noMom: 0.55, noDrift: 0.62, noSettle: 0.62, macroFlip: 0.62 } }];
  const agg2 = c2.renderVals().ablAgg.find((x) => x.letter === 'M');
  t('T10 zero flips keeps n/total form', agg2.flips === '0/1', agg2.flips, '0/1');
}

/* ---- Task 11: storage adapter ---- */
{
  const has = /const STORE = \{[\s\S]*?get:[\s\S]*?set:[\s\S]*?del:[\s\S]*?keys:/.test(src);
  t('T11 STORE exposes get/set/del/keys', has, has, true);
  t('T11 lsGet/lsSet aliases retained', /const lsGet = STORE\.get, lsSet = STORE\.set;/.test(src), true, true);
}

/* ---- Task 6: displayed constants ---- */
{
  const c = mk();
  const rv = c.renderVals();
  t('T6 bakedB reads 1.74 on the dial basis', /baked-data refit 1\.74 on the same σ basis/.test(rv.calibFooter), rv.calibFooter.slice(0, 80), '…1.74 on the same σ basis…');
  t('T6 footer says ruled while unfitted', /ruled · refits at n≥150 \(0\)/.test(rv.calibFooter), rv.calibFooter.slice(0, 40), 'B=1.77 ruled · refits…');
  t('T6 provenance states taker/maker M defaults', /M defaults to 1;/.test(rv.provenance) && /M defaults to 0\./.test(rv.provenance), true, true);
  t('T6 provenance drops the "top of its range" claim', !/top of its 0\.07 range/.test(rv.provenance), true, true);
  const bTile = rv.agg.find((x) => x.label === 'B');
  t('T6 B tile val comes from activeB', bTile.val === '1.77', bTile.val, '1.77');
  t('T6 B tile note says ruled when unfitted', bTile.note === 'ruled · refits at n≥150', bTile.note, 'ruled · refits at n≥150');

  /* and flips to fitted once a real log exists */
  const cf = mk();
  cf.state.rows = Array.from({ length: 300 }, (_, i) => {
    const z = ((i % 40) - 20) / 10;
    return { ts: Date.now(), sessionTs: 1, k: 5, strike: 64850, price: 64872, delta: 22,
      sigmaUnit: 27, z, resolved: (i * 2654435761 % 1000) / 1000 < 1 / (1 + Math.exp(-2 * z)) ? 'U' : 'D',
      v: 2, pFull: 0.6, macroOn: false, driftNet: null, mktCents: null, yesT: 55, noT: 30,
      finalDelta: 40, ab: { noMom: 0.6, noDrift: 0.6, noSettle: 0.6, macroFlip: 0.6 } };
  });
  const bTile2 = cf.renderVals().agg.find((x) => x.label === 'B');
  t('T6 B tile flips to fitted with a v2 log', bTile2.note === 'fitted from your log', bTile2.note, 'fitted from your log');
  t('T6 footer reports fitted n', /fitted from your log \(n=300\)/.test(cf.renderVals().calibFooter), cf.renderVals().calibFooter.slice(0, 46), 'B=… fitted from your log (n=300)');
}

/* ---- Final-verification item 2: suffix entry echo. Wall-clock pinned to 7
   minutes into a session so k>=1 and the read is live. ---- */
{
  const c = mk();
  /* 2026-08-06 10:07:30 America/Chicago (CDT, UTC-5) -> minute 7 of the :00 session */
  c.state.now = Date.parse('2026-08-06T15:07:30Z');
  t('V2 clock lands 7 min into the session', c.ct().mis === 7, c.ct().mis, 7);
  c.state.strike = '64850';
  c.state.priceIn = '872';
  const rv = c.renderVals();
  t('V2 echo resolves suffix to full price', rv.echo === 'resolves to $64,872', rv.echo, 'resolves to $64,872');
  t('V2 delta echo reads +$22', rv.deltaEcho === 'Δ +$22', rv.deltaEcho, 'Δ +$22');

  /* logging that read puts a row in the log and stamps it v2 */
  c.logRead();
  t('V2 read is logged', c.state.rows.length === 1, c.state.rows.length, 1);
  t('V2 logged row carries v:2 stamp', c.state.rows[0].v === 2, c.state.rows[0].v, 2);
  t('V2 logged row resolves the suffix', c.state.rows[0].price === 64872, c.state.rows[0].price, 64872);
  t('V2 session pts chain records the price', c.state.sess[c.ct().sessionTs].pts[0].p === 64872,
    c.state.sess[c.ct().sessionTs].pts[0].p, 64872);
  t('V2 row appears in RECENT READS', c.renderVals().peek.length === 1, c.renderVals().peek.length, 1);

  /* a second read 2 minutes later lights up sigma live and blends sigma unit */
  c.state.now = Date.parse('2026-08-06T15:09:30Z');
  c.state.priceIn = '905';
  c.logRead();
  const r2 = c.read();
  t('V3 sigma live defined after two reads', r2.cur != null, r2.cur, 'non-null');
  const lo = Math.min(r2.trail, r2.cur), hi = Math.max(r2.trail, r2.cur);
  t('V3 sigma unit sits between trail and live', r2.sigmaUnit >= lo && r2.sigmaUnit <= hi,
    r2.sigmaUnit.toFixed(3), lo.toFixed(3) + '..' + hi.toFixed(3));
}

/* ---- Final-verification items 6 + 7: resolve back-fill and CSV shape ---- */
{
  const c = mk();
  c.state.now = Date.parse('2026-08-06T15:07:30Z');
  c.state.strike = '64850';
  c.state.priceIn = '872';
  c.logRead();
  c.state.now = Date.parse('2026-08-06T15:09:30Z');
  c.state.priceIn = '905';
  c.logRead();
  const sessTs = c.ct().sessionTs;

  /* roll past the session so it becomes resolvable, then resolve it */
  c.state.now = Date.parse('2026-08-06T15:20:00Z');
  c.state.finalIn = '120';
  const pend = c.pendingSession();
  t('V6 closed session becomes pending', pend && pend.ts === sessTs, pend && pend.ts, sessTs);
  c.resolve('U');
  t('V6 resolve back-fills EVERY row of the session',
    c.state.rows.length === 2 && c.state.rows.every((r) => r.resolved === 'U'),
    c.state.rows.map((r) => r.resolved).join(','), 'U,U');
  t('V6 finalDelta back-filled', c.state.rows.every((r) => r.finalDelta === 120),
    c.state.rows.map((r) => r.finalDelta).join(','), '120,120');
  const rv = c.renderVals();
  t('V6 hit rate updates after resolve', /^(0|100)%$/.test(rv.agg.find((x) => x.label === 'HIT RATE').val),
    rv.agg.find((x) => x.label === 'HIT RATE').val, '0% or 100%');
  t('V6 brier populated after resolve', rv.agg.find((x) => x.label === 'BRIER').val !== '—',
    rv.agg.find((x) => x.label === 'BRIER').val, 'a number');

  const csv = c.csv().split('\n');
  const head = csv[0].split(',');
  t('V7 CSV header has 20 columns', head.length === 20, head.length, 20);
  t('V7 CSV data rows have 20 columns', csv.slice(1).every((l) => l.split(',').length === 20),
    csv[1].split(',').length, 20);
  const abIdx = [head.indexOf('ab_noMom'), head.indexOf('ab_noDrift'), head.indexOf('ab_noSettle'), head.indexOf('ab_macroFlip')];
  const cells = csv[1].split(',');
  t('V7 ablation columns populated', abIdx.every((i) => i > 0 && /^\d\.\d+$/.test(cells[i])),
    abIdx.map((i) => cells[i]).join(' '), 'four decimals');

  /* persistence survives a reload: rebuild from the same localStorage */
  const c2 = mk();
  c2.state.rows = lsGet_rows();
  t('V8 rows survive reload', c2.state.rows.length === 2, c2.state.rows.length, 2);
}
function lsGet_rows() { return JSON.parse(globalThis.localStorage.getItem('edge.log.v3') || '[]'); }

/* ---- Shadow mode: unattended live validation ----
   Feeds observations through shadowIngest() with a controlled clock, so a whole
   session can be replayed in milliseconds. The synthetic strike is the session's
   first observed price — the same convention the baked SESS deltas use, which is
   what makes the live scorecard comparable to the backtest. */
{
  const c = mk();
  const T0 = Date.parse('2026-08-06T15:00:10Z');   // 10:00:10 CT -> minute 0
  const at = (min, sec) => Date.parse('2026-08-06T15:00:00Z') + min * 60000 + sec * 1000;

  c.state.now = T0;
  c.shadowIngest(64000, 3.1);
  t('S1 first tick sets the synthetic strike', c.state.shadow.strike === 64000, c.state.shadow.strike, 64000);
  t('S1 minute 0 logs no row', c.state.srows.length === 0, c.state.srows.length, 0);

  c.state.now = at(3, 5);
  c.shadowIngest(64030, 4.2);
  t('S2 logs a row at minute 3', c.state.srows.length === 1, c.state.srows.length, 1);
  t('S2 row carries the auto tag', c.state.srows[0].auto === true, c.state.srows[0].auto, true);
  t('S2 row records volume', c.state.srows[0].vol === 4.2, c.state.srows[0].vol, 4.2);
  t('S2 delta is vs the synthetic strike', c.state.srows[0].delta === 30, c.state.srows[0].delta, 30);
  t('S2 probability is a real number', c.state.srows[0].pFull > 0.5 && c.state.srows[0].pFull < 1,
    c.state.srows[0].pFull, '0.5..1');

  /* same minute again must not double-log */
  c.shadowIngest(64031, 1.0);
  t('S3 same minute does not double-log', c.state.srows.length === 1, c.state.srows.length, 1);

  c.state.now = at(9, 2);
  c.shadowIngest(64055, 2.0);
  t('S4 second read logged', c.state.srows.length === 2, c.state.srows.length, 2);
  t('S4 sigma live engages after two points', c.state.srows[1].sigmaUnit !== c.state.srows[0].sigmaUnit,
    c.state.srows[1].sigmaUnit, '!= ' + c.state.srows[0].sigmaUnit);

  /* roll into the next session: previous one must self-resolve on the last price */
  c.state.now = at(15, 4);
  c.shadowIngest(64070, 5.0);
  const settled = c.state.srows.filter((r) => r.resolved != null);
  t('S5 roll back-fills every row of the closed session', settled.length === 2, settled.length, 2);
  t('S5 resolved UP (last price above strike)', settled.every((r) => r.resolved === 'U'),
    settled.map((r) => r.resolved).join(','), 'U,U');
  t('S5 finalDelta recorded', settled.every((r) => r.finalDelta === 70), settled[0].finalDelta, 70);
  t('S5 new session took a fresh strike', c.state.shadow.strike === 64070, c.state.shadow.strike, 64070);

  /* the whole point: shadow rows must never touch the traded log or the refit */
  t('S6 shadow rows stay out of the traded log', c.state.rows.length === 0, c.state.rows.length, 0);
  t('S6 shadow rows excluded from scored()', c.scored().length === 0, c.scored().length, 0);
  const cR = mk();
  cR.state.srows = Array.from({ length: 400 }, (_, i) => ({ z: ((i % 40) - 20) / 10, resolved: 'U', v: 2, auto: true }));
  t('S6 shadow rows cannot drive the B refit', cR.refitB() === null, cR.refitB(), null);

  /* live scorecard */
  const sc = c.shadowScore();
  t('S7 scorecard counts resolved shadow rows', sc.n === 2, sc.n, 2);
  t('S7 scorecard reports a hit rate', sc.hit != null && sc.hit >= 0 && sc.hit <= 1, sc.hit, '0..1');
  t('S7 scorecard reports a Brier score', sc.brier != null && sc.brier >= 0, sc.brier, '>=0');

  /* a DOWN session scores as a miss when the model called UP */
  const c2 = mk();
  c2.state.now = at(0, 10); c2.shadowIngest(64000, 1);
  c2.state.now = at(5, 10); c2.shadowIngest(64100, 1);      // model calls UP hard
  c2.state.now = at(16, 10); c2.shadowIngest(63900, 1);     // settles DOWN
  const s2 = c2.state.srows.filter((r) => r.resolved != null);
  t('S8 a wrong call is recorded as DOWN', s2.every((r) => r.resolved === 'D'), s2[0].resolved, 'D');
  t('S8 scorecard hit rate falls to 0', c2.shadowScore().hit === 0, c2.shadowScore().hit, 0);
}

/* ---- Shadow mode must not start mid-session ----
   The model's remaining-variance term assumes delta accumulated from the
   session OPEN. Adopting a mid-session price as the strike would silently
   score every row against the wrong reference, so a late start has to wait
   for the next boundary rather than produce plausible-looking garbage. */
{
  const at = (min, sec) => Date.parse('2026-08-06T15:00:00Z') + min * 60000 + sec * 1000;
  const c = mk();
  c.state.now = at(7, 12);              // switched on 7 minutes into a session
  c.shadowIngest(64500, 2.0);
  t('S9 late start adopts no strike', c.state.shadow.strike == null, c.state.shadow.strike, null);
  t('S9 late start logs no rows', c.state.srows.length === 0, c.state.srows.length, 0);
  c.state.now = at(11, 5);
  c.shadowIngest(64520, 2.0);
  t('S9 still waiting later in that session', c.state.srows.length === 0, c.state.srows.length, 0);

  c.state.now = at(15, 3);              // next session opens — now it may begin
  c.shadowIngest(64530, 2.0);
  t('S10 adopts strike at the new session open', c.state.shadow.strike === 64530, c.state.shadow.strike, 64530);
  c.state.now = at(19, 5);
  c.shadowIngest(64560, 2.0);
  t('S10 logs once running', c.state.srows.length === 1, c.state.srows.length, 1);
  t('S10 delta is vs the session-open strike', c.state.srows[0].delta === 30, c.state.srows[0].delta, 30);
  t('S10 an unstarted session leaves nothing to resolve',
    c.state.srows.every((r) => r.sessionTs === c.state.shadow.ts), true, true);
}

/* ---- Session grouping: one row per 15-minute session, expandable to its reads ---- */
{
  const c = mk();
  const TS1 = 1786045500, TS2 = 1786046400;          // two 15-min session starts
  const ab = { noMom: 0.5, noDrift: 0.5, noSettle: 0.5, macroFlip: 0.5 };
  const r = (ts, k, d, pf, res) => ({ ts: ts * 1000 + k * 60000, sessionTs: ts, k, strike: 64000,
    price: 64000 + d, delta: d, sigmaUnit: 22, z: d / 48, pFull: pf, ab, mktCents: null,
    resolved: res, finalDelta: res ? d : null, v: 2 });

  const rows = [
    r(TS1, 2, 12, 0.58, 'U'), r(TS1, 5, -9, 0.44, 'U'), r(TS1, 9, 31, 0.71, 'U'),
    r(TS2, 3, -20, 0.36, null), r(TS2, 7, -14, 0.41, null)
  ];
  const g = c.groupSessions(rows);
  t('G1 one group per session', g.length === 2, g.length, 2);
  t('G1 newest session first', g[0].ts === TS2, g[0].ts, TS2);
  t('G1 reads counted per session', g[1].n === 3, g[1].n, 3);
  t('G1 reads sorted by minute', g[1].reads.map((x) => x.k).join(',') === '2,5,9',
    g[1].reads.map((x) => x.k).join(','), '2,5,9');
  t('G1 session label spans the window', /–/.test(g[0].label), g[0].label, 'has a dash');
  t('G2 resolved session carries its verdict', g[1].resolved === 'U', g[1].resolved, 'U');
  t('G2 unresolved session has none', g[0].resolved == null, g[0].resolved, null);
  t('G2 final delta lifted to the session', g[1].finalDelta === 12, g[1].finalDelta, 12);
  /* two of the three called UP and settled UP; the 0.44 read called DOWN and missed */
  t('G3 hits counted across the session', g[1].hits === 2, g[1].hits, 2);
  t('G3 scored count is the session size', g[1].scored === 3, g[1].scored, 3);
  t('G3 unresolved session scores nothing', g[0].scored === 0, g[0].scored, 0);
  t('G4 last call reflects the final read', /UP 71/.test(g[1].lastCall), g[1].lastCall, 'UP 71%');

  /* expansion state is per-list, so opening a shadow session cannot open a traded one */
  const c2 = mk();
  t('G5 sessions start collapsed', c2.isOpen('real', TS1) === false, c2.isOpen('real', TS1), false);
  c2.toggleSession('real', TS1);
  t('G5 toggle opens it', c2.isOpen('real', TS1) === true, c2.isOpen('real', TS1), true);
  t('G5 same key in the other list stays shut', c2.isOpen('shadow', TS1) === false,
    c2.isOpen('shadow', TS1), false);
  c2.toggleSession('real', TS1);
  t('G5 toggle closes it again', c2.isOpen('real', TS1) === false, c2.isOpen('real', TS1), false);

  /* the two logs never mix */
  const c3 = mk();
  c3.state.rows = [r(TS1, 2, 12, 0.58, 'U')];
  c3.state.srows = [r(TS2, 3, -20, 0.36, null), r(TS2, 7, -14, 0.41, null)];
  t('G6 real list holds only traded sessions', c3.groupSessions(c3.state.rows).length === 1,
    c3.groupSessions(c3.state.rows).length, 1);
  t('G6 shadow list holds only shadow sessions',
    c3.groupSessions(c3.state.srows)[0].n === 2, c3.groupSessions(c3.state.srows)[0].n, 2);
}

/* ---- Stale feed must not become a fake observation ----
   The candles endpoint serves cached data for 90s+ at a time. Logging the same
   price as if it were fresh reads makes the session look motionless, collapses
   sigma_cur to its floor, and inflates z until the dial reports certainty it has
   not earned. A read is only real if the feed's own clock advanced. */
{
  const at = (min, sec) => Date.parse('2026-08-06T15:00:00Z') + min * 60000 + sec * 1000;
  const c = mk();
  c.state.now = at(0, 8);
  c.shadowIngest(64000, 2.0, 1000);
  c.state.now = at(3, 4);
  c.shadowIngest(64030, 2.0, 1180);
  t('S11 a fresh observation logs', c.state.srows.length === 1, c.state.srows.length, 1);

  c.state.now = at(4, 4);
  c.shadowIngest(64030, 2.0, 1180);              // same feed timestamp — cached
  t('S11 stale feed logs nothing', c.state.srows.length === 1, c.state.srows.length, 1);
  t('S11 stale feed is surfaced, not hidden', /stale|cached/i.test(String(c.state.sErr || '')),
    c.state.sErr, 'a stale notice');

  c.state.now = at(5, 4);
  c.shadowIngest(64055, 2.0, 1240);              // clock advanced — real again
  t('S11 recovers when the feed moves', c.state.srows.length === 2, c.state.srows.length, 2);
  t('S11 stale notice clears', !c.state.sErr, c.state.sErr, null);

  /* the duplicate must not reach sigma_cur either — a fake zero-move read is
     what drove sigma to its floor and z to 4.98 on a $31 delta */
  const pts = c.state.shadow.pts.map((p) => p.p);
  t('S11 no duplicate point in the sigma chain',
    new Set(pts).size === pts.length, pts.join(','), 'all distinct');
}

/* ---- The sigma chain must be sampled once per minute ----
   The feed is polled ~3x a minute. Appending every poll to the chain means the
   only pairs the estimator counts are the ones that straddle a minute boundary —
   a gap of seconds — while it divides by sqrt(1) as though a full minute had
   passed. That understates sigma by roughly sqrt(3) or worse, which inflates z
   and pushes the dial toward false confidence. One point per minute. */
{
  const at = (min, sec) => Date.parse('2026-08-06T15:00:00Z') + min * 60000 + sec * 1000;
  const c = mk();
  let src = 0;
  const poll = (min, sec, px) => { c.state.now = at(min, sec); c.shadowIngest(px, 1, ++src); };

  poll(0, 5, 64000);                                  // session opens
  poll(0, 25, 64004); poll(0, 45, 64009);             // more polls, same minute
  poll(1, 5, 64020); poll(1, 25, 64026); poll(1, 45, 64031);
  poll(2, 5, 64040); poll(2, 25, 64046); poll(2, 45, 64052);
  poll(3, 5, 64060);

  const ks = c.state.shadow.pts.map((p) => p.k);
  t('S12 one sigma point per minute', ks.length === new Set(ks).size, ks.join(','), 'no repeats');
  t('S12 points are one minute apart',
    ks.every((k, i) => i === 0 || k - ks[i - 1] === 1), ks.join(','), '0,1,2,3');

  /* a ~$20/min path must not read as a ~$12/min path */
  const cur = c.sigmaFromPts(c.state.shadow.pts);
  t('S12 sigma reflects the per-minute move, not the poll gap',
    cur > 15, cur == null ? null : cur.toFixed(1), '> 15 for a ~$20/min path');

  /* and the read logged at each minute still lands exactly once */
  t('S12 one read per minute despite 3 polls', c.state.srows.length === 3,
    c.state.srows.length, 3);
}

/* ---- The dial must never display certainty ----
   The sigmoid is asymptotic: it returns 0.9951, never 1. Rounding that to "100%"
   claims something the model cannot support, in a tool whose whole premise is
   calibrated probability. Clamp the DISPLAY only — pFull keeps full precision so
   Brier and calibration are unaffected. */
{
  const c = mk();
  t('S13 near-certain reads display as 99, not 100', c.callLabel(0.9951) === 'UP 99%',
    c.callLabel(0.9951), 'UP 99%');
  t('S13 the mirror case floors at 1', c.callLabel(0.0002) === 'DOWN 99%',
    c.callLabel(0.0002), 'DOWN 99%');
  t('S13 ordinary values are untouched', c.callLabel(0.71) === 'UP 71%', c.callLabel(0.71), 'UP 71%');
  t('S13 a coin flip still reads 50', c.callLabel(0.5) === 'UP 50%', c.callLabel(0.5), 'UP 50%');
  t('S13 rounding to 99 is left alone', c.callLabel(0.988) === 'UP 99%', c.callLabel(0.988), 'UP 99%');
  /* the clamp is cosmetic — scoring must still see the real number */
  const c2 = mk();
  c2.state.srows = [{ sessionTs: 1, k: 1, pFull: 0.9951, resolved: 'D', v: 2, auto: true }];
  const b = c2.shadowScore().brier;
  t('S13 Brier uses full precision, not the clamp',
    Math.abs(b - 0.9951 ** 2) < 1e-9, b, (0.9951 ** 2).toFixed(6));
}

/* ---- report ---- */
const w = Math.max(...rows.map((r) => r.name.length));
console.log('TEST'.padEnd(w) + '  RESULT  GOT / WANT');
console.log('-'.repeat(w + 30));
for (const r of rows) {
  console.log(r.name.padEnd(w) + '  ' + (r.pass ? 'PASS  ' : 'FAIL  ') + '  ' +
    (r.pass ? '' : String(r.got) + '  ≠  ' + String(r.want)));
}
console.log('-'.repeat(w + 30));
console.log(`${rows.length} rows · ${rows.length - fails} PASS · ${fails} FAIL`);
rmSync(tmp, { force: true });
process.exit(fails);
