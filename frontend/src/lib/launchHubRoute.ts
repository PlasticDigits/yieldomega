// SPDX-License-Identifier: AGPL-3.0-only

import { launchTimestampSec } from "@/lib/launchCountdown";

/**
 * Hub path inside `ShellRoutes`: `/` when the launch gate is unset (no-env),
 * `/home` when `VITE_LAUNCH_TIMESTAMP` is configured (post-launch shell only).
 */
export function homeHubPath(): "/" | "/home" {
  return launchTimestampSec() === undefined ? "/" : "/home";
}
