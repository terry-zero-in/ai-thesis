/* Pull 1-minute candles from Coinbase Exchange for one or more products.
 *
 *   node btc-session-edge-v3/analysis/fetch-coinbase-minutes.mjs NEAR-USD BTC-USD --days=30
 *
 * Writes <product>-1m.json into analysis/data/ as
 *   { product, granularity, from, to, n, rows: [[tsSec, low, high, open, close, volume], ...] }
 * sorted ascending by time, de-duplicated, with gaps left as gaps rather than
 * interpolated — a missing minute on a thin market is information, not noise,
 * and filling it would manufacture the very smoothness we are trying to measure.
 *
 * WHY COINBASE. Binance returns 451 from this host (geo-restricted). Coinbase
 * Exchange's public candles endpoint is open, sends
 * access-control-allow-origin:*, and is the same venue family the BTC tool
 * already uses for its live price feed, so the two datasets are comparable.
 *
 * LIMITS. 300 candles per request, so a 1-minute granularity request covers 5
 * hours. 30 days needs ~144 requests per product. Public rate limit is ~10 r/s;
 * this paces at ~4 r/s with retry-on-429 backoff, which finishes 2 products in
 * a couple of minutes and does not risk a ban.
 *
 * CAVEAT, load-bearing for anything built on this: Kalshi does NOT settle on
 * Coinbase. The BTC market settles on CF Benchmarks' Real Time Index, averaged
 * over 60 prices in the final minute. Whatever NEAR settles on, it is an index
 * too, not a single venue. Coinbase is a faithful PROXY for measuring
 * volatility, tick size and trend persistence; it is NOT the settlement price
 * and must never be treated as one.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'data');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const products = args.filter((a) => !a.startsWith('--'));
const daysArg = args.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? Number(daysArg.slice(7)) : 30;
if (!products.length) throw new Error('give at least one product, e.g. NEAR-USD');

const API = 'https://api.exchange.coinbase.com';
const SPAN = 300 * 60;                        /* 300 candles x 60s = 5 hours   */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(product, start, end, attempt = 0) {
  const url = `${API}/products/${product}/candles?granularity=60` +
    `&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'session-edge-research/1.0' } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`${product} ${res.status} after ${attempt} retries`);
    await sleep(500 * Math.pow(2, attempt));
    return grab(product, start, end, attempt + 1);
  }
  if (!res.ok) throw new Error(`${product} ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const nowSec = Math.floor(Date.now() / 1000 / 60) * 60;
const fromSec = nowSec - DAYS * 86400;

for (const product of products) {
  const seen = new Map();
  let windows = 0, empty = 0;
  for (let s = fromSec; s < nowSec; s += SPAN) {
    const rows = await grab(product, s, Math.min(s + SPAN, nowSec));
    windows++;
    if (!rows.length) empty++;
    for (const r of rows) seen.set(r[0], r);
    if (windows % 24 === 0) process.stdout.write(`  ${product}: ${windows} windows, ${seen.size} minutes\n`);
    await sleep(250);                          /* ~4 req/s                     */
  }
  const rows = [...seen.values()].sort((a, b) => a[0] - b[0]);
  const path = join(OUT, `${product}-1m.json`);
  writeFileSync(path, JSON.stringify({
    product, granularity: 60, from: fromSec, to: nowSec, n: rows.length,
    fetchedAt: nowSec, source: 'api.exchange.coinbase.com', rows,
  }));
  const expected = Math.floor((nowSec - fromSec) / 60);
  console.log(`${product}: ${rows.length.toLocaleString()} of ${expected.toLocaleString()} expected minutes ` +
    `(${(100 * rows.length / expected).toFixed(1)}%), ${empty} empty windows -> ${path}`);
}
