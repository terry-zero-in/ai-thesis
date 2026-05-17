/**
 * Theme presets — locked to AI Thesis Master Design Spec §2.1 (Cypher Indigo).
 *
 * Spec §1.3: "monochrome with one accent. Cypher Indigo #4D5BFF is the only
 * chromatic accent." Multi-theme support from the Reticle base was stripped
 * here because spec §13 lists "Themes other than dark" as out-of-scope for v1.
 * Each entry retains the same shape so applyPalette() can keep its lookup
 * semantics without conditionals; the multi-theme switcher infrastructure
 * (ThemeSwitcher, TweaksPanel palette picker) will be removed in a follow-up.
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
  "#4D5BFF": {
    name: "Cypher Indigo",
    accent: ["#4D5BFF", "#6573FF", "#3D4ECC"],
    onAccent: "#ffffff",
    success: "#5BB880",
    warning: "#DDA85A",
    danger: "#E07878",
    info: "#6594E8",
  },
};

export const DEFAULT_PALETTE: [string, string, string, string] = ["#4D5BFF", "#5BB880", "#DDA85A", "#E07878"];

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
  const theme = THEMES[pal[0]] || THEMES[DEFAULT_PALETTE[0]];
  const [a, h, p] = theme.accent;
  const s = document.documentElement.style;
  s.setProperty("--accent", a);
  s.setProperty("--accent-hover", h);
  s.setProperty("--accent-pressed", p);
  s.setProperty("--accent-soft", `rgba(${hexToRgb(a)},.10)`);
  s.setProperty("--accent-border", `rgba(${hexToRgb(a)},.40)`);
  // accent-glow alpha .18 per spec §2.1 (was .32 from Reticle base).
  s.setProperty("--accent-glow", `rgba(${hexToRgb(a)},.18)`);
  s.setProperty("--on-accent", theme.onAccent);
  s.setProperty("--success", theme.success);
  s.setProperty("--warning", theme.warning);
  s.setProperty("--danger", theme.danger);
  s.setProperty("--info", theme.info);
}
