"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

export interface AckState {
  ok: boolean;
  message: string;
  key?: string;
}

export const ACK_INITIAL: AckState = { ok: false, message: "" };

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
  if (!sb) return { ok: false, message: "Supabase env not configured — acks disabled in dev fixture mode." };

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
