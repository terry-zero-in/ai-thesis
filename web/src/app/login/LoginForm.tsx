"use client";

import { useActionState } from "react";
import { sendMagicLink } from "./actions";

interface State {
  ok: boolean;
  message: string;
}

const INITIAL: State = { ok: false, message: "" };

export function LoginForm({ next, envConfigured }: { next: string; envConfigured: boolean }) {
  const [state, formAction, pending] = useActionState<State, FormData>(sendMagicLink, INITIAL);
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@example.com"
        disabled={pending || !envConfigured}
        style={{
          height: 36,
          padding: "0 12px",
          fontSize: 13,
          color: "var(--text-1)",
          background: "rgba(255,255,255,.03)",
          border: "1px solid var(--border)",
          borderRadius: 5,
          fontFamily: "var(--f)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={pending || !envConfigured}
        style={{
          height: 36,
          padding: "0 14px",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--canvas)",
          background: pending ? "color-mix(in oklab, var(--accent) 60%, transparent)" : "var(--accent)",
          border: "none",
          borderRadius: 5,
          cursor: pending ? "wait" : "pointer",
          opacity: !envConfigured ? 0.5 : 1,
          transition: "background var(--dur-instant) var(--ease-out)",
        }}
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {state.message && (
        <div
          style={{
            marginTop: 4,
            padding: "8px 10px",
            borderRadius: 5,
            fontSize: 12,
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
            marginTop: 4,
            padding: "8px 10px",
            borderRadius: 5,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--text-3)",
            background: "rgba(255,255,255,.02)",
            border: "1px dashed var(--border)",
          }}
        >
          Supabase env not configured. Set <code style={{ fontFamily: "var(--m)" }}>NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
          <code style={{ fontFamily: "var(--m)" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code style={{ fontFamily: "var(--m)" }}>.env.local</code>; the app renders against fixtures without auth.
        </div>
      )}
    </form>
  );
}
