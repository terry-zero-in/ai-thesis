"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CtxPanel } from "./CtxPanel";
import { CmdPalette } from "./CmdPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { GoToPill } from "./GoToPill";
import { FooterDisclosure } from "./FooterDisclosure";
import { useShellKeyboard } from "@/hooks/useShellKeyboard";
import { FilterProvider } from "@/hooks/filter-context";
import { CtxPanelProvider, useCtxPanel } from "@/hooks/ctx-panel-context";
import { UniverseFilterProvider } from "@/hooks/universe-filter-context";
import { ShellControlsProvider } from "@/hooks/shell-controls-context";

/**
 * Shell — top-level client component wrapping every page.
 *
 * Ported from Reticle's `Shell.tsx`. Reticle-domain providers
 * (RoutineSelectionProvider, DelegationsSelectionProvider) were stripped
 * because their consumers (delegations / routines pages, rails) don't exist
 * in this app. FilterProvider stays — it's a generic query state lifted
 * into TopBar that individual pages will opt into (THS-52 wires it into
 * the Universe table).
 */
export function Shell({
  children,
  userEmail,
  unseenAlerts = 0,
}: {
  children: ReactNode;
  userEmail?: string | null;
  unseenAlerts?: number;
}) {
  return (
    <FilterProvider>
      <CtxPanelProvider>
        <UniverseFilterProvider>
          <ShellInner userEmail={userEmail ?? null} unseenAlerts={unseenAlerts}>
            {children}
          </ShellInner>
        </UniverseFilterProvider>
      </CtxPanelProvider>
    </FilterProvider>
  );
}

function ShellInner({
  children,
  userEmail,
  unseenAlerts,
}: {
  children: ReactNode;
  userEmail: string | null;
  unseenAlerts: number;
}) {
  const [col, setCol] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const { open: panel, setOpen: setPanelOpen, rail } = useCtxPanel();

  const closeChromeOverlays = useCallback(() => {
    setCmd(false);
    setShortcuts(false);
  }, []);

  const setPanel = useCallback(
    (updater: (v: boolean) => boolean) => {
      setPanelOpen(updater(panel));
    },
    [panel, setPanelOpen],
  );

  const { gMode } = useShellKeyboard({
    setCmd,
    setShortcuts,
    setPanel,
    setCol,
    closeChromeOverlays,
  });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar col={col} setCol={setCol} unseenAlerts={unseenAlerts} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <TopBar
          onCmd={() => setCmd(true)}
          onHelp={() => setShortcuts(true)}
          userEmail={userEmail}
        />
        <ShellControlsProvider openCmd={() => setCmd(true)} openShortcuts={() => setShortcuts(true)}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
              animation: "fadeUp 220ms 8ms var(--ease-out) both",
              willChange: "transform,opacity",
            }}
          >
            {children}
          </div>
        </ShellControlsProvider>
        <FooterDisclosure />
      </div>
      {panel && rail !== "none" && <CtxPanel />}

      <CmdPalette open={cmd} onClose={() => setCmd(false)} />
      <ShortcutsOverlay open={shortcuts} onClose={() => setShortcuts(false)} />
      <GoToPill active={gMode} />
    </div>
  );
}
