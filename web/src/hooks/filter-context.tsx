"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Shell-level filter state for the Reviews queue. Lifted out of
 * /reviews/page.tsx so the actual filter input can render in TopBar
 * (canonical placement per stage3-app.jsx), with the Reviews page
 * consuming the value.
 *
 * The page header keeps its "Filter" button as a chip that focuses
 * the TopBar input on click — visual + interaction match canonical.
 */
interface FilterCtx {
  q: string;
  setQ: (q: string) => void;
  focusInput: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
}

const FilterContext = createContext<FilterCtx>({
  q: "",
  setQ: () => {},
  focusInput: () => {},
  registerInput: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const registerInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
  }, []);
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }, []);

  const value = useMemo<FilterCtx>(
    () => ({ q, setQ, registerInput, focusInput }),
    [q, registerInput, focusInput],
  );
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  return useContext(FilterContext);
}
