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
 * computes the blended cost basis and re-submits). Closing a position is
 * separate: use closePosition().
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
  if (!sb) return { ok: false, message: "Supabase env not configured — saves disabled in dev fixture mode." };

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
 * Soft-close a position (sets closed_at = today). The row remains in the
 * DB so cost basis / P&L can be reviewed historically; the dashboard
 * filters it out by closed_at IS NULL.
 */
export async function closePosition(
  _prev: PositionFormState,
  formData: FormData,
): Promise<PositionFormState> {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) return { ok: false, message: "Missing ticker." };

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await sb
    .from("portfolio_positions")
    .update({ closed_at: today })
    .eq("ticker", ticker);
  if (error) return { ok: false, message: `Close failed: ${error.message}` };

  revalidatePath("/portfolio");
  return { ok: true, message: `Closed ${ticker}.`, ticker };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
