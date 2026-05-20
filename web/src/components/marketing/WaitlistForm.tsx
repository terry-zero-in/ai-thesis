"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist, type WaitlistResult } from "./waitlist-action";

/**
 * Inline waitlist email-capture form. Renders the primary Voltage CTA
 * (the only one on the page per /lambo "one Voltage CTA per page" rule).
 *
 * State machine:
 *   idle  → email input + "Notify me" CTA + secondary methodology link
 *   submitting → CTA shows spinner glyph, input disabled
 *   success → thank-you state replaces the input row, mono confirmation
 *   error → red microcopy under input, input remains editable
 */
export function WaitlistForm() {
  const [state, action] = useActionState<WaitlistResult | null, FormData>(
    joinWaitlist,
    null
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 480,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            border: "1px solid var(--success)",
            borderRadius: 6,
            background: "rgba(48,209,88,.08)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--success)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--f)",
              fontSize: 14,
              color: "var(--text-1)",
              lineHeight: 1.4,
            }}
          >
            You&apos;re on the list.
          </span>
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 12,
              color: "var(--text-3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {state.email}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--text-3)",
            letterSpacing: ".02em",
          }}
        >
          We&apos;ll email you when the paid beta opens. No marketing list.
        </span>
      </div>
    );
  }

  return (
    <form
      action={action}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 480,
      }}
      noValidate
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 6,
        }}
      >
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-label="Email"
          placeholder="you@firm.com"
          style={{
            height: 44,
            padding: "0 14px",
            fontSize: 14,
            fontFamily: "var(--f)",
            color: "var(--text-1)",
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            outline: "none",
            minWidth: 0,
          }}
        />
        <SubmitButton />
      </div>
      {state && !state.ok && (
        <span
          role="alert"
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--danger)",
            letterSpacing: ".02em",
          }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      style={{
        height: 44,
        padding: "0 22px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "var(--m)",
        letterSpacing: ".01em",
        color: "var(--voltage-ink)",
        background: pending ? "var(--voltage-lo)" : "var(--voltage)",
        border: "none",
        borderRadius: 6,
        cursor: pending ? "wait" : "pointer",
        transition: "background var(--dur-instant) var(--ease-out)",
      }}
      onMouseEnter={(e) => {
        if (!pending) e.currentTarget.style.background = "var(--voltage-hi)";
      }}
      onMouseLeave={(e) => {
        if (!pending) e.currentTarget.style.background = "var(--voltage)";
      }}
    >
      {pending ? "Saving…" : "Notify me"}
    </button>
  );
}
