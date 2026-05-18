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
  /** Market clock segment: "NYSE open · 2h 14m to close" or similar. */
  marketLabel: string;
}

export function computeGreeting(now: Date = new Date()): GreetingResult {
  const wall = partsFor(now, WALL_TZ);
  const wallHour = parseInt(wall.hour, 10);
  const greeting = greetingFor(wallHour);
  const dateLabel = `${wall.weekday}, ${wall.month} ${wall.day}`;
  const marketLabel = computeMarketLabel(now);
  return { greeting: `${greeting}, ${NAME}`, dateLabel, marketLabel };
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
    dow: dowMap[weekdayStr] ?? 0,
  };
}

/**
 * Market clock subtitle. Doesn't honor holiday calendar — that's a v1.1
 * upgrade. For now: weekend → "NYSE closed · opens Mon 8:30 AM CT";
 * pre-open / post-close → "opens ... CT" / "closed · reopens ... CT";
 * regular session → "NYSE open · {hh}m to close" or "{h}h {m}m to close".
 *
 * Times in subtitle expressed in Terry's wall-clock TZ (Chicago) to match
 * the dateLabel and to be more readable than ET for a US user not in NY.
 */
function computeMarketLabel(now: Date): string {
  const mkt = partsFor(now, MARKET_TZ);
  const mktHour = parseInt(mkt.hour, 10);
  const mktMin = parseInt(mkt.minute, 10);
  const minutesIntoDay = mktHour * 60 + mktMin;
  const OPEN = 9 * 60 + 30;   // 09:30 ET
  const CLOSE = 16 * 60;      // 16:00 ET

  // Weekend
  if (mkt.dow === 0 || mkt.dow === 6) {
    return "NYSE closed · weekend";
  }
  // Pre-open weekday
  if (minutesIntoDay < OPEN) {
    const mins = OPEN - minutesIntoDay;
    return `NYSE closed · opens in ${humanDuration(mins)}`;
  }
  // Regular session
  if (minutesIntoDay < CLOSE) {
    const mins = CLOSE - minutesIntoDay;
    return `NYSE open · ${humanDuration(mins)} to close`;
  }
  // Post-close weekday
  return "NYSE closed · reopens tomorrow 8:30 AM CT";
}

function humanDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
