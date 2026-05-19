// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { configuredRpcHttpUrls } from "@/lib/chain";
import {
  ensureRpcFilterCapabilitiesProbed,
  urlsNeedBlockingFilterProbe,
} from "@/lib/rpcFilterCapability";

/**
 * Runs the filter-capability probe before the app uses wagmi event watches.
 * Uses sessionStorage with a 4h TTL; only blocks the UI when a URL has never been probed.
 */
export function RpcFilterCapabilityBootstrap({ children }: { children: ReactNode }) {
  const rpcUrls = useMemo(() => configuredRpcHttpUrls(), []);
  const [ready, setReady] = useState(
    () => rpcUrls.length === 0 || !urlsNeedBlockingFilterProbe(rpcUrls),
  );

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void ensureRpcFilterCapabilitiesProbed(rpcUrls).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, rpcUrls]);

  useEffect(() => {
    if (!ready || rpcUrls.length === 0) return;
    void ensureRpcFilterCapabilitiesProbed(rpcUrls);
  }, [ready, rpcUrls]);

  if (!ready) return null;
  return children;
}
