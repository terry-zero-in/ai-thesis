"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Phase 4 — shell-level keyboard system.
 *
 * Owns the chrome-wide keybinds + the G-prefix navigation state machine.
 * Page-level keybinds (J/K focus, action keys on focused row, filter focus,
 * modal openers tied to focusedId) live inline in the relevant page files
 * because they read page-owned state that isn't on the Shell.
 *
 * Conventions:
 * - cmd+* chords skip the text-input guard (per memory
 *   `feedback_meta_modifier_input_guard_bypass`).
 * - Bare keys (`?`, `g`) honor the guard.
 * - G-prefix: pressing `g` enters Go-To mode for 1500ms; a follow-up key
 *   routes via Next router. Any other key cancels.
 * - ⌘L is shell-level and routes to the Live Stream — page-level listeners
 *   on /reviews can preempt by responding to a `reticle:stream` window event
 *   first (the hook fires the event before falling back to a default push).
 *
 * Shell-level binds wired here:
 *   ⌘K   toggle command palette
 *   ⌘\   toggle context panel
 *   ⌘B   toggle sidebar collapse
 *   Esc  close any open chrome overlay + clear page focus via event
 *   ?    toggle keyboard shortcuts overlay
 *   G,D  go to /            (Dashboard)
 *   G,U  go to /universe
 *   G,P  go to /portfolio
 *   G,R  go to /regime
 *   G,A  go to /aiq
 *   G,M  go to /memos
 *   G,X  go to /decisions
 */

export interface ShellKeyboardHandlers {
  setCmd: (updater: (v: boolean) => boolean) => void;
  setShortcuts: (updater: (v: boolean) => boolean) => void;
  setPanel: (updater: (v: boolean) => boolean) => void;
  setCol: (updater: (v: boolean) => boolean) => void;
  closeChromeOverlays: () => void;
}

export function useShellKeyboard(handlers: ShellKeyboardHandlers): { gMode: boolean } {
  const router = useRouter();
  const [gMode, setGMode] = useState(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startG = useCallback(() => {
    setGMode(true);
    if (gTimer.current) clearTimeout(gTimer.current);
    gTimer.current = setTimeout(() => setGMode(false), 1500);
  }, []);
  const endG = useCallback(() => {
    setGMode(false);
    if (gTimer.current) clearTimeout(gTimer.current);
  }, []);

  // Use a ref so the keydown closure always sees the latest handlers/gMode
  // without re-binding the window listener on every consumer-state change.
  const refs = useRef({ handlers, gMode, startG, endG, router });
  useEffect(() => {
    refs.current = { handlers, gMode, startG, endG, router };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as HTMLElement & { isContentEditable?: boolean }).isContentEditable === true);

      const { handlers: h, gMode: g, startG: sG, endG: eG, router: r } = refs.current;

      // ── ALWAYS-AVAILABLE (work even from inputs) ──
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        h.setCmd((v) => !v);
        return;
      }
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        h.setCol((v) => !v);
        return;
      }
      if (e.metaKey && e.key === "\\") {
        e.preventDefault();
        h.setPanel((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        h.closeChromeOverlays();
        if (g) eG();
        // Pages can listen for this to clear focusedId / sel / etc.
        window.dispatchEvent(new CustomEvent("aithesis:esc"));
        return;
      }

      // Bare keys are guarded against text-input focus.
      if (inField) return;
      // Modifier-bare combinations beyond the above shell binds get ignored here
      // (e.g. ⌘E / ⌘↵ are page-level; they fire from /reviews's own listener).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ? — toggle shortcuts overlay
      if (e.key === "?") {
        e.preventDefault();
        h.setShortcuts((v) => !v);
        return;
      }

      // G-prefix: enter mode on first press, route on follow-up
      if (!g && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        sG();
        return;
      }
      if (g) {
        const map: Record<string, string> = {
          d: "/",
          u: "/universe",
          p: "/portfolio",
          r: "/regime",
          a: "/aiq",
          m: "/memos",
          x: "/decisions",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          r.push(dest);
          eG();
          return;
        }
        if (e.key !== "g" && e.key !== "G") {
          eG();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { gMode };
}
