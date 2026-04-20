// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";

/** Parse a Unix-seconds launch timestamp from an env / config string (no `import.meta` — unit-testable). */
export function parseLaunchTimestamp(v: string | undefined | null): number | undefined {
  const t = v?.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** Reads `VITE_LAUNCH_TIMESTAMP`. Returns `undefined` when missing/empty/non-numeric so the gate stays a no-op. */
export function launchTimestampSec(): number | undefined {
  return parseLaunchTimestamp(import.meta.env.VITE_LAUNCH_TIMESTAMP as string | undefined);
}

/** Whole seconds (>=0) between `nowSec` and `launchSec`. Pure for unit tests. */
export function secondsRemainingUntil(launchSec: number, nowSec: number): number {
  if (!Number.isFinite(launchSec) || !Number.isFinite(nowSec)) return 0;
  return Math.max(0, Math.floor(launchSec) - Math.floor(nowSec));
}

export type LaunchCountdownState = {
  secondsRemaining: number;
  hasLaunched: boolean;
};

/**
 * Wall-clock countdown to a fixed Unix-seconds deadline.
 * Stops the interval the moment `secondsRemaining` reaches zero so an open tab
 * flips to the post-launch tree without burning a tick per second forever.
 */
export function useLaunchCountdown(launchSec: number): LaunchCountdownState {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    secondsRemainingUntil(launchSec, Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    setSecondsRemaining(secondsRemainingUntil(launchSec, Math.floor(Date.now() / 1000)));
    if (secondsRemainingUntil(launchSec, Math.floor(Date.now() / 1000)) <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      const next = secondsRemainingUntil(launchSec, Math.floor(Date.now() / 1000));
      setSecondsRemaining(next);
      if (next <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [launchSec]);

  return { secondsRemaining, hasLaunched: secondsRemaining <= 0 };
}
