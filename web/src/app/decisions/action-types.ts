/**
 * Shared types + initial state for /decisions server actions. Lives here
 * (not in actions.ts) because Next 16 forbids non-async exports from
 * "use server" modules — see the @E352 runtime error.
 */
export interface AckState {
  ok: boolean;
  message: string;
  key?: string;
}

export const ACK_INITIAL: AckState = { ok: false, message: "" };

export interface BulkAckState {
  ok: boolean;
  message: string;
  count: number;
}

export const BULK_ACK_INITIAL: BulkAckState = { ok: false, message: "", count: 0 };
