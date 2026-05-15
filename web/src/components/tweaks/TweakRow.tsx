"use client";

import type { ReactNode } from "react";

/**
 * Row layout primitive — verbatim port of TweakRow from tweaks-panel.jsx.
 *
 * Vertical (label on top of control) by default; pass inline for the side-
 * by-side horizontal layout used by toggles and color swatches.
 */
export interface TweakRowProps {
  label: ReactNode;
  value?: ReactNode;
  inline?: boolean;
  children?: ReactNode;
}

export function TweakRow({ label, value, inline = false, children }: TweakRowProps) {
  return (
    <div className={inline ? "twk-row twk-row-h" : "twk-row"}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}
