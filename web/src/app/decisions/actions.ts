"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { AckState, BulkAckState } from "./action-types";

// State types + initial constants live in ./action-types because Next 16
// forbids non-async exports from "use server" modules (object exports throw
// at action-POST time with digest @E352).

/**
 * Acknowledge or un-acknowledge an alert. Toggles based on whether the
 * alert_key already has a row. Optional note (defaults null).
 */
export async function ackAlert(_prev: AckState, formData: FormData): Promise<AckState> {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { ok: false, message: "Missing alert key." };
  const note = (() => {
    const v = formData.get("note");
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  })();
  const remove = String(formData.get("remove") ?? "") === "1";

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, message: "Supabase env not configured — acks disabled until Supabase env is configured." };

  if (remove) {
    const { error } = await sb.from("alert_acks").delete().eq("alert_key", key);
    if (error) return { ok: false, message: `Un-ack failed: ${error.message}` };
    revalidatePath("/decisions");
    revalidatePath("/", "layout"); // refresh sidebar badge
    return { ok: true, message: "Re-opened.", key };
  }

  const { error } = await sb
    .from("alert_acks")
    .upsert({ alert_key: key, acked_note: note }, { onConflict: "alert_key" });
  if (error) return { ok: false, message: `Ack failed: ${error.message}` };
  revalidatePath("/decisions");
  revalidatePath("/", "layout");
  return { ok: true, message: "Acknowledged.", key };
}

/**
 * Bulk-acknowledge multiple alert keys in one upsert. Used by the
 * "Mark all read" button at the top of /decisions to clear the unseen
 * inventory (optionally scoped to a kind filter via the page param).
 * Server action — keys passed as JSON in a hidden FormData field.
 *
 * Review §2.10 #5.
 */
export async function ackAlerts(_prev: BulkAckState, formData: FormData): Promise<BulkAckState> {
  const raw = String(formData.get("keys") ?? "");
  let keys: string[];
  try {
    keys = JSON.parse(raw);
    if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) throw new Error();
  } catch {
    return { ok: false, message: "Invalid keys payload.", count: 0 };
  }
  if (keys.length === 0) return { ok: true, message: "Nothing to acknowledge.", count: 0 };

  const sb = await getSupabaseServer();
  if (!sb) {
    return {
      ok: false,
      message: "Supabase env not configured — bulk acks disabled until Supabase env is configured.",
      count: 0,
    };
  }

  const rows = keys.map((k) => ({ alert_key: k, acked_note: null }));
  const { error } = await sb.from("alert_acks").upsert(rows, { onConflict: "alert_key" });
  if (error) return { ok: false, message: `Bulk ack failed: ${error.message}`, count: 0 };
  revalidatePath("/decisions");
  revalidatePath("/", "layout");
  return { ok: true, message: `Acknowledged ${keys.length}.`, count: keys.length };
}
