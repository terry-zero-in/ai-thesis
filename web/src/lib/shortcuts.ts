/**
 * Keyboard shortcut registry — verbatim port of SHORTCUTS from stage3-app.jsx.
 *
 * 4-section model. Navigation = G-prefix sequences (rendered with 'then' chip).
 * Actions = single-key + ⌘ commands. Selection = J/K/X/Esc focus model. View = chrome.
 * Single source of truth: the legend overlay reads this. Handler implements per-section.
 */
export interface ShortcutItem {
  keys: string[];
  label: string;
  alt?: string[];
}

export interface ShortcutGroup {
  group: string;
  items: ShortcutItem[];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    group: "Navigation",
    items: [
      { keys: ["G", "then", "D"], label: "Go to Dashboard" },
      { keys: ["G", "then", "U"], label: "Go to Universe" },
      { keys: ["G", "then", "P"], label: "Go to Portfolio" },
      { keys: ["G", "then", "R"], label: "Go to Regime" },
      { keys: ["G", "then", "A"], label: "Go to AIQ Editor" },
      { keys: ["G", "then", "M"], label: "Go to Memos" },
      { keys: ["G", "then", "X"], label: "Go to Decisions" },
    ],
  },
  {
    group: "Selection",
    items: [
      { keys: ["J"], label: "Move focus down · Universe · Memos" },
      { keys: ["K"], label: "Move focus up · Universe · Memos" },
      { keys: ["↵"], label: "Open detail for focused row" },
      { keys: ["Esc"], label: "Clear focus · close modal · cancel G" },
    ],
  },
  {
    group: "View",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["⌘", "\\"], label: "Toggle context panel" },
      { keys: ["⌘", "B"], label: "Toggle sidebar" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
    ],
  },
];
