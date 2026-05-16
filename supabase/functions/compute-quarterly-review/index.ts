// THS-67 — Quarterly review checklist orchestrator.
//
// Loads checklist inputs (dep flags, AIQ snapshots, hyperscaler price
// windows, capex TTMs) and runs `buildQuarterlyChecklist`. Upserts one
// row into `quarterly_reviews` keyed on as_of with the findings array.
// The /decisions page derives a `quarterly_review` alert from the
// latest unreviewed row.

import { HttpError, requireCronAuth } from "../_shared/auth.ts";
import { buildQuarterlyChecklist } from "../_shared/quarterly-checklist.ts";
import { loadQuarterlyInputs, serviceClient } from "../_shared/supabase.ts";

declare const Deno: { serve: (h: (req: Request) => Promise<Response>) => void };

interface RequestBody {
  as_of?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now();
  try {
    requireCronAuth(req);

    let body: RequestBody = {};
    if (req.method !== "GET") {
      const text = await req.text();
      if (text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, "request body must be JSON or empty");
        }
      }
    }
    const asOf = body.as_of ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      throw new HttpError(400, `as_of must be YYYY-MM-DD (got "${asOf}")`);
    }

    const client = serviceClient();
    const inputs = await loadQuarterlyInputs(client, asOf);
    const findings = buildQuarterlyChecklist(inputs);

    const upsertRes = await client
      .from("quarterly_reviews")
      .upsert(
        {
          as_of: asOf,
          findings,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "as_of" },
      );
    if (upsertRes.error) throw upsertRes.error;

    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

    return Response.json({
      ok: true,
      as_of: asOf,
      window_start: inputs.window_start,
      is_annual_trigger: inputs.is_annual_trigger,
      finding_count: findings.length,
      severity_counts: counts,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status });
  }
});
