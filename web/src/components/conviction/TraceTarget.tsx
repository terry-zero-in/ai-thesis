"use client";

import { useCallback, type ReactNode } from "react";
import { useTrace, type TraceData } from "./TraceProvider";

/**
 * TraceTarget — wraps an element (typically a score number) and arms the
 * "press T to trace this" shortcut on hover or keyboard focus. The wrapper
 * itself is layout-neutral (inline-block by default) and adds a
 * cursor:help affordance so the hidden shortcut is at least discoverable
 * to anyone who hovers.
 *
 * Usage:
 *
 *   <TraceTarget data={traceForNvdaComposite}>
 *     <span className="score">83.7</span>
 *   </TraceTarget>
 *
 * Wiring real scores on Universe Detail / AIQ Editor / Decisions is a
 * separate Wave 2 task — this component only provides the arming API.
 */

export interface TraceTargetProps {
  data: TraceData;
  children: ReactNode;
  /**
   * Render as inline-block (default) or as a block-level wrapper. Inline
   * is the right default for wrapping a score number that sits next to
   * other text; block is useful when the target is a card or row.
   */
  inline?: boolean;
}

export function TraceTarget({ data, children, inline = true }: TraceTargetProps) {
  const { setTarget } = useTrace();

  const arm = useCallback(() => setTarget(data), [data, setTarget]);
  const disarm = useCallback(() => setTarget(null), [setTarget]);

  const style: React.CSSProperties = {
    display: inline ? "inline-block" : "block",
    cursor: "help",
  };

  return (
    <span
      role="presentation"
      style={style}
      onMouseEnter={arm}
      onMouseLeave={disarm}
      onFocusCapture={arm}
      onBlurCapture={disarm}
    >
      {children}
    </span>
  );
}
