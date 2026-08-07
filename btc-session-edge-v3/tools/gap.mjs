/* Browser check for the GAP tab — the claimed-vs-realised track record.
 *
 *   node tools/gap.mjs        (run from btc-session-edge-v3/, needs playwright)
 *
 * The gap arithmetic is asserted in behaviour.mjs; what that harness cannot see
 * is whether the numbers reach the screen, because it never renders. This seeds
 * localStorage with resolved reads carrying a market price, loads the real page,
 * clicks through to GAP, and reads the tiles and rows back out of the DOM.
 *
 * The fixture is chosen so every displayed figure is checkable by hand:
 *
 *   A  mkt 40c  yesT 55  noT 40  settled UP    -> YES @40, ceil 55, edge +15, fee 2, +58
 *   B  mkt 40c  yesT 55  noT 40  settled DOWN  -> YES @40, ceil 55, edge +15, fee 2, -42
 *   C  mkt 80c  yesT 60  noT 45  settled DOWN  -> NO  @20, ceil 45, edge +25, fee 2, +78
 *
 *   n=3 · hits 2 of 3 = 67% · claimed (15+15+25)/3 = 18.3c · realised 94/3 = +31.3c
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

const TS = 1785905100;
const ROWS = [
  { ts: 1, sessionTs: TS - 1800, k: 5, pFull: 0.62, strike: 64500, delta: 20, z: 0.4, sigmaUnit: 21,
    mktCents: 40, yesT: 55, noT: 40, resolved: 'U', finalDelta: 30, v: 2 },
  { ts: 2, sessionTs: TS - 900, k: 6, pFull: 0.62, strike: 64500, delta: 20, z: 0.4, sigmaUnit: 21,
    mktCents: 40, yesT: 55, noT: 40, resolved: 'D', finalDelta: -30, v: 2 },
  { ts: 3, sessionTs: TS, k: 7, pFull: 0.30, strike: 64500, delta: -20, z: -0.4, sigmaUnit: 21,
    mktCents: 80, yesT: 60, noT: 45, resolved: 'D', finalDelta: -30, v: 2 }
];

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((rows) => {
  localStorage.setItem('edge.log.v3', JSON.stringify(rows));
}, ROWS);
await page.goto('http://127.0.0.1:' + port + '/index.html');
await page.waitForFunction(() => document.querySelector('input') != null, null, { timeout: 15000 });

let fails = 0;
const out = [];
const t = (name, pass, got, want) => { if (!pass) fails++; out.push({ name, pass, got, want }); };
const text = () => page.evaluate(() => document.body.innerText);

/* ---- TRADE tab: the edge must be a number, not a buried verdict string ---- */
const inputs = await page.$$('input');
await inputs[0].fill('64500');   /* strike */
await inputs[1].fill('64520');   /* price  */
await page.waitForTimeout(700);
const beforeMkt = await text();
t('GAP trade tab asks for a market price', /EDGE vs KALSHI/.test(beforeMkt) && /Type Kalshi's YES price/.test(beforeMkt),
  /EDGE vs KALSHI/.test(beforeMkt) ? 'prompt shown' : 'no edge bar', 'prompt shown');

/* mkt ¢ is the 4th input on the trade tab: strike, price, px75, mkt. */
await inputs[3].fill('40');
await page.waitForTimeout(700);
const withMkt = await text();
t('GAP trade tab states the edge in cents', /EDGE vs KALSHI\s*\n\s*[+−]\d+¢/.test(withMkt),
  (withMkt.match(/EDGE vs KALSHI\s*\n\s*([+−]\d+¢)/) || [])[1] || 'none', 'n¢');
t('GAP trade tab names the side to buy', /BUY (YES|NO) ≤ \d+¢/.test(withMkt),
  (withMkt.match(/BUY (?:YES|NO) ≤ \d+¢/) || [])[0] || 'none', 'BUY <side> ≤ n¢');

/* ---- GAP tab ---- */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'GAP');
  if (b) b.click();
});
await page.waitForTimeout(900);
const g = await text();

t('GAP tab renders', /SIGNALS/.test(g) && /CLAIMED EDGE/.test(g), /SIGNALS/.test(g) ? 'rendered' : 'missing', 'rendered');
const tile = (label) => { const m = g.match(new RegExp(label + '\\s*\\n\\s*([^\\n]+)')); return m ? m[1].trim() : null; };
t('GAP counts 3 signals', tile('SIGNALS') === '3', tile('SIGNALS'), '3');
t('GAP hit rate is 2 of 3', tile('HIT RATE') === '67%', tile('HIT RATE'), '67%');
t('GAP claimed edge is 18.3¢', tile('CLAIMED EDGE') === '18.3¢', tile('CLAIMED EDGE'), '18.3¢');
t('GAP realised is +31.3¢', tile('REALISED') === '+31.3¢', tile('REALISED'), '+31.3¢');
t('GAP total is +94¢ over 3 contracts', /\+94¢ over 3 contracts/.test(g),
  (g.match(/[+−]\d+¢ over \d+ contracts/) || [])[0] || 'none', '+94¢ over 3 contracts');

/* The losing signal must be on screen. A track record that hides its losses is
   exactly the failure this log exists to prevent. */
t('GAP shows the losing signal', /LOST/.test(g), /LOST/.test(g) ? 'shown' : 'hidden', 'shown');
t('GAP shows the winning signals', (g.match(/WON/g) || []).length === 2, (g.match(/WON/g) || []).length, 2);
t('GAP shows the loss in cents', /−42¢/.test(g), /−42¢/.test(g) ? 'shown' : 'missing', '−42¢');
t('GAP flips side to NO when NO is the better buy', /\bNO\b/.test(g) && /\+25¢/.test(g),
  /\+25¢/.test(g) ? 'NO @ +25¢' : 'missing', 'NO @ +25¢');

/* Claimed vs realised is the headline judgement, so it must be stated in words
   and not left for the operator to work out from two tiles. */
t('GAP states claimed vs realised in prose', /claimed 18\.3¢ of edge per signal and booked \+?31\.3¢/.test(g),
  (g.match(/claimed [\d.]+¢ of edge per signal and booked [+−]?[\d.]+¢/) || [])[0] || 'none', 'claimed X booked Y');

t('GAP says why shadow never appears here', /Kalshi's API is closed to browsers/.test(g),
  /closed to browsers/.test(g) ? 'stated' : 'missing', 'stated');

/* No layout regression from the new tab. */
const w = await page.evaluate(() => document.documentElement.scrollWidth);
t('GAP no horizontal scroll @1440', w <= 1440, w, '<= 1440');

/* Visual reference, same convention as the other tab screenshots in the repo. */
await page.screenshot({ path: join(ROOT, 'gap-tab-1440x900.png') });

const wd = Math.max(...out.map((r) => r.name.length));
console.log('\nBROWSER / GAP TAB @ 1440x900');
for (const r of out) console.log('  ' + (r.pass ? 'PASS  ' : 'FAIL  ') + r.name.padEnd(wd) + '  ' + r.got + (r.pass ? '' : '   want ' + r.want));
console.log('  ' + out.length + ' rows · ' + (out.length - fails) + ' PASS · ' + fails + ' FAIL');

await browser.close();
server.close();
process.exit(fails);
