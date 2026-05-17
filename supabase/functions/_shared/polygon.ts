// THS-59 (E5.2) — Polygon.io options snapshot client.
//
// Polygon Starter ($79/mo) gives unlimited options snapshot endpoint
// calls at the day cadence we need. We pull
//   /v3/snapshot/options/{underlying}
// which returns the full chain (all strikes × all expirations) with
// greeks + IV + OI per contract. Pagination via `next_url`.
//
// `fetchOptionsSnapshot` does the I/O; `normalizePolygonContract` is
// the pure shape adapter (Polygon → OptionContract). Both exported so
// tests can exercise the normalizer without hitting the network.

import { requireEnv } from "./env.ts";
import type { OptionContract } from "./options-metrics.ts";

const POLYGON_BASE = "https://api.polygon.io";

/** Raw row shape from Polygon `/v3/snapshot/options/{underlying}`. */
export interface PolygonOptionRow {
  details?: {
    contract_type?: "call" | "put";
    strike_price?: number;
    expiration_date?: string; // ISO YYYY-MM-DD
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  implied_volatility?: number;
  open_interest?: number;
}

interface PolygonSnapshotResponse {
  results?: PolygonOptionRow[];
  next_url?: string;
  status?: string;
}

/**
 * Pull the full options chain for `underlying` from Polygon. Follows
 * `next_url` pagination until exhausted or the cap is reached.
 */
export async function fetchOptionsSnapshot(
  underlying: string,
  options: { maxPages?: number; asOf?: string } = {},
): Promise<OptionContract[]> {
  const apikey = requireEnv("POLYGON_API_KEY");
  const maxPages = options.maxPages ?? 10;
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);

  let url: string | null =
    `${POLYGON_BASE}/v3/snapshot/options/${encodeURIComponent(underlying)}?limit=250`;
  const out: OptionContract[] = [];
  let page = 0;

  while (url && page < maxPages) {
    const sep = url.includes("?") ? "&" : "?";
    const resp = await fetch(`${url}${sep}apiKey=${apikey}`);
    if (!resp.ok) {
      throw new Error(
        `Polygon snapshot failed for ${underlying}: ${resp.status} ${resp.statusText}`,
      );
    }
    const body = (await resp.json()) as PolygonSnapshotResponse;
    const rows = body.results ?? [];
    for (const r of rows) {
      const c = normalizePolygonContract(r, asOf);
      if (c) out.push(c);
    }
    url = body.next_url ?? null;
    page += 1;
  }

  return out;
}

/**
 * Map a Polygon contract row to our internal `OptionContract` shape.
 * Returns null when the row lacks the minimum fields (contract type,
 * expiration). DTE is computed from expiration_date - asOf.
 */
export function normalizePolygonContract(
  row: PolygonOptionRow,
  asOf: string,
): OptionContract | null {
  const type = row.details?.contract_type;
  if (type !== "call" && type !== "put") return null;
  const exp = row.details?.expiration_date;
  if (!exp) return null;

  return {
    contract_type: type,
    strike: row.details?.strike_price ?? null,
    dte: daysBetweenIso(asOf, exp),
    open_interest: row.open_interest ?? null,
    implied_volatility: row.implied_volatility ?? null,
    delta: row.greeks?.delta ?? null,
  };
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = new Date(toIso + "T00:00:00Z").getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}
