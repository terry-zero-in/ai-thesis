/**
 * Server-safe greeting computer. Pure function; no "use client" directive
 * so server components can import it for initial-paint values.
 * GreetingStrip (client) imports the same function for the 60s tick.
 *
 * America/New_York for the market clock (NYSE 9:30–16:00 ET regular session).
 * America/Chicago for time-of-day greeting (Terry's wall clock).
 *
 * Spec: /lambo Dashboard polish D1 — "Greeting Logic" + "Market clock" subtitle.
 *   - <5am or >=22 → "Up late, {name}" (covers 10pm–4:59am)
 *   - 5–11      → "Good morning"
 *   - 12–16     → "Good afternoon"
 *   - 17–21     → "Good evening"
 */
const WALL_TZ = "America/Chicago";
const MARKET_TZ = "America/New_York";

const NAME = "Terry";

export interface GreetingResult {
  greeting: string;
  /** Long-form date for the second line. */
  dateLabel: string;
  /** Market clock segment: "NYSE open · 2:14:18 to close" or similar. */
  marketLabel: string;
  /** Live HH:MM:SS clock in Terry's wall TZ (Chicago). Drives the "this thing is alive" tick. */
  wallClock: string;
  /** Market open right now (drives the pulsing-dot indicator color). */
  marketOpen: boolean;
}

/**
 * Bare time-of-day greeting (no name suffix). NYC-time aware per THS-74
 * spec ("time-of-day-aware greeting in NYC time"). Returns one of:
 *   "Good morning" / "Good afternoon" / "Good evening" / "Up late"
 *
 * Prefer this when a caller only needs the salutation token (e.g., a
 * route layout that composes its own subject). For the full greeting
 * line, market clock, and live wall clock, use computeGreeting().
 */
export function getGreeting(now: Date = new Date()): string {
  const mkt = partsFor(now, MARKET_TZ);
  const mktHour = parseInt(mkt.hour, 10);
  return greetingFor(mktHour);
}

export function computeGreeting(now: Date = new Date()): GreetingResult {
  const wall = partsFor(now, WALL_TZ);
  const wallHour = parseInt(wall.hour, 10);
  const greeting = greetingFor(wallHour);
  const dateLabel = `${wall.weekday}, ${wall.month} ${wall.day}`;
  const { label: marketLabel, open: marketOpen } = computeMarketLabel(now);
  const wallClock = `${wall.hour}:${wall.minute}:${wall.second} CT`;
  return { greeting: `${greeting}, ${NAME}`, dateLabel, marketLabel, wallClock, marketOpen };
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Up late";
}

interface DatePartsBundle {
  weekday: string;
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  second: string;
  dow: number; // 0=Sun..6=Sat
}

function partsFor(now: Date, tz: string): DatePartsBundle {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayStr = get("weekday");
  const dowMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  };
  return {
    weekday: weekdayStr,
    month: get("month"),
    day: get("day"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    dow: dowMap[weekdayStr] ?? 0,
  };
}

/**
 * Market clock subtitle. Doesn't honor holiday calendar — that's a v1.1
 * upgrade. Spec (THS-74) format: `NYSE open · 2h 14m to close` during the
 * regular 9:30–16:00 ET session, `NYSE closed` outside it. Minute
 * precision intentional — second precision in a static subtitle reads as
 * theatrical, not informative (the live wall clock in GreetingStrip ticks
 * the seconds anyway).
 */
function computeMarketLabel(now: Date): { label: string; open: boolean } {
  const mkt = partsFor(now, MARKET_TZ);
  const mktHour = parseInt(mkt.hour, 10);
  const mktMin = parseInt(mkt.minute, 10);
  const mktSec = parseInt(mkt.second, 10);
  const secondsIntoDay = mktHour * 3600 + mktMin * 60 + mktSec;
  const OPEN = 9 * 3600 + 30 * 60;   // 09:30:00 ET
  const CLOSE = 16 * 3600;           // 16:00:00 ET

  // Weekend
  if (mkt.dow === 0 || mkt.dow === 6) {
    return { label: "NYSE closed", open: false };
  }
  // Pre-open weekday
  if (secondsIntoDay < OPEN) {
    const secs = OPEN - secondsIntoDay;
    return { label: `NYSE closed · opens in ${minuteDuration(secs)}`, open: false };
  }
  // Regular session
  if (secondsIntoDay < CLOSE) {
    const secs = CLOSE - secondsIntoDay;
    return { label: `NYSE open · ${minuteDuration(secs)} to close`, open: true };
  }
  // Post-close weekday
  return { label: "NYSE closed", open: false };
}

/**
 * Format total seconds as "2h 14m" (or "14m" when under an hour, or
 * "<1m" when under a minute). Minute-precision deliberate per THS-74 spec
 * — the live wall-clock seconds ticker lives on GreetingStrip; this
 * helper drives the static subtitle that's stable for 30+ seconds.
 */
function minuteDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 1) return "<1m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
