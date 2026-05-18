/**
 * Shared types + initial state for portfolio server actions.
 *
 * This file is **not** a "use server" module — Next 16 rejects any
 * non-async export from a "use server" file with:
 *   Error: A "use server" file can only export async functions, found object.
 *
 * The constant POSITION_INITIAL + the PositionFormState interface lived in
 * actions.ts originally; moving them here keeps the action module export-set
 * to async functions only. Client components import this for types + initial
 * state; the action module re-exports the type alias for back-compat.
 */
export interface PositionFormState {
  ok: boolean;
  message: string;
  /** Ticker that just saved — used to highlight it in the table. */
  ticker?: string;
}

export const POSITION_INITIAL: PositionFormState = { ok: false, message: "" };
