"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { PositionFormState } from "./action-types";

// PositionFormState + POSITION_INITIAL live in ./action-types because Next 16
// forbids non-async exports from "use server" modules (object exports throw
// at action-POST time with digest @E352). Importers should use action-types
// for the type + initial state; this module exports only the actions.

/**
 * Add or update an open position.
 *
 * UPSERTs on the (ticker) PK — re-saving the same ticker updates shares /
 * cost basis in place (use case: averaging in over multiple buys; the UI
 * computes the blended cost basis and re-submits). Selling a position is
 * separate: use sellPosition().
 */
export async function savePosition(
  _prev: PositionFormState,
  formData: FormData,
): Promise<PositionFormState> {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) return { ok: false, message: "Pick a ticker." };

  const shares = Number(formData.get("shares"));
  if (!Number.isFinite(shares) || shares <= 0) {
    return { ok: false, message: "Shares must be > 0." };
  }
  const cost_basis = Number(formData.get("cost_basis"));
  if (!Number.isFinite(cost_basis) || cost_basis <= 0) {
    return { ok: false, message: "Cost basis must be > 0 (per share)." };
  }

  const opened_at = String(formData.get("opened_at") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const notes = strOrNull(formData.get("notes"));

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured — saves disabled until Supabase env is configured." };

  const { error } = await sb
    .from("portfolio_positions")
    .upsert(
      { ticker, shares, cost_basis, opened_at, notes, closed_at: null },
      { onConflict: "ticker" },
    );
  if (error) return { ok: false, message: `Save failed: ${error.message}` };

  revalidatePath("/portfolio");
  return { ok: true, message: `Saved ${ticker} — ${shares} @ $${cost_basis.toFixed(2)}.`, ticker };
}

/**
 * Sell shares of a held position (THS-103).
 *
 * Single-row-per-ticker model: shares decreases by shares_to_sell. Realized
 * P&L + proceeds accumulate. original_shares captures the pre-first-sale
 * count. closed_at is set ONLY when shares reach 0 (full close).
 *
 * Math:
 *   pl_this_sale       = (exit_price - cost_basis) * shares_to_sell
 *   proceeds_this_sale = exit_price * shares_to_sell
 *   new realized_pl    = existing realized_pl + pl_this_sale
 *   new realized_proceeds = existing + proceeds_this_sale
 *
 * Verify scenario (per ticket): buy ABC 10@$100 → sell 5@$150 → sell 5@$80
 *   realized_pl = (150-100)*5 + (80-100)*5 = 250 - 100 = +$150 ✓
 *
 * Cost basis is per-share and unchanged by sales (blended-cost model). To
 * change cost basis the operator edits the position via savePosition.
 */
export async function sellPosition(
  _prev: PositionFormState,
  formData: FormData,
): Promise<PositionFormState> {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) return { ok: false, message: "Missing ticker." };

  const shares_to_sell = Number(formData.get("shares_to_sell"));
  if (!Number.isFinite(shares_to_sell) || shares_to_sell <= 0) {
    return { ok: false, message: "Shares to sell must be > 0." };
  }
  const exit_price = Number(formData.get("exit_price"));
  if (!Number.isFinite(exit_price) || exit_price <= 0) {
    return { ok: false, message: "Exit price must be > 0 (per share)." };
  }
  const exit_date =
    String(formData.get("exit_date") ?? "").trim() || new Date().toISOString().slice(0, 10);

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured." };

  // Lookup the open row. RLS scopes to the caller's user_id so non-owners
  // get a null row (treated as "no open position").
  const { data: row, error: fetchError } = await sb
    .from("portfolio_positions")
    .select("shares,cost_basis,opened_at,original_shares,realized_pl,realized_proceeds")
    .eq("ticker", ticker)
    .is("closed_at", null)
    .maybeSingle();

  if (fetchError) return { ok: false, message: `Lookup failed: ${fetchError.message}` };
  if (!row) return { ok: false, message: `No open position for ${ticker}.` };

  const current_shares = Number(row.shares);
  const cost_basis = Number(row.cost_basis);
  const existing_realized_pl = Number(row.realized_pl ?? 0);
  const existing_realized_proceeds = Number(row.realized_proceeds ?? 0);
  const existing_original_shares = row.original_shares != null ? Number(row.original_shares) : null;
  const opened_at = String(row.opened_at);

  // Round to avoid floating-point edge cases on equality (e.g. 10.001 > 10).
  if (shares_to_sell > current_shares + 1e-6) {
    return {
      ok: false,
      message: `Cannot sell ${shares_to_sell} shares — only ${current_shares} open.`,
    };
  }
  if (exit_date < opened_at) {
    return { ok: false, message: `Exit date cannot be before opened (${opened_at}).` };
  }

  const pl_this_sale = (exit_price - cost_basis) * shares_to_sell;
  const proceeds_this_sale = exit_price * shares_to_sell;
  const new_realized_pl = existing_realized_pl + pl_this_sale;
  const new_realized_proceeds = existing_realized_proceeds + proceeds_this_sale;
  const remaining_shares = Math.max(0, current_shares - shares_to_sell);
  // First sale captures the original share count; subsequent sales preserve it.
  const new_original_shares = existing_original_shares ?? current_shares;

  const update: Record<string, unknown> = {
    shares: remaining_shares,
    exit_price,
    realized_pl: new_realized_pl,
    realized_proceeds: new_realized_proceeds,
    original_shares: new_original_shares,
  };

  // Full close → set closed_at to the exit_date so the closed-positions
  // section sorts by actual sale date (supports retroactive entry).
  if (remaining_shares <= 1e-6) {
    update.closed_at = exit_date;
    update.shares = 0;
  }

  const { error } = await sb
    .from("portfolio_positions")
    .update(update)
    .eq("ticker", ticker)
    .is("closed_at", null);

  if (error) return { ok: false, message: `Sell failed: ${error.message}` };

  revalidatePath("/portfolio");
  revalidatePath("/dashboard");

  const plSign = pl_this_sale >= 0 ? "+" : "−";
  const plAbs = Math.abs(pl_this_sale).toFixed(2);
  const fullClose = remaining_shares <= 1e-6;
  return {
    ok: true,
    message: fullClose
      ? `Closed ${ticker} — sold final ${shares_to_sell} @ $${exit_price.toFixed(2)} · realized ${plSign}$${plAbs}.`
      : `Sold ${shares_to_sell} of ${ticker} @ $${exit_price.toFixed(2)} · realized ${plSign}$${plAbs} · ${remaining_shares} shares remaining.`,
    ticker,
  };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
