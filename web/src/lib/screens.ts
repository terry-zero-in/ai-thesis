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
  | "aiq-detail"
  | "aiq-drafts"
  | "memos"
  | "memo-detail"
  | "decisions"
  | "proposals"
  | "backtest"
  | "settings"
  | "login";

export const CRUMBS: Record<ScreenId, [string, string | null]> = {
  dash:          ["Dashboard", null],
  universe:      ["Universe", "All"],
  "name-detail": ["Universe", "Name"],
  portfolio:     ["Portfolio", "Book"],
  regime:        ["Regime", "Gauges"],
  aiq:           ["AIQ Editor", null],
  "aiq-detail":  ["AIQ Editor", "Name"],
  "aiq-drafts":  ["AIQ Editor", "Drafts"],
  memos:         ["Memos", "List"],
  "memo-detail": ["Memos", "Detail"],
  decisions:     ["Decisions", "Log"],
  proposals:     ["Proposals", "Pending"],
  backtest:      ["Backtest", null],
  settings:      ["Settings", null],
  login:         ["Sign in", null],
};

/** Map a Next pathname to the screen ID. */
export function pathToScreen(pathname: string): ScreenId {
  if (pathname === "/" || pathname === "") return "dash";
  if (pathname.startsWith("/universe/") && pathname !== "/universe") return "name-detail";
  if (pathname.startsWith("/universe")) return "universe";
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (pathname.startsWith("/regime")) return "regime";
  if (pathname.startsWith("/aiq-drafts")) return "aiq-drafts";
  if (pathname.startsWith("/aiq/") && pathname !== "/aiq") return "aiq-detail";
  if (pathname.startsWith("/aiq")) return "aiq";
  if (pathname.startsWith("/memos/") && pathname !== "/memos") return "memo-detail";
  if (pathname.startsWith("/memos")) return "memos";
  if (pathname.startsWith("/decisions")) return "decisions";
  if (pathname.startsWith("/proposals")) return "proposals";
  if (pathname.startsWith("/backtest")) return "backtest";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/login")) return "login";
  return "dash";
}

/**
 * Resolve the dynamic leaf crumb (e.g. ticker uppercase) from the URL when
 * the screen is a `[ticker]` route, falling back to the static CRUMBS leaf
 * otherwise. Centralizes the breadcrumb logic so the TopBar stays dumb.
 */
export function pathToCrumb(pathname: string): [string, string | null] {
  const screen = pathToScreen(pathname);
  const [root, leaf] = CRUMBS[screen];
  if (screen === "name-detail") {
    const ticker = pathname.replace(/^\/universe\//, "").split("/")[0];
    return [root, ticker ? ticker.toUpperCase() : leaf];
  }
  if (screen === "aiq-detail") {
    const ticker = pathname.replace(/^\/aiq\//, "").split("/")[0];
    return [root, ticker ? ticker.toUpperCase() : leaf];
  }
  return [root, leaf];
}

export const SCREEN_TO_PATH: Record<ScreenId, string> = {
  dash:          "/",
  universe:      "/universe",
  "name-detail": "/universe",
  portfolio:     "/portfolio",
  regime:        "/regime",
  aiq:           "/aiq",
  "aiq-detail":  "/aiq",
  "aiq-drafts":  "/aiq-drafts",
  memos:         "/memos",
  "memo-detail": "/memos",
  decisions:     "/decisions",
  proposals:     "/proposals",
  backtest:      "/backtest",
  settings:      "/settings",
  login:         "/login",
};
