"use client";

/**
 * Button primitive — verbatim port of TweakButton from tweaks-panel.jsx.
 */
export interface TweakButtonProps {
  label: string;
  onClick: () => void;
  secondary?: boolean;
}

export function TweakButton({ label, onClick, secondary = false }: TweakButtonProps) {
  return (
    <button type="button" className={secondary ? "twk-btn secondary" : "twk-btn"} onClick={onClick}>
      {label}
    </button>
  );
}
