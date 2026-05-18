import Link from "next/link";
import { getMemosSnapshot, type MemoKind } from "@/lib/memos-data";
import { MemoCard } from "./MemoCard";
import { NoRail } from "@/components/shell/NoRail";

/**
 * Revalidate hourly. Daily memo lands at 13:00 UTC; weekly memo at
 * Sunday evening. 1-hour ISR keeps the page fresh without forcing a
 * hard refresh.
 *
 * Filter + search state lives in URL searchParams so it's bookmarkable
 * and survives reload — same pattern as /decisions ?kind=. (Review §2.9 #3)
 */
export const revalidate = 3600;

const KIND_TABS: { key: MemoKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

function isKind(v: string | undefined): v is MemoKind {
  return v === "daily" || v === "weekly";
}

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const snap = await getMemosSnapshot();
  const params = await searchParams;
  const activeKind: MemoKind | null = isKind(params.kind) ? params.kind : null;
  const query = (params.q ?? "").trim().toLowerCase();

  const filtered = snap.rows.filter((m) => {
    if (activeKind && m.kind !== activeKind) return false;
    if (query) {
      const hay = `${m.headline} ${m.body}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // Inventory counts BEFORE filtering so the tab numbers don't shrink
  // as the user types — operator wants "how many of each kind exist."
  const totalsByKind: Record<string, number> = { all: snap.rows.length };
  for (const m of snap.rows) totalsByKind[m.kind] = (totalsByKind[m.kind] ?? 0) + 1;

  function tabHref(k: MemoKind | "all"): string {
    const next = new URLSearchParams();
    if (k !== "all") next.set("kind", k);
    if (query) next.set("q", query);
    const s = next.toString();
    return s ? `/memos?${s}` : "/memos";
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <header
        style={{
          padding: "18px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-.014em",
            color: "var(--text-1)",
            fontFamily: "var(--m)",
          }}
        >
          Memos
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Daily 8am CT · Weekly Sun PM · {snap.rows.length} most recent
        </span>
      </header>

      {/* Filter bar — spec §4.5 chips (passive metadata + filter affordance) */}
      <div
        style={{
          padding: "10px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "inline-flex", gap: 6 }}>
          {KIND_TABS.map((t) => {
            const active = (t.key === "all" && activeKind == null) || activeKind === t.key;
            const n = totalsByKind[t.key] ?? 0;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--m)",
                  color: active ? "var(--accent)" : "var(--text-2)",
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                  border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  padding: "2px 8px",
                  borderRadius: 3,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <span>{t.label}</span>
                <span style={{ color: active ? "var(--accent)" : "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{n}</span>
              </Link>
            );
          })}
        </div>
        <form action="/memos" method="GET" style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
          {activeKind && <input type="hidden" name="kind" value={activeKind} />}
          <input
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search memos…"
            style={{
              width: 220,
              height: 26,
              padding: "0 10px",
              fontSize: 12,
              fontFamily: "var(--f)",
              color: "var(--text-1)",
              background: "rgba(255,255,255,.02)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              outline: "none",
            }}
          />
          {query && (
            <Link
              href={activeKind ? `/memos?kind=${activeKind}` : "/memos"}
              style={{
                fontSize: 11,
                fontFamily: "var(--m)",
                color: "var(--text-3)",
                textDecoration: "none",
                padding: "2px 8px",
                border: "1px solid var(--border)",
                borderRadius: 3,
                letterSpacing: ".05em",
                textTransform: "uppercase",
              }}
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {snap.rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", paddingTop: 24 }}>
            No memos yet. The daily cron fires Mon-Fri at 13:00 UTC.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", paddingTop: 24 }}>
            No memos match{activeKind ? ` "${activeKind}"` : ""}
            {query ? ` · search "${params.q}"` : ""}.{" "}
            <Link href="/memos" style={{ color: "var(--accent)" }}>
              Clear filters
            </Link>
            .
          </div>
        ) : (
          filtered.map((m) => <MemoCard key={m.id} memo={m} />)
        )}
      </div>
    </div>
  );
}
