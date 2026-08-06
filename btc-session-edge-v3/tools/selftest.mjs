/* Headless runner for the in-artifact self-test harness.
 *
 *   node tools/selftest.mjs
 *
 * Serves the bundle over http and loads it with ?selftest=1, then prints the
 * console.table the harness emits. Exit code is the number of failing rows, so
 * this doubles as a check in a pipeline.
 *
 * http is used only for a clean, cache-free origin per run — the artifact does
 * NOT need a server. Opening index.html straight off disk works: the loader
 * inlines every resource as a blob URL first, so the dataset's dynamic import
 * resolves under file:// too. Verified — file:///…/index.html?selftest=1 gives
 * the same 14/14.
 *
 * console.table is intercepted in an init script rather than parsed out of the
 * console event, because Playwright serialises table args lossily.
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
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

/* The image ships a pinned Chromium that may not match the playwright package's
   expected build number; point at it directly rather than re-downloading. */
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* Capture the harness output plus anything that would otherwise die silently. */
await page.addInitScript(() => {
  window.__rows = null;
  const orig = console.table.bind(console);
  console.table = (rows) => { window.__rows = rows; orig(rows); };
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('unhandled: ' + String(e.reason)));
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

await page.goto(`http://127.0.0.1:${port}/index.html?selftest=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__rows !== null, { timeout: 30000 })
  .catch(() => {});

const rows = await page.evaluate(() => window.__rows);
const errs = [...pageErrors, ...(await page.evaluate(() => window.__errs || []))];

/* Final-verification item 10: the TRADE tab must not scroll at 1440x900. The
   layout is accepted as built and this run is what proves it stayed that way. */
const layout = await page.evaluate(() => {
  const d = document.documentElement;
  return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight,
    maker: (document.body.innerText.match(/maker \([^)]*\)/) || [''])[0] };
});
await page.screenshot({ path: new URL('../trade-tab-1440x900.png', import.meta.url).pathname });
await page.close();

if (!rows) {
  console.error('SELF-TEST DID NOT RUN — no console.table captured.');
  if (errs.length) console.error('page errors:\n  ' + errs.join('\n  '));
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(6)) : String(v));
const w = Math.max(...rows.map((r) => r.test.length), 4);
console.log(pad('TEST', w) + '  RESULT  ' + pad('GOT', 14) + 'WANT');
console.log('-'.repeat(w + 8 + 14 + 8));
for (const r of rows) console.log(pad(r.test, w) + '  ' + pad(r.result, 8) + pad(fmt(r.got), 14) + fmt(r.want));
const bad = rows.filter((r) => r.result === 'FAIL').length;
console.log('-'.repeat(w + 8 + 14 + 8));
console.log(`${rows.length} rows · ${rows.length - bad} PASS · ${bad} FAIL`);

const lay = [
  ['no horizontal scroll @1440', layout.sw <= layout.cw, layout.sw + ' <= ' + layout.cw],
  ['no vertical scroll @900', layout.sh <= layout.ch, layout.sh + ' <= ' + layout.ch],
  ['maker label rendered', layout.maker === 'maker (free, M=0)', layout.maker]
];
console.log('\nLAYOUT / TRADE TAB @ 1440x900');
for (const [n, ok, got] of lay) console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + n.padEnd(30) + got);
const layBad = lay.filter(([, ok]) => !ok).length;

/* Shadow rows must be VISIBLE in the log table. The strip counting reads that
   the table refuses to show reads as a broken tool, and that is exactly how it
   shipped the first time — so assert the render path, not just the state. */
const shadowPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const ab = { noMom: 0.52, noDrift: 0.55, noSettle: 0.56, macroFlip: 0.54 };
const seed = [2, 3, 4].map((k, i) => ({
  ts: Date.now() - (20 - k) * 60000, sessionTs: 1786045000000, k, strike: 64374,
  price: 64374 + k, delta: [12, -9, 31][i], sigmaUnit: 22.3, z: [0.25, -0.19, 0.65][i],
  pFull: [0.58, 0.44, 0.71][i], ab, macroOn: false, driftNet: null, mktCents: null,
  yesT: 57, noT: 38, resolved: ['U', 'U', null][i], finalDelta: [12, -9, null][i],
  vol: 4.2, auto: true, v: 2 }));
await shadowPage.addInitScript((rows) => {
  localStorage.setItem('edge.shadow.v3', JSON.stringify({
    shadow: { ts: 1786045000000, strike: 64374, pts: [{ k: 1, p: 64374 }], lastK: 5 }, srows: rows }));
}, seed);
await shadowPage.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await shadowPage.waitForTimeout(2200);
await shadowPage.getByText('LOG', { exact: true }).first().click();
await shadowPage.waitForTimeout(600);
const sv = await shadowPage.evaluate(() => ({
  txt: document.body.innerText, sw: document.documentElement.scrollWidth }));
const shad = [
  ['shadow rows render in table', (sv.txt.match(/◇/g) || []).length === 3, (sv.txt.match(/◇/g) || []).length],
  ['table not reported empty', !/Nothing logged yet/.test(sv.txt), String(/Nothing logged yet/.test(sv.txt))],
  ['strip counts the same reads', /3 reads/.test(sv.txt), (sv.txt.match(/\d+ reads/) || ['—'])[0]],
  ['resolved shadow row scored', /CORRECT|MISSED/.test(sv.txt), String(/CORRECT|MISSED/.test(sv.txt))],
  ['no horizontal scroll with shadow rows', sv.sw <= 1440, sv.sw]
];
console.log('\nSHADOW ROWS / LOG TAB @ 1440x900');
for (const [n, ok, got] of shad) console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + n.padEnd(38) + got);
const shadBad = shad.filter(([, ok]) => !ok).length;
await shadowPage.close();
await browser.close();
server.close();

if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
process.exit(bad + layBad + shadBad);
