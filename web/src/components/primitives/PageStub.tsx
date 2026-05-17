/**
 * Minimal route placeholder used by THS-51's app shell.
 *
 * Each AI Thesis route renders a stub that proves the chrome boots and the
 * route mounts. Real canvas content lands per ticket: THS-52 universe table,
 * THS-53 name detail, THS-54 AIQ editor, THS-55 portfolio, THS-56 regime,
 * etc. Replace the stub with the page's real shell as each ships.
 */
export function PageStub({
  title,
  intent,
  bullets,
}: {
  title: string;
  intent: string;
  bullets: string[];
}) {
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "32px 28px",
        animation: "fadeUp var(--dur-base) var(--ease-out) both",
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--m)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Stub · THS-51 chrome
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-.014em",
            color: "var(--text-1)",
            marginBottom: 10,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          {intent}
        </p>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--m)",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Wires up
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                color: "var(--text-2)",
                padding: "8px 0",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                gap: 10,
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: "var(--accent)",
                  flexShrink: 0,
                  display: "inline-block",
                  marginTop: 6,
                }}
              />
              <span style={{ flex: 1 }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
