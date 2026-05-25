"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageCreateDrawer } from "@/components/primitives/PageCreateDrawer";
import { SellForm } from "./SellForm";
import type { SellablePositionPrefill } from "@/lib/portfolio-types";

/**
 * SellDrawer — anchored to the page header when ?sell=<TICKER> is set
 * (THS-103). The per-row "sell" button on PositionsTable navigates to
 * ?sell=<TICKER> which causes this drawer to mount with defaultOpen.
 *
 * Closing the drawer (or successful submit) clears the ?sell param so the
 * pill disappears from the header — page returns to its idle Add-position
 * state. Without the URL cleanup, navigating back to /portfolio would
 * silently re-pop the drawer on the next render.
 *
 * Renders NOTHING when `position` is null — the pill should only ever
 * surface in the context of a specific held name to avoid the confusing
 * "Sell what?" state of a contextless pill.
 */
export function SellDrawer({
  position,
  envConfigured,
}: {
  position: SellablePositionPrefill | null;
  envConfigured: boolean;
}) {
  const router = useRouter();

  const clearSellParam = useCallback(() => {
    router.replace("/portfolio");
  }, [router]);

  if (!position) return null;

  return (
    <PageCreateDrawer
      label={`Sell ${position.ticker}`}
      defaultOpen
      width={460}
    >
      {({ close }) => (
        <SellForm
          position={position}
          envConfigured={envConfigured}
          onSuccess={() => {
            close();
            clearSellParam();
          }}
        />
      )}
    </PageCreateDrawer>
  );
}
