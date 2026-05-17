"use client";

import { TweakRow } from "./TweakRow";

/**
 * Text input primitive — verbatim port of TweakText from tweaks-panel.jsx.
 */
export interface TweakTextProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}

export function TweakText({ label, value, placeholder, onChange }: TweakTextProps) {
  return (
    <TweakRow label={label}>
      <input
        className="twk-field"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </TweakRow>
  );
}
