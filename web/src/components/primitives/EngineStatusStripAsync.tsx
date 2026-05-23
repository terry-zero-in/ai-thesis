import { getEngineStatus } from "@/lib/engine-status";
import { EngineStatusStrip } from "./EngineStatusStrip";

/**
 * Server-async wrapper around <EngineStatusStrip /> — fetches engine
 * status server-side and forwards into the client primitive.
 *
 * Drop this directly into any RSC page tree (or pass as `children` into
 * a Client Component) so the strip's freshness fetch participates in
 * the page's ISR window.
 *
 * Using this avoids requiring every caller to thread `getEngineStatus()`
 * → props explicitly. Pages that need to short-circuit the fetch (e.g.,
 * synthetic data fixture) should call <EngineStatusStrip status={...} />
 * directly instead.
 */
export async function EngineStatusStripAsync() {
  const status = await getEngineStatus();
  return <EngineStatusStrip status={status} />;
}
