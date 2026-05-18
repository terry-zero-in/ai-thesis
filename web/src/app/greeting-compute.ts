/**
 * Server-safe greeting computer. Pure function; no "use client" directive
 * so server components can import it for initial-paint values.
 * GreetingStrip (client) imports the same function for the 60s tick.
 *
 * America/Chicago per spec §5.1 mock ("23:24 CT").
 */
const TZ = "America/Chicago";

export function computeGreeting(): { greeting: string; dateLabel: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10);
  const greeting =
    hour >= 5 && hour < 12 ? "Good morning"
    : hour >= 12 && hour < 17 ? "Good afternoon"
    : "Good evening";
  const dateLabel = `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`;
  return { greeting, dateLabel };
}
