"use client";

import type { ReactNode } from "react";

/**
 * Section heading inside the dev Tweaks panel.
 * Verbatim port of TweakSection from tweaks-panel.jsx.
 *
 * Note: the original source named the prop `label`. stage3-app.jsx's
 * TweaksUI calls it with `title`. The original component reads `label`, so
 * `title` would have rendered as undefined in the mockup — likely a known
 * quirk in the source. We accept BOTH, preferring `title` (the
 * Reticle-consumer name) and falling back to `label`.
 */
export interface TweakSectionProps {
  label?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

export function TweakSection({ label, title, children }: TweakSectionProps) {
  return (
    <>
      <div className="twk-sect">{title ?? label}</div>
      {children}
    </>
  );
}
