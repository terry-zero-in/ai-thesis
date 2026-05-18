"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { I } from "@/components/primitives/icons";
import { pathToCrumb } from "@/lib/screens";
import { useCtxPanel } from "@/hooks/ctx-panel-context";
import { Tip } from "./Tip";
import { DemoBadge } from "./DemoBadge";

export function TopBar({
  onCmd,
  onHelp,
  right,
  userEmail,
}: {
  onCmd: () => void;
  onHelp: () => void;
  right?: ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [root, crumb] = pathToCrumb(pathname);
  const { open: panelOpen, setOpen: setPanelOpen } = useCtxPanel();
  return (
    <header
      style={{
        height: 46,
        display: "flex",
        alignItems: "center",
        padding: "0 8px 0 20px",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)" }}>
        <span style={{ display: "flex", color: "var(--text-3)" }}>{I.eye}</span>
        <span style={{ color: crumb ? "var(--text-3)" : "var(--text-1)", fontWeight: crumb ? 400 : 500 }}>{root}</span>
        {crumb && (
          <>
            <span style={{ color: "var(--text-3)", fontSize: 11 }}>/</span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{crumb}</span>
          </>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <DemoBadge isDemo={!userEmail} />
      {right}
      <Tip label="Open command palette" keys={["⌘", "K"]}>
        <TBBtn onClick={onCmd}>
          {I.search}
          <span>Search</span>
        </TBBtn>
      </Tip>
      <Tip label="Keyboard shortcuts" keys={["?"]}>
        <TBBtn onClick={onHelp}>{I.help}</TBBtn>
      </Tip>
      <Tip label={panelOpen ? "Close context panel" : "Open context panel"} keys={["⌘", "\\"]}>
        <TBBtn onClick={() => setPanelOpen(!panelOpen)}>{I.panel}</TBBtn>
      </Tip>
      {userEmail && <UserChip email={userEmail} />}
    </header>
  );
}

function UserChip({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? "?";
  return (
    <Tip label={`Sign out ${email}`} keys={[]}>
      <a
        href="/logout"
        title={email}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginLeft: 4,
          padding: "3px 8px 3px 4px",
          borderRadius: 5,
          color: "var(--text-2)",
          border: "1px solid var(--border)",
          fontSize: 11.5,
          textDecoration: "none",
          fontFamily: "var(--m)",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {initial}
        </span>
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email}
        </span>
      </a>
    </Tip>
  );
}

export function TBBtn({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => {
        setH(false);
        setP(false);
      }}
      onMouseDown={() => setP(true)}
      onMouseUp={() => setP(false)}
      style={{
        padding: "5px 9px",
        borderRadius: 5,
        color: h ? "var(--text-1)" : "var(--text-3)",
        background: p ? "rgba(255,255,255,.08)" : h ? "rgba(255,255,255,.04)" : "transparent",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        transition: "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
