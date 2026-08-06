/* Headless runner for the in-artifact self-test harness.
 *
 *   node tools/selftest.mjs
 *
 * Serves the bundle over http (the loader mints blob URLs and dynamic-imports
 * the dataset module, which file:// blocks), loads it with ?selftest=1, and
 * prints the console.table the harness emits. Exit code is the number of
 * failing rows, so this doubles as a check in a pipeline.
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
await browser.close();
server.close();

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

if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
process.exit(bad + layBad);
