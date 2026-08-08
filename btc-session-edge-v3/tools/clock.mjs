/* Browser check for defects 9 and 10 — the model's notion of remaining time.
 *
 *   node tools/clock.mjs        (run from btc-session-edge-v3/, needs playwright)
 *
 * These two defects are page-level by nature: the fix is only real if the
 * number on screen moves as the seconds run out, and the Node harness cannot
 * see that. It builds the component with props={} and applies setState
 * synchronously; the browser does neither, and two shipped defects (5 and the
 * persistShadow cursor bug) were invisible to a fully passing Node suite for
 * exactly that reason. So this drives the real page with a controlled clock.
 *
 * Date.now is replaced before any app code runs, reading a value this script
 * owns. The component's own 1-second interval then advances state.now off it,
 * so the page ticks exactly as it would live, at whatever second we choose.
 *
 * Exit code is the number of failures.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

/* A 15-minute boundary, so minute-of-session is minute-of-hour mod 15. */
const T0 = 1785905100;
const at = (min, sec) => (T0 + min * 60 + sec) * 1000;

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript((t) => {
  window.__now = t;
  const RealDate = Date;
  /* Only now() is redirected. The constructor still has to work, because ct()
     formats window times through Intl on `new Date(state.now)`. */
  Date.now = () => window.__now;
  window.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [window.__now])); }
    static now() { return window.__now; }
  };
}, at(13, 5));

await page.goto('http://127.0.0.1:' + port + '/index.html');
await page.waitForFunction(() => document.querySelector('input') != null, null, { timeout: 15000 });

const setClock = async (ms) => {
  await page.evaluate((v) => { window.__now = v; }, ms);
  /* The component's own 1s interval picks the new value up; give it two. */
  await page.waitForTimeout(2200);
};
/* Matched on computed font-size rather than the style attribute: the runtime
   sets styles in a form a [style*=] selector does not see. The 76px span is the
   headline probability. The tree carries a duplicate of it; take the first. */
const readPct = () => page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => parseFloat(getComputedStyle(s).fontSize) === 76);
  return el ? el.textContent.trim() : null;
});
/* σ_rem is the term defect 9 actually changes; assert on it directly as well,
   since the headline is rounded to a whole percent and can hide a real move. */
const readSigmaRem = () => page.evaluate(() => {
  const m = document.body.innerText.match(/σ REM\s*\n\s*\$([\d.]+)/);
  return m ? +m[1] : null;
});
const readAll = () => page.evaluate(() => document.body.innerText);

let fails = 0;
const rows = [];
const t = (name, pass, got, want) => { if (!pass) fails++; rows.push({ name, pass, got, want }); };

/* Strike is Kalshi's target, price is spot — a $10 gap, the same case the
   S39 error table was measured on. */
const inputs = await page.$$('input');
await inputs[0].fill('64500');
await inputs[1].fill('64490');
await page.waitForTimeout(600);

/* ---- defect 9: the number must move as the seconds run out ---- */
await setClock(at(13, 5));
const p13a = await readPct(), s13a = await readSigmaRem();
await setClock(at(13, 55));
const p13b = await readPct(), s13b = await readSigmaRem();
t('D9 minute 13 moves within the minute', p13a !== p13b, p13a + ' -> ' + p13b, 'different');
t('D9 minute 13 sigma_rem shrinks within the minute', s13b < s13a, '$' + s13a + ' -> $' + s13b, 'shrinks');

await setClock(at(2, 5));
const p2a = await readPct(), s2a = await readSigmaRem();
await setClock(at(2, 55));
const p2b = await readPct(), s2b = await readSigmaRem();
t('D9 minute 2 headline is stable within the minute', p2a === p2b, p2a + ' -> ' + p2b, 'same');
/* Stable on screen but still ticking underneath — that is the whole point:
   the error is a cliff at the end, not a pervasive fog. */
t('D9 minute 2 sigma_rem still ticks down', s2b < s2a, '$' + s2a + ' -> $' + s2b, 'shrinks');

/* The direction is the whole point: less time left means further from 50%,
   so the shown side's confidence must RISE as the minute drains. */
const n = (s) => +String(s).replace('%', '');
t('D9 confidence rises as time drains', n(p13b) > n(p13a), p13a + ' -> ' + p13b, 'rises');

/* ---- defect 10: minute 0 must price at all ---- */
await setClock(at(0, 20));
const p0 = await readPct();
const body0 = await readAll();
t('D10 minute 0 shows a probability', /^\d+%$/.test(p0), p0, 'n%');
t('D10 minute 0 no longer says "session just opened"',
  !/session just opened/i.test(body0), /session just opened/i.test(body0) ? 'still shown' : 'gone', 'gone');

/* Minute 0 is the widest the session ever is, so it must be the LEAST
   confident read of the session — a sanity check that k=0 is not silently
   falling through to the z=0 fallback, which would show 50%. */
await setClock(at(7, 0));
const p7 = await readPct();
t('D10 minute 0 is less confident than minute 7', n(p0) < n(p7), p0 + ' vs ' + p7, 'p0 < p7');
t('D10 minute 0 is not the 50% fallback', n(p0) !== 50, p0, '≠ 50%');

const w = Math.max(...rows.map((r) => r.name.length));
console.log('\nBROWSER / CONTROLLED CLOCK @ 1440x900');
for (const r of rows) console.log('  ' + (r.pass ? 'PASS  ' : 'FAIL  ') + r.name.padEnd(w) + '  ' + r.got + (r.pass ? '' : '   want ' + r.want));
console.log('  ' + rows.length + ' rows · ' + (rows.length - fails) + ' PASS · ' + fails + ' FAIL');

await browser.close();
server.close();
process.exit(fails);
