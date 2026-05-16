/**
 * Pure types + constants for the alerts log (THS-57). Safe to import
 * from client components — does not pull in the server-only Supabase
 * client. Matching server fetcher: `alerts-data.ts`.
 *
 * Alerts are derived on read; identity is encoded into `alert_key` so
 * acknowledgements can be persisted in `alert_acks` without storing the
 * event itself.
 */

export type AlertKind = "tier_change" | "conv_drop" | "aiq_drift" | "macro_flip" | "insider_cluster";

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  tier_change: "Tier change",
  conv_drop: "High-conviction drop ≥ 10pt",
  aiq_drift: "AIQ drift > 10pt",
  macro_flip: "Macro gate flip",
  insider_cluster: "Insider cluster",
};

/** Magnitude thresholds. */
export const CONV_DROP_THRESHOLD = 10;
export const AIQ_DRIFT_THRESHOLD = 10;

export interface AlertEvent {
  /** Encoded identity for ack persistence. */
  key: string;
  kind: AlertKind;
  /** Ticker (null for macro-gate flips). */
  ticker: string | null;
  /** Date of the row that produced the event. */
  as_of: string;
  /** Date of the prior comparison row (null for first-ever rows). */
  prior_as_of: string | null;
  /** One-line summary for the row title. */
  title: string;
  /** Multi-line detail rendered when expanded / clicked. */
  detail: string;
  /** Severity color hint: "high" = red, "warn" = amber, "info" = neutral. */
  severity: "high" | "warn" | "info";
  /** When acked: timestamp + optional note. null = unseen. */
  acked_at: string | null;
  acked_note: string | null;
}

export function alertKey(kind: AlertKind, ticker: string | null, as_of: string): string {
  return `${kind}:${ticker ?? "_"}:${as_of}`;
}
