"use client";

import { TweakRow } from "./TweakRow";

/**
 * Curated color/palette picker — verbatim port of TweakColor from
 * tweaks-panel.jsx.
 *
 * Each option is either a single hex or an array of 1–5 hexes; a palette
 * renders colors[0] as the hero (~2/3 width) with the rest stacked in a
 * sharp column on the right. onChange emits the option in the shape it was
 * passed (string stays string, array stays array). Without options it falls
 * back to a native color input.
 */

export type TweakColorOption = string | string[];

export interface TweakColorProps<V extends TweakColorOption = TweakColorOption> {
  label: string;
  value: V;
  options?: ReadonlyArray<V>;
  onChange: (v: V) => void;
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa. Hex input only (#rgb / #rrggbb); other
// formats fall through to "light".
function isLight(hex: string): boolean {
  const h = String(hex).replace("#", "");
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, "0");
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

function Check({ light }: { light: boolean }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 7.2 5.8 10 11 4.2"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={light ? "rgba(0,0,0,.78)" : "#fff"}
      />
    </svg>
  );
}

export function TweakColor<V extends TweakColorOption = TweakColorOption>({
  label,
  value,
  options,
  onChange,
}: TweakColorProps<V>) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl">
          <span>{label}</span>
        </div>
        <input
          type="color"
          className="twk-swatch"
          value={typeof value === "string" ? value : (value as string[])[0]}
          onChange={(e) => onChange(e.target.value as V)}
        />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively.
  const key = (o: TweakColorOption) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors: string[] = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button
              key={i}
              type="button"
              className="twk-chip"
              role="radio"
              aria-checked={on}
              data-on={on ? "1" : "0"}
              aria-label={colors.join(", ")}
              title={colors.join(" · ")}
              style={{ background: hero }}
              onClick={() => onChange(o)}
            >
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => (
                    <i key={j} style={{ background: c }} />
                  ))}
                </span>
              )}
              {on && <Check light={isLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}
