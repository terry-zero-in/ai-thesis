"use client";

/**
 * Toggle switch primitive — verbatim port of TweakToggle from tweaks-panel.jsx.
 */
export interface TweakToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function TweakToggle({ label, value, onChange }: TweakToggleProps) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? "1" : "0"}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}
