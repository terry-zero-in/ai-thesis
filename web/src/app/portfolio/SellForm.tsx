"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { sellPosition } from "./actions";
import { POSITION_INITIAL, type PositionFormState } from "./action-types";
import type { SellablePositionPrefill } from "@/lib/portfolio-types";

/**
 * Sell shares of a held position (THS-103).
 *
 * Fields:
 *   - Ticker:        preset (read-only display) — must be opened via Sell
 *                    button on a specific row or ?sell=<TICKER> param
 *   - Shares to sell: defaults to remaining shares, max-clamped
 *   - Exit price:    per-share, prefilled with current_price when known
 *   - Exit date:     defaults to today, min = opened_at (retroactive entry)
 *
 * Submitting fires the `sellPosition` server action which atomically:
 *   - decrements shares
 *   - accumulates realized_pl + realized_proceeds
 *   - sets closed_at when shares reaches 0
 *   - refreshes /portfolio + /dashboard
 *
 * The preview line below the inputs shows derived realized P&L for THIS
 * sale (before submit) so the operator sees the dollar impact before
 * committing — same affordance the AddPositionForm Dollar-mode preview
 * provides for purchases.
 */
export function SellForm({
  position,
  envConfigured,
  onSuccess,
}: {
  position: SellablePositionPrefill;
  envConfigured: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<PositionFormState, FormData>(
    sellPosition,
    POSITION_INITIAL,
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [sharesToSell, setSharesToSell] = useState<string>(String(position.shares));
  const [exitPrice, setExitPrice] = useState<string>(
    position.current_price != null ? position.current_price.toFixed(2) : "",
  );
  const [exitDate, setExitDate] = useState<string>(today);

  // Successful-submit transition handling — same pattern as AddPositionForm
  // so the drawer self-dismisses ~1.2s after a green tick lands.
  const successAcknowledgedRef = useRef(false);
  useEffect(() => {
    if (!onSuccess) return;
    if (state.ok && !successAcknowledgedRef.current) {
      successAcknowledgedRef.current = true;
      const t = window.setTimeout(() => onSuccess(), 1200);
      return () => window.clearTimeout(t);
    }
    if (!state.ok) {
      successAcknowledgedRef.current = false;
    }
  }, [state.ok, onSuccess]);

  const sharesNum = Number(sharesToSell);
  const priceNum = Number(exitPrice);
  const sharesValid = Number.isFinite(sharesNum) && sharesNum > 0 && sharesNum <= position.shares;
  const priceValid = Number.isFinite(priceNum) && priceNum > 0;
  const dateValid = exitDate >= position.opened_at;

  const preview = useMemo(() => {
    if (!sharesValid || !priceValid) return null;
    const pl = (priceNum - position.cost_basis) * sharesNum;
    const proceeds = priceNum * sharesNum;
    const pct = position.cost_basis > 0 ? (priceNum - position.cost_basis) / position.cost_basis : 0;
    const remaining = position.shares - sharesNum;
    return { pl, proceeds, pct, remaining, fullClose: remaining < 1e-6 };
  }, [sharesValid, priceValid, priceNum, sharesNum, position]);

  const submitDisabled = pending || !envConfigured || !sharesValid || !priceValid || !dateValid;

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Header>Sell {position.ticker}</Header>

      <div style={{ fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--m)", marginTop: -4 }}>
        {position.name} ·{" "}
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
          {position.shares} shares
        </span>{" "}
        @ cost{" "}
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
          ${position.cost_basis.toFixed(2)}
        </span>
        {position.current_price != null && (
          <>
            {" · mark "}
            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
              ${position.current_price.toFixed(2)}
            </span>
            {position.current_price_as_of && (
              <span style={{ color: "var(--text-4)" }}> ({position.current_price_as_of})</span>
            )}
          </>
        )}
      </div>

      <input type="hidden" name="ticker" value={position.ticker} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Shares to sell">
          <input
            name="shares_to_sell"
            type="number"
            step="0.01"
            min={0.01}
            max={position.shares}
            value={sharesToSell}
            onChange={(e) => setSharesToSell(e.target.value)}
            required
            style={inputStyle()}
          />
          <SellAllChip
            shares={position.shares}
            isMax={Math.abs(sharesNum - position.shares) < 1e-6}
            onClick={() => setSharesToSell(String(position.shares))}
          />
        </Field>
        <Field label="Exit price / share">
          <DollarInput
            value={exitPrice}
            onChange={setExitPrice}
            placeholder="e.g. 142.30"
          />
          {position.current_price != null && Number(exitPrice).toFixed(2) !== position.current_price.toFixed(2) && (
            <UseMarkChip
              price={position.current_price}
              onClick={() => setExitPrice(position.current_price!.toFixed(2))}
            />
          )}
        </Field>
      </div>

      <Field label="Exit date">
        <DateInput value={exitDate} onChange={setExitDate} min={position.opened_at} />
        {!dateValid && (
          <span style={{ fontSize: 10.5, color: "var(--danger)", fontFamily: "var(--m)" }}>
            cannot be before opened ({position.opened_at})
          </span>
        )}
        {dateValid && exitDate !== today && (
          <span style={{ fontSize: 10.5, color: "var(--text-4)", fontFamily: "var(--m)" }}>
            retroactive — recorded as {exitDate}
          </span>
        )}
      </Field>

      <Preview preview={preview} />

      <input type="hidden" name="exit_price" value={exitPrice} />
      <input type="hidden" name="exit_date" value={exitDate} />

      <button
        type="submit"
        disabled={submitDisabled}
        style={{
          height: 32,
          padding: "0 18px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-1)",
          background: pending ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--accent)",
          border: "none",
          borderRadius: 4,
          cursor: submitDisabled ? (pending ? "wait" : "not-allowed") : "pointer",
          opacity: !envConfigured ? 0.5 : 1,
          transition: "background var(--dur-instant) var(--ease-out)",
          alignSelf: "flex-start",
          letterSpacing: ".02em",
        }}
      >
        {pending
          ? "Selling…"
          : preview?.fullClose
            ? `Sell all ${position.shares} & close`
            : `Sell ${sharesNum || ""} shares`}
      </button>

      {state.message && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: state.ok ? "var(--success)" : "var(--danger)",
            background: state.ok ? "rgba(52,211,153,.06)" : "rgba(251,113,133,.06)",
            border: `1px solid ${state.ok ? "rgba(52,211,153,.25)" : "rgba(251,113,133,.25)"}`,
          }}
        >
          {state.message}
        </div>
      )}

      {!envConfigured && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--text-3)",
            background: "rgba(255,255,255,.02)",
            border: "1px dashed var(--border)",
          }}
        >
          Supabase env not configured — sells disabled.
        </div>
      )}
    </form>
  );
}

/* ---------------- bits ---------------- */

function Preview({
  preview,
}: {
  preview: { pl: number; proceeds: number; pct: number; remaining: number; fullClose: boolean } | null;
}) {
  if (!preview) {
    return (
      <span style={{ fontSize: 10.5, color: "var(--text-4)", fontFamily: "var(--m)" }}>
        fill in shares + price to preview realized P&L
      </span>
    );
  }
  const plPos = preview.pl >= 0;
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "rgba(255,255,255,.02)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
        fontSize: 11.5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-3)" }}>
        <span style={{ textTransform: "uppercase", letterSpacing: ".06em", fontSize: 10 }}>
          Realized this sale
        </span>
        <span style={{ color: plPos ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
          {plPos ? "+" : "−"}${Math.abs(preview.pl).toFixed(2)} ({plPos ? "+" : ""}
          {(preview.pct * 100).toFixed(2)}%)
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-3)" }}>
        <span>Gross proceeds</span>
        <span style={{ color: "var(--text-2)" }}>${preview.proceeds.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-3)" }}>
        <span>After sale</span>
        <span style={{ color: preview.fullClose ? "var(--warning)" : "var(--text-2)" }}>
          {preview.fullClose ? "fully closed" : `${preview.remaining} shares remaining`}
        </span>
      </div>
    </div>
  );
}

function SellAllChip({
  shares,
  isMax,
  onClick,
}: {
  shares: number;
  isMax: boolean;
  onClick: () => void;
}) {
  if (isMax) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignSelf: "flex-start",
        fontSize: 10,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 3,
        padding: "1px 6px",
        cursor: "pointer",
        letterSpacing: ".02em",
      }}
    >
      sell all {shares}
    </button>
  );
}

function UseMarkChip({ price, onClick }: { price: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignSelf: "flex-start",
        fontSize: 10,
        fontFamily: "var(--m)",
        color: "var(--text-3)",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 3,
        padding: "1px 6px",
        cursor: "pointer",
        letterSpacing: ".02em",
      }}
    >
      use mark ${price.toFixed(2)}
    </button>
  );
}

function DollarInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 8,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 12.5,
          color: "var(--text-3)",
          fontFamily: "var(--m)",
          pointerEvents: "none",
        }}
      >
        $
      </span>
      <input
        type="number"
        step="0.01"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          ...inputStyle(),
          paddingLeft: 20,
          width: "100%",
        }}
      />
    </div>
  );
}

function DateInput({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      onClick={() => {
        try {
          ref.current?.showPicker?.();
        } catch {
          /* showPicker not supported — native focus picker still fires */
        }
      }}
      style={{ ...inputStyle(), width: "100%", cursor: "pointer" }}
    />
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    height: 28,
    padding: "0 8px",
    fontSize: 12.5,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
  };
}
