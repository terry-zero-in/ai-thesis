"use client";

import { TweakRow } from "./TweakRow";

/**
 * Slider primitive — verbatim port of TweakSlider from tweaks-panel.jsx.
 */
export interface TweakSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = "", onChange }: TweakSliderProps) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input
        type="range"
        className="twk-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  );
}
