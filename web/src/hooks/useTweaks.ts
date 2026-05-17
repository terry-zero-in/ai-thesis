"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Dev-only tweaks state. localStorage-persisted, SSR-safe.
 *
 * Verbatim shape port of TWEAKS_DEFAULTS from stage3-app.jsx — the dev panel
 * mockup's source-of-truth defaults for Reviews queue + Look & feel toggles.
 *
 * SSR-safety: first render returns defaults so SSR + first client render
 * match. localStorage hydration happens in useEffect.
 *
 * Iframe/postMessage paths from the original tweaks-panel.jsx are stripped —
 * the Next app has no parent host. State persists locally only.
 */

export type SevTreatment = "bar" | "group-only";
export type Density = "compact" | "comfortable";
export type QueueState = "live" | "stress" | "empty" | "loading" | "error";
export type Palette = [string, string, string, string];

export interface TweaksDefaults {
  showIntro: boolean;
  sevTreatment: SevTreatment;
  palette: Palette;
  density: Density;
  queueState: QueueState;
}

export const TWEAKS_DEFAULTS: TweaksDefaults = {
  showIntro: true,
  sevTreatment: "group-only",
  palette: ["#22D3EE", "#34D399", "#F59E0B", "#EF4444"],
  density: "comfortable",
  queueState: "live",
};

const STORAGE_KEY = "reticle.tweaks.v1";

type Edits = Partial<TweaksDefaults>;
type Key = keyof TweaksDefaults;

export type SetTweak = {
  <K extends Key>(key: K, value: TweaksDefaults[K]): void;
  (edits: Edits): void;
};

/**
 * Single source of truth for tweak values. setTweak accepts either
 * setTweak('key', value) or setTweak({ key: value, ... }) — verbatim from
 * the original useTweaks API.
 */
export function useTweaks(defaults: TweaksDefaults = TWEAKS_DEFAULTS): [TweaksDefaults, SetTweak] {
  // SSR-safe: start with defaults so server + first client render match.
  const [values, setValues] = useState<TweaksDefaults>(defaults);

  // Hydrate from localStorage after mount. This is the canonical React 19
  // SSR-safe pattern: defaults render on the server (no localStorage there),
  // real values land after the first client mount. The cascading-render the
  // lint rule warns about is exactly the intended one-shot hydration here.
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TweaksDefaults>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore — corrupted blob or storage denied
    }
  }, []);

  const setTweak = useCallback<SetTweak>((keyOrEdits: Key | Edits, val?: unknown) => {
    const edits: Edits =
      typeof keyOrEdits === "object" && keyOrEdits !== null
        ? (keyOrEdits as Edits)
        : ({ [keyOrEdits as Key]: val } as Edits);
    setValues((prev) => {
      const next = { ...prev, ...edits };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return [values, setTweak];
}
