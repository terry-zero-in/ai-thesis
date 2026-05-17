/**
 * Theme presets — verbatim port of THEMES from stage3-app.jsx.
 *
 * Each theme bends success/warning/danger/info away from its accent hue so
 * semantic states stay legible. Stored value is the 4-color preview array
 * (accent · success · warning · danger); THEMES is keyed by accent hex
 * (palette[0]) for lookup.
 */
export interface Theme {
  name: string;
  accent: [string, string, string]; // [base, hover, pressed]
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export const THEMES: Record<string, Theme> = {
  "#22D3EE": {
    name: "Plasma Cyan",
    accent: ["#22D3EE", "#67E8F9", "#0EA5C7"],
    onAccent: "#0a1a1d",
    success: "#34D399",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#A78BFA",
  },
  "#A3E635": {
    name: "Plasma Lime",
    accent: ["#A3E635", "#BEF264", "#84CC16"],
    onAccent: "#1a1f0a",
    success: "#14B8A6",
    warning: "#F97316",
    danger: "#E11D48",
    info: "#38BDF8",
  },
  "#00FF88": {
    name: "Phosphor Green",
    accent: ["#00FF88", "#5BFFAA", "#00CC66"],
    onAccent: "#001a0d",
    success: "#06B6D4",
    warning: "#FBBF24",
    danger: "#F43F5E",
    info: "#A78BFA",
  },
  "#FF4D1F": {
    name: "Lava",
    accent: ["#FF4D1F", "#FF7A4D", "#D63A0E"],
    onAccent: "#ffffff",
    success: "#10B981",
    warning: "#FBBF24",
    danger: "#DC2626",
    info: "#0EA5E9",
  },
  "#3E63DD": {
    name: "Iris Indigo",
    accent: ["#3E63DD", "#6E8FE8", "#2D4FB8"],
    onAccent: "#ffffff",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#06B6D4",
  },
};

export const DEFAULT_PALETTE: [string, string, string, string] = ["#22D3EE", "#34D399", "#F59E0B", "#EF4444"];

const hexToRgb = (hex: string) => {
  const m = hex.replace("#", "");
  return `${parseInt(m.slice(0, 2), 16)},${parseInt(m.slice(2, 4), 16)},${parseInt(m.slice(4, 6), 16)}`;
};

/**
 * Apply a 4-tuple palette (accent · success · warning · danger) to :root by
 * mutating CSS variables. Resolves the accent triplet + soft/border/glow tints
 * + on-accent text color from THEMES (keyed by palette[0]).
 *
 * Verbatim port of the useEffect in stage3-app.jsx that watches tweaks.palette.
 */
export function applyPalette(palette: [string, string, string, string] | string[]) {
  if (typeof document === "undefined") return;
  const pal = Array.isArray(palette) ? palette : DEFAULT_PALETTE;
  const theme = THEMES[pal[0]] || THEMES["#22D3EE"];
  const [a, h, p] = theme.accent;
  const s = document.documentElement.style;
  s.setProperty("--accent", a);
  s.setProperty("--accent-hover", h);
  s.setProperty("--accent-pressed", p);
  s.setProperty("--accent-soft", `rgba(${hexToRgb(a)},.10)`);
  s.setProperty("--accent-border", `rgba(${hexToRgb(a)},.40)`);
  s.setProperty("--accent-glow", `rgba(${hexToRgb(a)},.32)`);
  s.setProperty("--on-accent", theme.onAccent);
  s.setProperty("--success", theme.success);
  s.setProperty("--warning", theme.warning);
  s.setProperty("--danger", theme.danger);
  s.setProperty("--info", theme.info);
}
