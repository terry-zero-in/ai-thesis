"use client";

import { TweakRow } from "./TweakRow";

/**
 * Dropdown primitive — verbatim port of TweakSelect from tweaks-panel.jsx.
 *
 * Options can be primitives (string|number) or {value,label}. Native <select>
 * emits strings, so the value type leaks to string when options aren't
 * object-shaped. Callers who want type-preservation pass {value,label}.
 */
export type TweakOption<V = unknown> = V | { value: V; label: string };

export interface TweakSelectProps<V = unknown> {
  label: string;
  value: V;
  options: ReadonlyArray<TweakOption<V>>;
  onChange: (v: string) => void;
}

export function TweakSelect<V = unknown>({ label, value, options, onChange }: TweakSelectProps<V>) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === "object" && o !== null && "value" in (o as object) ? (o as { value: V }).value : (o as V);
          const l = typeof o === "object" && o !== null && "label" in (o as object) ? (o as { label: string }).label : String(v);
          return (
            <option key={String(v)} value={String(v)}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}
