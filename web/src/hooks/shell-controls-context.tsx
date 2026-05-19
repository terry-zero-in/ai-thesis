"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Lightweight Shell-controls context — exposes imperative handles to chrome
 * overlays (CmdPalette, ShortcutsOverlay) so canvas-level components can
 * trigger them without prop-drilling or synthetic keyboard events.
 *
 * Use case: NameHeader's "switch name" chip needs to open the cmd palette
 * when clicked. Without this, the chip would have to dispatch a synthetic
 * ⌘K KeyboardEvent at window — hacky and brittle. With this, it calls
 * `openCmd()` directly.
 */
interface ShellControls {
  openCmd: () => void;
  openShortcuts: () => void;
}

const Ctx = createContext<ShellControls>({
  openCmd: () => {},
  openShortcuts: () => {},
});

export function ShellControlsProvider({
  openCmd,
  openShortcuts,
  children,
}: {
  openCmd: () => void;
  openShortcuts: () => void;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ openCmd, openShortcuts }}>{children}</Ctx.Provider>;
}

export function useShellControls() {
  return useContext(Ctx);
}
