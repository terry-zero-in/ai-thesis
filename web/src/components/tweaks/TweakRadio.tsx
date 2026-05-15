"use client";

import { useEffect, useRef, useState } from "react";

import { TweakRow } from "./TweakRow";
import { TweakSelect } from "./TweakSelect";

/**
 * Segmented-control / radio primitive — verbatim port of TweakRadio from
 * tweaks-panel.jsx. Long labels fall back to a <select>; the thumb tracks
 * pointer drags across segments.
 */
export interface TweakRadioObjectOption<V> {
  value: V;
  label: string;
}
export type TweakRadioOption<V> = V | TweakRadioObjectOption<V>;

export interface TweakRadioProps<V extends string | number> {
  label: string;
  value: V;
  options: ReadonlyArray<TweakRadioOption<V>>;
  onChange: (v: V) => void;
}

function labelOf<V>(o: TweakRadioOption<V>): string {
  return typeof o === "object" && o !== null && "label" in o ? String((o as TweakRadioObjectOption<V>).label) : String(o);
}
function valueOf<V>(o: TweakRadioOption<V>): V {
  return typeof o === "object" && o !== null && "value" in o ? (o as TweakRadioObjectOption<V>).value : (o as V);
}

export function TweakRadio<V extends string | number>({ label, value, options, onChange }: TweakRadioProps<V>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  // React 19's strict-render lint forbids in-body ref writes; sync in an effect.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Segments wrap mid-word once per-segment width runs out (verbatim heuristic
  // from the source: 2 fit ~16 chars, 3 fit ~10, anything else falls back).
  const maxLen = options.reduce((m, o) => Math.max(m, labelOf(o).length), 0);
  const fitMap: Record<number, number> = { 2: 16, 3: 10 };
  const fitsAsSegments = maxLen <= (fitMap[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving like the segment path.
    const resolve = (s: string): V => {
      const m = options.find((o) => String(valueOf(o)) === s);
      return m === undefined ? (s as unknown as V) : valueOf(m);
    };
    return (
      <TweakSelect
        label={label}
        value={value}
        options={options as ReadonlyArray<TweakOption<V>>}
        onChange={(s) => onChange(resolve(s))}
      />
    );
  }

  const opts = options.map((o) =>
    typeof o === "object" && o !== null && "value" in o
      ? (o as TweakRadioObjectOption<V>)
      : ({ value: o as V, label: String(o) } as TweakRadioObjectOption<V>),
  );
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX: number): V => {
    const r = trackRef.current!.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: PointerEvent) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className={dragging ? "twk-seg dragging" : "twk-seg"}
      >
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

// Re-export the option type for TweakSelect interop.
type TweakOption<V> = V | { value: V; label: string };
