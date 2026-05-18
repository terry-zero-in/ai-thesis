"use client";

import { PageCreateDrawer } from "@/components/primitives/PageCreateDrawer";
import { AddPositionForm } from "./AddPositionForm";
import type { HeldPositionPrefill, UniverseChoice } from "@/lib/portfolio-types";

/**
 * Thin client wrapper composing the generic PageCreateDrawer primitive with
 * the Portfolio AddPositionForm.
 *
 * Lives as its own file (vs. inlined in page.tsx) because page.tsx is a
 * Server Component and render-prop functions cannot cross the
 * server/client boundary — the primitive's `children: (api) => ReactNode`
 * shape requires its caller to be a Client Component.
 *
 * `defaultOpen` is wired to the `?edit=<TICKER>` query-param path: when the
 * user clicks "edit" on a position row, the drawer auto-opens with the
 * ticker hydrated. close() is passed to the form so a successful save
 * dismisses the drawer (with a brief delay so the user sees the green
 * success tick).
 */
export function PortfolioAddDrawer({
  choices,
  envConfigured,
  takenTickers,
  heldPrefill,
  initialTicker,
}: {
  choices: UniverseChoice[];
  envConfigured: boolean;
  takenTickers: string[];
  heldPrefill: HeldPositionPrefill[];
  initialTicker: string | null;
}) {
  const isEdit = !!initialTicker;
  return (
    <PageCreateDrawer
      label={isEdit ? `Edit ${initialTicker}` : "+ Add position"}
      shortcutKey="n"
      defaultOpen={isEdit}
      width={460}
    >
      {({ close }) => (
        <AddPositionForm
          choices={choices}
          envConfigured={envConfigured}
          takenTickers={takenTickers}
          heldPrefill={heldPrefill}
          initialTicker={initialTicker}
          onSuccess={close}
        />
      )}
    </PageCreateDrawer>
  );
}
