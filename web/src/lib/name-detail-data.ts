/**
 * Per-name detail data fetcher (THS-53).
 *
 * Pulls everything the /universe/[ticker] page needs in one call:
 *   - universe row (name, layer)
 *   - latest scores_history row (factor_breakdown JSONB, final, tier, macro)
 *   - 12 weeks of composite history for the sparkline
 *   - latest aiq_rubric row (6 dimensions)
 *   - depreciation_flags rows (most recent flagged_at first)
 *
 * Mirrors the shape produced by `compute-composite-scores/index.ts.buildBreakdown`
 * and the per-factor compute jobs (compute-q-scores writes `factor_breakdown.q`,
 * etc.) — keep this file in sync with those producers.
 *
 * Falls back to a deterministic synthesized fixture when the browser
 * supabase client is null (env unset) OR when the DB returns no row for the
 * ticker (pre-cron dev). `synthetic: true` lets the UI label the source.
 */
import { getSupabaseBrowser } from "./supabase/client";
import type { Tier } from "./universe-data";

export interface NameSparkPoint {
  as_of: string;
  composite: number | null;
  final_score: number | null;
}

export interface NameQBreakdown {
  composite_z: number | null;
  pillars: {
    profitability: number | null;
    growth: number | null;
    safety: number | null;
    payout: number | null;
  };
}

export interface NameGBreakdown {
  composite_z: number | null;
  signals: {
    ntmGrowth: number | null;
    aiSegment: number | null;
    capexEfficiency: number | null;
  };
}

export interface NameVBreakdown {
  composite_z: number | null;
  raw_v: number | null;
  penalty: number;
  signals: {
    pegLike: number | null;
    adjFcfYield: number | null;
    ownHistoryFwdPeZ: number | null;
    forwardPeMean: number | null;
  };
}

export interface NameAiqRubric {
  scored_at: string;
  disclosure_pts: number;
  defensibility_pts: number;
  concentration_pts: number;
  capex_eff_pts: number;
  indep_demand_pts: number;
  accounting_pts: number;
  total: number;
  notes: string | null;
}

export interface NameDepFlag {
  flagged_at: string;
  extension_years: number | null;
  penalty_v: number | null;
  burry_overstatement_pct: number | null;
  source_url: string | null;
}

/**
 * Portfolio context for this ticker — held vs not-held. When held, exposes
 * the position metrics needed for the inline "your position" strip on the
 * name detail page (weight is the position's market value divided by the
 * book's total market value, P&L is current_price vs cost_basis). When not
 * held, exposes the single-name cap so the strip can frame target sizing
 * against the spec's 10% guardrail.
 *
 * Single-name cap pinned at 10% per spec §"Position-construction guardrails"
 * (docs/AI-Thesis-v2-Algorithm-and-Deployment.md line 353).
 */
export type NamePortfolioContext =
  | {
      held: false;
      single_name_cap_pct: number; // 0.10 per spec
    }
  | {
      held: true;
      shares: number;
      cost_basis: number;
      current_price: number | null;
      market_value: number; // null current_price → falls back to cost_basis × shares
      pl: number;
      pl_pct: number;
      weight: number; // position MV / total book MV, in [0, 1]
      total_market_value: number;
      single_name_cap_pct: number;
    };

export interface NameForm4Row {
  transaction_date: string;
  insider_name: string;
  insider_title: string | null;
  transaction_code: string; // P=Purchase, S=Sale, A=Award, M=Exempt, F=InKind, etc.
  acquired_disposed: string; // "A" or "D"
  shares: number | null;
  price_per_share: number | null;
  transaction_value: number | null;
  is_10b5_1: boolean | null;
  source_url: string | null;
}

export interface NameDetail {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
  as_of: string | null;
  q_score: number | null;
  g_score: number | null;
  v_score: number | null;
  aiq_score: number | null;
  composite: number | null;
  final_score: number | null;
  tier: Tier | null;
  macro_gates_hit: number;
  macro_multiplier: number;
  q: NameQBreakdown | null;
  g: NameGBreakdown | null;
  v: NameVBreakdown | null;
  history: NameSparkPoint[];
  aiq_rubric: NameAiqRubric | null;
  dep_flags: NameDepFlag[];
  form4_recent: NameForm4Row[];
  /**
   * Per-(ticker, latest as_of) concentration tax in [-15, 0], read from
   * `concentration_history`. Null pre-engine or for tickers not yet
   * processed by the weekly compute-concentration job.
   */
  concentration_tax: number | null;
  /**
   * Portfolio context — exposed even when the page is rendered as fixture
   * so the inline "your position" strip can show the not-held variant
   * (with the spec's single-name cap) instead of being suppressed entirely.
   */
  portfolio: NamePortfolioContext;
  synthetic: boolean;
  found: boolean;
}

const SINGLE_NAME_CAP_PCT = 0.10;

interface ScoresRow {
  ticker: string;
  as_of: string;
  q_score: number | null;
  g_score: number | null;
  v_score: number | null;
  aiq_score: number | null;
  composite: number | null;
  final_score: number | null;
  tier: Tier | null;
  macro_gates_hit: number;
  macro_multiplier: number;
  factor_breakdown: Record<string, unknown> | null;
}

interface UniverseRow {
  ticker: string;
  name: string;
  layer: number;
  layer_label: string;
}

export async function getNameDetail(ticker: string): Promise<NameDetail> {
  const t = ticker.toUpperCase();
  const sb = getSupabaseBrowser();
  if (!sb) return fixtureDetail(t);

  const [universeRes, historyRes, aiqRes, depRes, form4Res, concRes, posAllRes] = await Promise.all([
    sb.from("universe").select("ticker,name,layer,layer_label").eq("ticker", t).maybeSingle(),
    sb
      .from("scores_history")
      .select(
        "ticker,as_of,q_score,g_score,v_score,aiq_score,composite,final_score,tier,macro_gates_hit,macro_multiplier,factor_breakdown",
      )
      .eq("ticker", t)
      .order("as_of", { ascending: false })
      .limit(12),
    sb
      .from("aiq_rubric")
      .select(
        "scored_at,disclosure_pts,defensibility_pts,concentration_pts,capex_eff_pts,indep_demand_pts,accounting_pts,total,notes",
      )
      .eq("ticker", t)
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("depreciation_flags")
      .select("flagged_at,extension_years,penalty_v,burry_overstatement_pct,source_url")
      .eq("ticker", t)
      .order("flagged_at", { ascending: false }),
    sb
      .from("insider_form4_raw")
      .select(
        "transaction_date,insider_name,insider_title,transaction_code,acquired_disposed,shares,price_per_share,transaction_value,is_10b5_1,source_url",
      )
      .eq("ticker", t)
      .order("transaction_date", { ascending: false })
      .limit(8),
    sb
      .from("concentration_history")
      .select("tax")
      .eq("ticker", t)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // All open positions — needed to compute total book MV (weight denom)
    // AND check whether this ticker is held.
    sb
      .from("portfolio_positions")
      .select("ticker,shares,cost_basis")
      .is("closed_at", null),
  ]);

  const universe = universeRes.data as UniverseRow | null;
  const history = (historyRes.data ?? []) as ScoresRow[];
  if (!universe || history.length === 0) return fixtureDetail(t, universe);

  // Portfolio context — only joined when env is configured. Reads current
  // prices for all open positions so the weight denominator is honest.
  const positionRows = (posAllRes.data ?? []) as Array<{ ticker: string; shares: number; cost_basis: number }>;
  const portfolio = await buildPortfolioContext(sb, t, positionRows);

  return buildDetail(
    universe,
    history,
    aiqRes.data ?? null,
    (depRes.data ?? []) as NameDepFlag[],
    (form4Res.data ?? []) as NameForm4Row[],
    (concRes.data?.tax ?? null) as number | null,
    portfolio,
    false,
  );
}

async function buildPortfolioContext(
  sb: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  ticker: string,
  positions: Array<{ ticker: string; shares: number; cost_basis: number }>,
): Promise<NamePortfolioContext> {
  if (positions.length === 0) {
    return { held: false, single_name_cap_pct: SINGLE_NAME_CAP_PCT };
  }

  const tickers = positions.map((p) => p.ticker);
  const { data: priceData } = await sb
    .from("prices_raw")
    .select("ticker,date,close")
    .in("ticker", tickers)
    .order("date", { ascending: false })
    .limit(tickers.length * 3);
  const priceMap = new Map<string, number>();
  for (const r of (priceData ?? []) as Array<{ ticker: string; date: string; close: number | null }>) {
    if (priceMap.has(r.ticker)) continue; // first row per ticker = latest
    if (r.close != null) priceMap.set(r.ticker, Number(r.close));
  }

  let totalMv = 0;
  for (const p of positions) {
    const price = priceMap.get(p.ticker);
    totalMv += (price ?? Number(p.cost_basis)) * Number(p.shares);
  }

  const me = positions.find((p) => p.ticker === ticker);
  if (!me) return { held: false, single_name_cap_pct: SINGLE_NAME_CAP_PCT };

  const shares = Number(me.shares);
  const cost_basis = Number(me.cost_basis);
  const current_price = priceMap.get(ticker) ?? null;
  const market_value = (current_price ?? cost_basis) * shares;
  const pl = (current_price ?? cost_basis) * shares - cost_basis * shares;
  const pl_pct = cost_basis > 0 ? pl / (cost_basis * shares) : 0;
  const weight = totalMv > 0 ? market_value / totalMv : 0;

  return {
    held: true,
    shares,
    cost_basis,
    current_price,
    market_value,
    pl,
    pl_pct,
    weight,
    total_market_value: totalMv,
    single_name_cap_pct: SINGLE_NAME_CAP_PCT,
  };
}

function buildDetail(
  universe: UniverseRow,
  history: ScoresRow[],
  aiq: NameAiqRubric | null,
  depFlags: NameDepFlag[],
  form4: NameForm4Row[],
  concentrationTax: number | null,
  portfolio: NamePortfolioContext,
  synthetic: boolean,
): NameDetail {
  const latest = history[0];
  const fb = (latest?.factor_breakdown ?? {}) as Record<string, unknown>;
  return {
    ticker: universe.ticker,
    name: universe.name,
    layer: universe.layer,
    layer_label: universe.layer_label,
    as_of: latest?.as_of ?? null,
    q_score: latest?.q_score ?? null,
    g_score: latest?.g_score ?? null,
    v_score: latest?.v_score ?? null,
    aiq_score: latest?.aiq_score ?? null,
    composite: latest?.composite ?? null,
    final_score: latest?.final_score ?? null,
    tier: latest?.tier ?? null,
    macro_gates_hit: latest?.macro_gates_hit ?? 0,
    macro_multiplier: latest?.macro_multiplier ?? 1.0,
    q: (fb.q as NameQBreakdown) ?? null,
    g: (fb.g as NameGBreakdown) ?? null,
    v: (fb.v as NameVBreakdown) ?? null,
    history: history
      .slice()
      .reverse()
      .map((h) => ({ as_of: h.as_of, composite: h.composite, final_score: h.final_score })),
    aiq_rubric: aiq,
    dep_flags: depFlags,
    form4_recent: form4,
    concentration_tax: concentrationTax,
    portfolio,
    synthetic,
    found: true,
  };
}

// ---------------------------------------------------------------------------
// Fixture — deterministic seed for any ticker in the universe.
// ---------------------------------------------------------------------------
import { FIXTURE_INDEX } from "./universe-fixture";

function fixtureDetail(ticker: string, universe?: UniverseRow | null): NameDetail {
  const seed = universe ?? FIXTURE_INDEX[ticker];
  if (!seed) {
    return {
      ticker,
      name: ticker,
      layer: 0,
      layer_label: "Unknown",
      as_of: null,
      q_score: null,
      g_score: null,
      v_score: null,
      aiq_score: null,
      composite: null,
      final_score: null,
      tier: null,
      macro_gates_hit: 0,
      macro_multiplier: 1,
      q: null,
      g: null,
      v: null,
      history: [],
      aiq_rubric: null,
      dep_flags: [],
      form4_recent: [],
      concentration_tax: null,
      portfolio: { held: false, single_name_cap_pct: SINGLE_NAME_CAP_PCT },
      synthetic: true,
      found: false,
    };
  }

  // Deterministic per-ticker scores keyed off a hash of the ticker chars.
  const h = hash(seed.ticker);
  const q = 55 + (h % 40);
  const g = 50 + ((h * 3) % 45);
  const v = 45 + ((h * 7) % 50);
  const aiq = 50 + ((h * 11) % 45);
  const composite = Math.round(((q + g + v + aiq) / 4 + (seed.layer === 1 ? 5 : 0)) * 10) / 10;
  const macroMult = h % 11 === 0 ? 0.95 : 1.0;
  const gates = macroMult < 1 ? 1 : 0;
  const final = Math.round(composite * macroMult * 10) / 10;
  const tier: Tier = final >= 85 ? "High" : final >= 75 ? "Medium" : final >= 60 ? "Low" : "Avoid";

  // Anchor history to the latest fixture date (2026-05-09, the same as
  // the universe + dashboard fixtures) and walk back 7 days per index.
  // Prior dates were hardcoded 2026-02-01..04-22, leaving the chart
  // ending ~25 days before "today" (review §2.3 #7).
  const history: NameSparkPoint[] = [];
  const anchor = new Date("2026-05-09T00:00:00Z");
  for (let i = 11; i >= 0; i--) {
    const noise = (((h + i) % 7) - 3) * 0.8;
    const c = Math.max(40, Math.min(95, composite + noise));
    const fc = Math.max(40, Math.min(95, final + noise));
    const d = new Date(anchor.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    history.push({
      as_of: d.toISOString().slice(0, 10),
      composite: Math.round(c * 10) / 10,
      final_score: Math.round(fc * 10) / 10,
    });
  }

  const aiqRubric: NameAiqRubric | null =
    seed.layer <= 3
      ? {
          scored_at: "2026-04-30",
          disclosure_pts: 12 + (h % 9),
          defensibility_pts: 12 + ((h * 2) % 9),
          concentration_pts: 8 + (h % 8),
          capex_eff_pts: 8 + ((h * 3) % 8),
          indep_demand_pts: 7 + (h % 9),
          accounting_pts: 7 + ((h * 5) % 9),
          total: 0,
          notes: "Fixture rubric — replaced by live data once THS-46 ships.",
        }
      : null;
  if (aiqRubric) {
    aiqRubric.total =
      aiqRubric.disclosure_pts +
      aiqRubric.defensibility_pts +
      aiqRubric.concentration_pts +
      aiqRubric.capex_eff_pts +
      aiqRubric.indep_demand_pts +
      aiqRubric.accounting_pts;
  }

  // Depreciation flags only for L2 hyperscalers (per algorithm spec) and only ~half of them in fixture.
  const depFlags: NameDepFlag[] =
    seed.layer === 2 && h % 2 === 0
      ? [
          {
            flagged_at: "2026-02-15",
            extension_years: 1.5,
            penalty_v: -6,
            burry_overstatement_pct: 12.4,
            source_url: null,
          },
        ]
      : [];

  return {
    ticker: seed.ticker,
    name: seed.name,
    layer: seed.layer,
    layer_label: seed.layer_label,
    as_of: "2026-05-09",
    q_score: q,
    g_score: g,
    v_score: v,
    aiq_score: aiq,
    composite,
    final_score: final,
    tier,
    macro_gates_hit: gates,
    macro_multiplier: macroMult,
    q: {
      composite_z: round((h % 100) / 50 - 1, 2),
      pillars: {
        profitability: round((h % 80) / 40 - 1, 2),
        growth: round(((h * 3) % 80) / 40 - 1, 2),
        safety: round(((h * 5) % 80) / 40 - 1, 2),
        payout: round(((h * 7) % 80) / 40 - 1, 2),
      },
    },
    g: {
      composite_z: round((h % 90) / 45 - 1, 2),
      signals: {
        ntmGrowth: round(0.1 + ((h % 50) / 100), 3),
        aiSegment: seed.layer <= 3 ? round(0.05 + ((h % 30) / 100), 3) : null,
        capexEfficiency: round(0.6 + ((h % 60) / 100), 3),
      },
    },
    v: {
      composite_z: round((h % 70) / 35 - 1, 2),
      raw_v: round(((h * 2) % 60) / 30 - 1, 2),
      penalty: depFlags.length > 0 ? depFlags[0].penalty_v ?? 0 : 0,
      signals: {
        pegLike: round(0.8 + ((h % 90) / 100), 2),
        adjFcfYield: round(0.02 + ((h % 25) / 1000), 4),
        ownHistoryFwdPeZ: round((h % 60) / 30 - 1, 2),
        forwardPeMean: 18 + (h % 35),
      },
    },
    history,
    aiq_rubric: aiqRubric,
    dep_flags: depFlags,
    form4_recent: [],
    // Fixture concentration tax: deterministic per-ticker, in [-3.5, 0].
    // Matches the live-data range (compute-concentration scales to [-15, 0]
    // but the AI-Thesis slate typically lands in the [-3, 0] band, deepest
    // hit on the L1 trio per §"High-conviction aggregate").
    concentration_tax: -Math.round(((h % 7) * 0.5) * 10) / 10,
    // Fixture portfolio context — not-held by default. Live prod with a
    // populated portfolio_positions table will render the held variant.
    portfolio: { held: false, single_name_cap_pct: SINGLE_NAME_CAP_PCT },
    synthetic: true,
    found: true,
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function round(n: number | null, digits: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
