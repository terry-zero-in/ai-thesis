// THS-47 — SEC EDGAR client for fetching the most recent 10-K / 10-Q.
//
// EDGAR is public — no API key needed. SEC requires a User-Agent header
// identifying the requester (https://www.sec.gov/os/accessing-edgar-data).
// Set `SEC_USER_AGENT` env to something like "AI Thesis terry@example.com"
// before running; the function defaults to a generic UA if unset (will
// occasionally rate-limit but works in dev).
//
// The flow:
//   1. ticker → CIK via the company tickers file
//   2. CIK → submissions index (recent filings, type + accession number)
//   3. find latest 10-K (or 10-Q fallback) → fetch primary document
//   4. return URL + content
//
// Content is HTML — caller is expected to truncate to a reasonable excerpt
// before prompting an LLM.

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";

function getUserAgent(): string {
  // Deno + Node both expose env via different APIs; try both defensively.
  // We don't require it (SEC will warn but still serve) — but customize
  // for production use to avoid rate limits.
  const dyn = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  if (dyn?.env?.get) return dyn.env.get("SEC_USER_AGENT") ?? "AI Thesis v2 research@example.com";
  return process.env.SEC_USER_AGENT ?? "AI Thesis v2 research@example.com";
}

interface CompanyTickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SubmissionFiling {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
  form: string;
}

export interface SecFiling {
  ticker: string;
  cik: string;
  form: string;          // "10-K", "10-Q"
  filing_date: string;   // ISO YYYY-MM-DD
  url: string;
  content: string;       // raw response body (likely HTML); caller truncates
}

let tickersCache: Map<string, number> | null = null;

async function loadTickersIndex(): Promise<Map<string, number>> {
  if (tickersCache) return tickersCache;
  const resp = await fetch(SEC_TICKERS_URL, { headers: { "User-Agent": getUserAgent() } });
  if (!resp.ok) throw new Error(`SEC tickers fetch failed: ${resp.status}`);
  const data = (await resp.json()) as Record<string, CompanyTickerRow>;
  const map = new Map<string, number>();
  for (const k of Object.keys(data)) {
    const r = data[k];
    if (r && typeof r.ticker === "string") map.set(r.ticker.toUpperCase(), r.cik_str);
  }
  tickersCache = map;
  return map;
}

export function clearSecTickersCache(): void {
  tickersCache = null;
}

function cikPadded(cik: number): string {
  return String(cik).padStart(10, "0");
}

/** Fetch the most recent 10-K (or 10-Q if no 10-K) for a ticker. */
export async function fetchLatestFiling(ticker: string): Promise<SecFiling | null> {
  const tickers = await loadTickersIndex();
  const cikNum = tickers.get(ticker.toUpperCase());
  if (cikNum == null) {
    throw new Error(`ticker ${ticker} not in SEC EDGAR index`);
  }
  const cik = cikPadded(cikNum);

  const subResp = await fetch(`${SEC_SUBMISSIONS_BASE}/CIK${cik}.json`, {
    headers: { "User-Agent": getUserAgent() },
  });
  if (!subResp.ok) throw new Error(`SEC submissions fetch failed for ${ticker}: ${subResp.status}`);
  const subData = (await subResp.json()) as {
    filings: { recent: { accessionNumber: string[]; filingDate: string[]; primaryDocument: string[]; form: string[] } };
  };
  const recent = subData.filings?.recent;
  if (!recent) return null;

  const filings: SubmissionFiling[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    filings.push({
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      accessionNumber: recent.accessionNumber[i],
      primaryDocument: recent.primaryDocument[i],
    });
  }

  // Prefer 10-K (annual), fall back to 10-Q (quarterly).
  const target =
    filings.find((f) => f.form === "10-K") ??
    filings.find((f) => f.form === "10-Q") ??
    null;
  if (!target) return null;

  const accNoDashes = target.accessionNumber.replace(/-/g, "");
  const url = `${SEC_ARCHIVES_BASE}/${cikNum}/${accNoDashes}/${target.primaryDocument}`;
  const docResp = await fetch(url, { headers: { "User-Agent": getUserAgent() } });
  if (!docResp.ok) throw new Error(`SEC primary doc fetch failed for ${ticker}: ${docResp.status}`);
  const content = await docResp.text();

  return {
    ticker: ticker.toUpperCase(),
    cik,
    form: target.form,
    filing_date: target.filingDate,
    url,
    content,
  };
}

/**
 * Strip HTML to plain text and truncate. SEC filings are huge — for the
 * AIQ prompt we only need the MD&A + Risk Factors + segment disclosure
 * which usually fit in 8-15K characters of cleaned text.
 */
export function htmlToExcerpt(html: string, maxChars = 12000): string {
  // Remove scripts, styles, head, and inline XBRL tags.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<ix:[^>]*>/gi, " ")
    .replace(/<\/ix:[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) : stripped;
}
