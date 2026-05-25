"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { savePosition } from "./actions";
import { POSITION_INITIAL, type PositionFormState } from "./action-types";
import type { HeldPositionPrefill, UniverseChoice } from "@/lib/portfolio-types";

/**
 * Add / edit a position.
 *
 * Two input modes:
 *   - Dollar amount: type $X, form computes shares = X / current_price,
 *                    cost_basis = current_price. Fractional shares (2-decimal)
 *                    match what Robinhood / Fidelity / Schwab accept.
 *   - Shares:        manual share count + per-share cost basis (original flow).
 *                    cost_basis auto-fills with current close when ticker is
 *                    selected AND opened_at is today; user can override for
 *                    backdated fills / limit orders.
 *
 * Edit behavior: when the user picks an already-held ticker, every field
 * pre-fills from the existing portfolio_positions row so they can adjust
 * any value rather than re-typing from memory. The action UPSERTs by ticker,
 * so "edit" is "save with the same ticker."
 */
export function AddPositionForm({
  choices,
  envConfigured,
  takenTickers,
  heldPrefill,
  initialTicker,
  onSuccess,
}: {
  choices: UniverseChoice[];
  envConfigured: boolean;
  takenTickers: string[];
  heldPrefill: HeldPositionPrefill[];
  initialTicker: string | null;
  /**
   * Called once after a save action succeeds (state.ok === true).
   * Delayed ~1.2s so the success message is visible before dismissal.
   * Used by PortfolioAddDrawer to self-close after a successful submit.
   */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<PositionFormState, FormData>(savePosition, POSITION_INITIAL);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const choiceMap = useMemo(
    () => new Map(choices.map((c) => [c.ticker, c])),
    [choices],
  );
  const heldMap = useMemo(
    () => new Map(heldPrefill.map((h) => [h.ticker, h])),
    [heldPrefill],
  );
  const taken = useMemo(() => new Set(takenTickers), [takenTickers]);

  const [ticker, setTicker] = useState<string>(initialTicker && choiceMap.has(initialTicker) ? initialTicker : "");
  const [mode, setMode] = useState<"dollar" | "shares">("shares");
  const [shares, setShares] = useState<string>("");
  const [costBasis, setCostBasis] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [openedAt, setOpenedAt] = useState<string>(today);
  const [notes, setNotes] = useState<string>("");
  const [costBasisOverridden, setCostBasisOverridden] = useState(false);

  const selected = ticker ? choiceMap.get(ticker) ?? null : null;
  const held = ticker ? heldMap.get(ticker) ?? null : null;
  const isEdit = held != null;
  const formAnchorRef = useRef<HTMLFormElement | null>(null);

  // When the ticker changes, hydrate the form. Edit takes precedence over
  // current-market auto-fill; otherwise we prefill cost_basis with the latest
  // close (overrideable). Resetting costBasisOverridden each ticker change
  // means re-picking a ticker after an override starts fresh.
  useEffect(() => {
    // Hydrate form state from external ticker selection — legitimate
    // external→internal sync. The deps array gates the effect to only fire
    // when ticker / held / selected actually change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCostBasisOverridden(false);
    if (!ticker) return;
    if (held) {
      // Edit mode: full hydration from existing row.
      setMode("shares");
      setShares(String(held.shares));
      setCostBasis(held.cost_basis.toFixed(2));
      setAmount("");
      setOpenedAt(held.opened_at);
      setNotes(held.notes ?? "");
      return;
    }
    // Fresh add: prefill cost_basis with current close if available.
    if (selected?.latest_price != null) {
      setCostBasis(selected.latest_price.toFixed(2));
    } else {
      setCostBasis("");
    }
    setShares("");
    setAmount("");
    setNotes("");
    // Leave openedAt as-is so the user's manual date pick survives ticker swap.
  }, [ticker, held, selected]);

  // Scroll the form into view when invoked via ?edit=<ticker> from the table.
  useEffect(() => {
    if (initialTicker && formAnchorRef.current) {
      formAnchorRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [initialTicker]);

  // Fire `onSuccess` once per save-success transition (false → true). The
  // ref-gate prevents firing on re-renders where state stays truthy, and
  // resets when state.ok flips back to false (next submit cycle).
  // Delay 1200ms so the user sees the green success banner before the
  // drawer self-dismisses — feels intentional, not abrupt.
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

  // Derived: in dollar mode, what shares would this become at current price?
  const dollarPreview = useMemo(() => {
    if (mode !== "dollar") return null;
    const amt = Number(amount);
    const px = selected?.latest_price ?? null;
    if (!Number.isFinite(amt) || amt <= 0 || px == null || px <= 0) return null;
    const sh = Math.floor((amt / px) * 100) / 100; // truncate to 2 decimals (don't over-buy on rounding)
    return { shares: sh, price: px };
  }, [mode, amount, selected]);

  // The action expects shares + cost_basis. In Dollar mode we derive them
  // before submit via hidden fields; in Shares mode they're typed directly.
  const submitShares = mode === "dollar" ? dollarPreview?.shares ?? 0 : Number(shares);
  const submitCost = mode === "dollar" ? dollarPreview?.price ?? 0 : Number(costBasis);
  const submitDisabled =
    pending ||
    !envConfigured ||
    !ticker ||
    !Number.isFinite(submitShares) ||
    submitShares <= 0 ||
    !Number.isFinite(submitCost) ||
    submitCost <= 0;

  return (
    <form ref={formAnchorRef} id="add-position" action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Header>{isEdit ? `Edit ${ticker}` : "Add position"}</Header>

      <Field label="Ticker">
        <select
          name="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          required
          style={selectStyle()}
        >
          <option value="">Select…</option>
          {choices.map((c) => (
            <option key={c.ticker} value={c.ticker}>
              {c.ticker} — {c.name}
              {taken.has(c.ticker) ? " (held)" : ""}
            </option>
          ))}
        </select>
        {selected?.latest_price != null && (
          <CurrentPriceLine price={selected.latest_price} asOf={selected.latest_price_as_of} />
        )}
        {selected && selected.latest_price == null && (
          <span style={{ fontSize: 10.5, color: "var(--text-4)", fontFamily: "var(--m)" }}>
            no price ingested yet — enter cost basis manually
          </span>
        )}
      </Field>

      {!isEdit && (
        <ModeToggle mode={mode} setMode={setMode} disableDollar={selected?.latest_price == null} />
      )}

      {mode === "dollar" && !isEdit ? (
        <>
          <Field label="Amount">
            <DollarInput value={amount} onChange={setAmount} placeholder="e.g. 5000" />
          </Field>
          <DollarPreview preview={dollarPreview} />
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Shares">
            <input
              name="shares-display"
              type="number"
              step="0.01"
              min={0}
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="e.g. 25"
              required
              style={inputStyle()}
            />
          </Field>
          <Field label="Cost / share">
            <DollarInput
              value={costBasis}
              onChange={(v) => {
                setCostBasis(v);
                setCostBasisOverridden(true);
              }}
              placeholder="e.g. 142.30"
            />
            {!isEdit && selected?.latest_price != null && !costBasisOverridden && (
              <UseCurrentChip
                price={selected.latest_price}
                onClick={() => {
                  setCostBasis(selected.latest_price!.toFixed(2));
                  setCostBasisOverridden(false);
                }}
              />
            )}
            {!isEdit && selected?.latest_price != null && costBasisOverridden && (
              <span style={{ fontSize: 10, color: "var(--text-4)", fontFamily: "var(--m)" }}>
                manual override — current ${selected.latest_price.toFixed(2)}
              </span>
            )}
          </Field>
        </div>
      )}

      <Field label="Opened">
        <DateInput value={openedAt} onChange={setOpenedAt} />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Trade rationale, related decision, conviction note…"
          style={textareaStyle()}
        />
      </Field>

      {/* Hidden fields carry the canonical values the server action consumes
          regardless of input mode. We re-emit them so Dollar-mode derived
          values + edit-mode hydrated values both serialize correctly. */}
      <input type="hidden" name="shares" value={submitShares || ""} />
      <input type="hidden" name="cost_basis" value={submitCost ? submitCost.toFixed(2) : ""} />
      <input type="hidden" name="opened_at" value={openedAt} />

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
        {pending ? "Saving…" : isEdit ? "Update position" : "Add position"}
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
          Supabase env not configured — read-only. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
        </div>
      )}
    </form>
  );
}

/* ---------------- bits ---------------- */

function ModeToggle({
  mode,
  setMode,
  disableDollar,
}: {
  mode: "dollar" | "shares";
  setMode: (m: "dollar" | "shares") => void;
  disableDollar: boolean;
}) {
  const opts: { id: "dollar" | "shares"; label: string }[] = [
    { id: "dollar", label: "Dollar amount" },
    { id: "shares", label: "Shares" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, fontFamily: "var(--m)", color: "var(--text-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        Enter as
      </span>
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 2,
          background: "rgba(255,255,255,.02)",
          alignSelf: "flex-start",
        }}
      >
        {opts.map((o) => {
          const active = mode === o.id;
          const disabled = o.id === "dollar" && disableDollar;
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => !disabled && setMode(o.id)}
              title={disabled ? "Current price not available for this ticker — use Shares mode" : undefined}
              style={{
                padding: "4px 12px",
                fontSize: 11.5,
                fontFamily: "var(--f)",
                color: disabled ? "var(--text-4)" : active ? "var(--accent)" : "var(--text-2)",
                background: active ? "var(--accent-soft)" : "transparent",
                border: "none",
                borderRadius: 3,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                fontWeight: active ? 500 : 400,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
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
        style={{
          ...inputStyle(),
          paddingLeft: 20,
          width: "100%",
        }}
      />
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  // showPicker() is the Chrome/Edge/Safari path that opens the native
  // calendar dropdown on click of the chrome around the input (not just
  // the calendar glyph). Falls back to the browser default on Firefox.
  return (
    <input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

function UseCurrentChip({ price, onClick }: { price: number; onClick: () => void }) {
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
      use current ${price.toFixed(2)}
    </button>
  );
}

function CurrentPriceLine({ price, asOf }: { price: number; asOf: string | null }) {
  return (
    <span style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--m)" }}>
      Current ${price.toFixed(2)}
      {asOf && (
        <span style={{ color: "var(--text-4)" }}> · as of {asOf}</span>
      )}
    </span>
  );
}

function DollarPreview({ preview }: { preview: { shares: number; price: number } | null }) {
  if (!preview) {
    return (
      <span style={{ fontSize: 10.5, color: "var(--text-4)", fontFamily: "var(--m)" }}>
        enter an amount to preview shares
      </span>
    );
  }
  const total = preview.shares * preview.price;
  return (
    <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)", fontVariantNumeric: "tabular-nums" }}>
      ≈ {preview.shares.toFixed(2)} sh @ ${preview.price.toFixed(2)} = ${total.toFixed(2)}
    </span>
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
      <span style={{ fontSize: 10.5, fontFamily: "var(--m)", color: "var(--text-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
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

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    height: 30,
    fontFamily: "var(--m)",
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "var(--f)",
    color: "var(--text-1)",
    background: "rgba(255,255,255,.02)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
    resize: "vertical",
    minHeight: 40,
    lineHeight: 1.5,
  };
}
