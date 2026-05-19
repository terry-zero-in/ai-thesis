import Link from "next/link";
import { MonoMetaSpine } from "@/components/primitives/MonoMetaSpine";

/**
 * EngineStateStrip — single horizontal status row that absorbs both the
 * MonoMetaSpine engine-state segments AND the AlertCallout severity badge
 * into ONE chrome row. Replaces the previous Dashboard pattern where the
 * same regime/macro fact was repeated across MonoMetaSpine + AlertCallout
 * + TodayThesisCard + CompactGateStrip (four surfaces, one fact).
 *
 * Posture (per Linear "calmer interface" refresh — Terry sent the blog
 * screenshots S8): structure felt not seen, don't compete for attention
 * you haven't earned, less is more.
 *
 *   At rest (0 gates hit):
 *     as_of · engine · LIVE · ● NEUTRAL 1.00× (0/3) · weekly chain
 *
 *   When gates > 0:
 *     as_of · engine · LIVE · ● TIGHTENED 0.95× (1/3) · ▶ Review regime
 *                                                          ^^^^^^^^^^^^^^
 *                                                          single accent moment
 *
 * The severity-toned pill replaces the entire AlertCallout card. The
 * "Review regime" link is the ONE navigation affordance for the alert;
 * scattered "Open regime ›" / "View all ›" links across multiple cards
 * are gone.
 */
export function EngineStateStrip({
  asOf,
  synthetic,
  macroGatesHit,
  macroMultiplier,
  regimeState,
}: {
  asOf: string | null;
  synthetic: boolean;
  macroGatesHit: number;
  macroMultiplier: number;
  regimeState: { label: string; color: string };
}) {
  const gatesActive = macroGatesHit > 0;

  return (
    <MonoMetaSpine
      segments={[
        { label: "as_of", value: asOf ?? "—" },
        { label: "engine", value: "composite v1.0" },
        {
          label: "mode",
          value: (
            <span
              style={{
                color: synthetic ? "var(--warning)" : "var(--success)",
                fontWeight: 600,
                letterSpacing: ".02em",
              }}
              title={
                synthetic
                  ? "Stubbed: synthesized fixture data — engine not yet running against a deployed Supabase project."
                  : "Live: scores read from public.scores_history populated by the Saturday chain."
              }
            >
              {synthetic ? "STUBBED" : "LIVE"}
            </span>
          ),
        },
        {
          label: "regime",
          value: <RegimePill state={regimeState} multiplier={macroMultiplier} gatesHit={macroGatesHit} />,
        },
        ...(gatesActive
          ? [
              {
                label: "",
                value: (
                  <Link
                    href="/regime"
                    style={{
                      color: regimeState.color,
                      fontFamily: "var(--m)",
                      letterSpacing: ".02em",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ▶ Review regime
                  </Link>
                ),
              },
            ]
          : [{ label: "weekly chain", value: "Sat 22:00 UTC" }]),
      ]}
    />
  );
}

function RegimePill({
  state,
  multiplier,
  gatesHit,
}: {
  state: { label: string; color: string };
  multiplier: number;
  gatesHit: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--m)",
        color: state.color,
        letterSpacing: ".02em",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: state.color,
        }}
      />
      <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{state.label}</span>
      <span style={{ color: "var(--text-3)" }}>·</span>
      <span style={{ fontWeight: 500 }}>{multiplier.toFixed(2)}×</span>
      <span style={{ color: "var(--text-3)" }}>·</span>
      <span style={{ color: "var(--text-3)" }}>
        {gatesHit}/3 gates
      </span>
    </span>
  );
}
