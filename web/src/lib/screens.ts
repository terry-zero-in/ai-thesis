/**
 * Screen registry — maps Next App Router pathnames to (rootCrumb, leafCrumb).
 * Used by TopBar breadcrumb + Sidebar active-item logic.
 *
 * Naming convention from Reticle: each route has a stable `screen` id so
 * page-level keybinds + CRUMBS table key off the same identifier.
 */
export type ScreenId =
  | "dash"
  | "universe"
  | "name-detail"
  | "portfolio"
  | "regime"
  | "aiq"
  | "memos"
  | "memo-detail"
  | "decisions"
  | "settings";

export const CRUMBS: Record<ScreenId, [string, string | null]> = {
  dash:          ["Dashboard", null],
  universe:      ["Universe", "All"],
  "name-detail": ["Universe", "Name"],
  portfolio:     ["Portfolio", "Book"],
  regime:        ["Regime", "Gauges"],
  aiq:           ["AIQ Editor", null],
  memos:         ["Memos", "List"],
  "memo-detail": ["Memos", "Detail"],
  decisions:     ["Decisions", "Log"],
  settings:      ["Settings", null],
};

/** Map a Next pathname to the screen ID. */
export function pathToScreen(pathname: string): ScreenId {
  if (pathname === "/" || pathname === "") return "dash";
  if (pathname.startsWith("/universe/") && pathname !== "/universe") return "name-detail";
  if (pathname.startsWith("/universe")) return "universe";
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (pathname.startsWith("/regime")) return "regime";
  if (pathname.startsWith("/aiq")) return "aiq";
  if (pathname.startsWith("/memos/") && pathname !== "/memos") return "memo-detail";
  if (pathname.startsWith("/memos")) return "memos";
  if (pathname.startsWith("/decisions")) return "decisions";
  if (pathname.startsWith("/settings")) return "settings";
  return "dash";
}

export const SCREEN_TO_PATH: Record<ScreenId, string> = {
  dash:          "/",
  universe:      "/universe",
  "name-detail": "/universe",
  portfolio:     "/portfolio",
  regime:        "/regime",
  aiq:           "/aiq",
  memos:         "/memos",
  "memo-detail": "/memos",
  decisions:     "/decisions",
  settings:      "/settings",
};
