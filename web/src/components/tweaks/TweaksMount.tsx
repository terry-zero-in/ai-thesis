/**
 * Tree-shake-safe wrapper for the dev Tweaks panel.
 *
 * `process.env.NODE_ENV` is statically replaced at build time by Next, so in
 * a production build the conditional becomes `if (true) return null;` and
 * the entire TweaksPanel import graph (TweaksShell, all Tweak* controls, the
 * stylesheet) is dead-code-eliminated by the bundler.
 *
 * Wire <TweaksMount /> once at the Shell layer (any client boundary works).
 */
import { TweaksPanel } from "./TweaksPanel";

const isDev = process.env.NODE_ENV === "development";

export function TweaksMount() {
  if (!isDev) return null;
  return <TweaksPanel />;
}
