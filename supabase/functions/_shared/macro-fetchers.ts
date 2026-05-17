// THS-49 — Network fetchers for the three macro gauges. Kept thin so the
// pure parsers in macro.ts remain unit-testable against fixtures.
//
// Both fetchers require browser-style headers — the upstream services 4xx
// requests with bare User-Agent strings.

import { parseFearGreed, parseNaaimTable, type FearGreedRow, type NaaimRow } from "./macro.ts";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NAAIM_PAGE = "https://www.naaim.org/programs/naaim-exposure-index/";
const CNN_FNG = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the NAAIM Exposure Index page and parse its inline data table.
 * Returns all rows the page exposes (typically 10 most recent weeks plus
 * historical — content driven). Throws on transport error or non-2xx.
 */
export async function fetchNaaim(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<NaaimRow[]> {
  const res = await fetchWithTimeout(
    NAAIM_PAGE,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`NAAIM page returned HTTP ${res.status}`);
  const html = await res.text();
  return parseNaaimTable(html);
}

/**
 * Fetch CNN's Fear & Greed graphdata JSON. CNN's dataviz host enforces
 * Origin/Referer/User-Agent checks (without them returns HTTP 418).
 */
export async function fetchFearGreed(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FearGreedRow[]> {
  const res = await fetchWithTimeout(
    CNN_FNG,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        Origin: "https://www.cnn.com",
        Referer: "https://www.cnn.com/",
        Accept: "application/json, text/plain, */*",
      },
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`CNN F&G endpoint returned HTTP ${res.status}`);
  const json = await res.json();
  return parseFearGreed(json);
}
