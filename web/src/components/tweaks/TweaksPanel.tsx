"use client";

import { useEffect } from "react";

import { useTweaks, type Density, type QueueState, type SevTreatment } from "@/hooks/useTweaks";
import { applyPalette } from "@/lib/theme";

import { TweaksShell } from "./TweaksShell";
import { TweakSection } from "./TweakSection";
import { TweakRadio } from "./TweakRadio";
import { TweakSelect } from "./TweakSelect";
import { TweakToggle } from "./TweakToggle";
import { TweakColor } from "./TweakColor";

/**
 * Reticle dev Tweaks panel — verbatim composition port of TweaksUI from
 * stage3-app.jsx (lines 409-441).
 *
 * Wires:
 *   - palette change → applyPalette() (from lib/theme.ts) → :root CSS vars
 *   - density change → <html data-density="…"> + --density-row CSS var
 *   - showIntro / sevTreatment / queueState → exposed via `tweakchange` window
 *     event + localStorage; consumers (IntroRibbon, ReviewsQueue, page route
 *     branches) read them in their own session.
 *
 * Iframe/postMessage paths from the original mockup are stripped.
 *
 * Theme-switcher seam: the source jsx also wires a separate <ThemeSwitcher>
 * in the TopBar (Phase 3b). Both surfaces write to tweaks.palette via the
 * same setTweak — they're parallel UI for the same state, not duplicated
 * logic. Defer to ThemeSwitcher for TopBar placement once Phase 3b lands;
 * the panel's color row stays as the dev-only escape hatch.
 */
export function TweaksPanel() {
  const [tweaks, setTweak] = useTweaks();

  // Apply palette + density to :root whenever they change. Mirrors the
  // useEffect in stage3-app.jsx around lines 510-530.
  useEffect(() => {
    applyPalette(tweaks.palette);
  }, [tweaks.palette]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-density", tweaks.density);
    root.style.setProperty("--density-row", tweaks.density === "compact" ? "8px" : "10px");
  }, [tweaks.density]);

  return (
    <TweaksShell title="Tweaks">
      <TweakSection title="Reviews queue">
        <TweakRadio<SevTreatment>
          label="Severity treatment"
          value={tweaks.sevTreatment}
          onChange={(v) => setTweak("sevTreatment", v)}
          options={[
            { value: "bar", label: "Bar on high/crit" },
            { value: "group-only", label: "Group-only" },
          ]}
        />
        <TweakSelect<QueueState>
          label="Queue state demo"
          value={tweaks.queueState}
          onChange={(v) => setTweak("queueState", v as QueueState)}
          options={[
            { value: "live", label: "Live (default)" },
            { value: "stress", label: "Stress · 120 rows (virtualized)" },
            { value: "empty", label: "Empty (no reviews)" },
            { value: "loading", label: "Loading" },
            { value: "error", label: "Supabase error" },
          ]}
        />
        <TweakToggle label="Show intro ribbon" value={tweaks.showIntro} onChange={(v) => setTweak("showIntro", v)} />
      </TweakSection>
      <TweakSection title="Look & feel">
        <TweakColor<[string, string, string, string]>
          label="Design system theme"
          value={tweaks.palette}
          onChange={(v) => setTweak("palette", v)}
          options={[
            ["#22D3EE", "#34D399", "#F59E0B", "#EF4444"],
            ["#A3E635", "#14B8A6", "#F97316", "#E11D48"],
            ["#00FF88", "#06B6D4", "#FBBF24", "#F43F5E"],
            ["#FF4D1F", "#10B981", "#FBBF24", "#DC2626"],
            ["#3E63DD", "#10B981", "#F59E0B", "#EF4444"],
          ]}
        />
        <TweakRadio<Density>
          label="Density"
          value={tweaks.density}
          onChange={(v) => setTweak("density", v)}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
          ]}
        />
      </TweakSection>
    </TweaksShell>
  );
}
