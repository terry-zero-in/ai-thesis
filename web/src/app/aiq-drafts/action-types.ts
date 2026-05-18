/**
 * Shared types + initial state for /aiq-drafts server actions. Lives here
 * (not in actions.ts) because Next 16 forbids non-async exports from
 * "use server" modules — see the @E352 runtime error.
 */
export interface PromoteState {
  ok: boolean;
  message: string;
}

export const PROMOTE_INITIAL: PromoteState = { ok: false, message: "" };
