/**
 * Canonical Tier-A layer weights for composite derivation — THS-73.
 *
 * Source: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §"v2 layer weights"
 * (lines 179-191).
 *
 * v1 engine status: M and S factors are qualitative annotations only — they
 * do NOT enter the composite. We rescale the four Tier-A weights (Q/G/V/AIQ)
 * to sum to 1.0 per layer so the composite stays on a 0-100 scale.
 *
 * Re-export from here whenever a UI surface needs to *show* the math.
 * Do NOT duplicate these constants in the engine pipeline — the engine
 * computes composite server-side; UI uses these to display the derivation.
 */

export type LayerCode = 1 | 2 | 3 | 4 | 5;

/** Raw v2 weights including qualitative M/S — totals 100%. */
const RAW_WEIGHTS: Record<LayerCode, { Q: number; G: number; V: number; AIQ: number; M: number; S: number }> = {
  1: { Q: 0.22, G: 0.26, V: 0.14, AIQ: 0.18, M: 0.12, S: 0.08 },
  2: { Q: 0.32, G: 0.22, V: 0.14, AIQ: 0.14, M: 0.10, S: 0.08 },
  3: { Q: 0.18, G: 0.30, V: 0.08, AIQ: 0.18, M: 0.16, S: 0.10 },
  4: { Q: 0.30, G: 0.22, V: 0.18, AIQ: 0.14, M: 0.10, S: 0.06 },
  5: { Q: 0.28, G: 0.18, V: 0.16, AIQ: 0.14, M: 0.14, S: 0.10 },
};

export interface TierAWeights {
  Q: number;
  G: number;
  V: number;
  AIQ: number;
}

/**
 * Tier-A weights for a given layer, rescaled so Q+G+V+AIQ = 1.0. These are
 * the weights the live v1 engine applies. M and S are qualitative overlays
 * that can downgrade but not enter composite arithmetic.
 */
export function tierAWeights(layer: LayerCode): TierAWeights {
  const raw = RAW_WEIGHTS[layer];
  const total = raw.Q + raw.G + raw.V + raw.AIQ;
  return {
    Q: raw.Q / total,
    G: raw.G / total,
    V: raw.V / total,
    AIQ: raw.AIQ / total,
  };
}

/** Multiplier curve per docs §"Macro gate state" (S5 lock). */
export function macroMultiplierFor(gatesHit: number): number {
  if (gatesHit >= 3) return 0.85;
  if (gatesHit === 2) return 0.90;
  if (gatesHit === 1) return 0.95;
  return 1.00;
}

/** Composite-tier classification per docs §"Tier cutpoints". */
export function classifyTier(finalScore: number): "High" | "Medium" | "Low" | "Avoid" {
  if (finalScore >= 75) return "High";
  if (finalScore >= 60) return "Medium";
  if (finalScore >= 45) return "Low";
  return "Avoid";
}
