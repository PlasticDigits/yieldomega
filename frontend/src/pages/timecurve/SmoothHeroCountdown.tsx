// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useLayoutEffect, useRef } from "react";
import { formatCountdown } from "@/pages/timecurve/formatTimer";

export type SmoothTimerAnchor = { r: number; atMs: number };

type Props = {
  anchor: SmoothTimerAnchor | null;
  className?: string;
};

/**
 * Hero countdown: updates from the chain anchor on a light interval; `formatCountdown` is whole
 * seconds only (no sub-second digits).
 */
export function SmoothHeroCountdown({ anchor, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  useLayoutEffect(() => {
    if (anchor == null || !ref.current) return;
    const a = anchor;
    const rem = Math.max(0, a.r - (Date.now() - a.atMs) / 1000);
    const text = formatCountdown(rem);
    if (ref.current.textContent !== text) ref.current.textContent = text;
  }, [anchor]);

  useEffect(() => {
    if (anchor == null) return;
    const tick = () => {
      const a = anchorRef.current;
      const el = ref.current;
      if (el && a) {
        const rem = Math.max(0, a.r - (Date.now() - a.atMs) / 1000);
        const text = formatCountdown(rem);
        if (el.textContent !== text) el.textContent = text;
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [anchor]);

  if (anchor == null) {
    return <div className={className}>—</div>;
  }

  return <div ref={ref} className={className} />;
}
