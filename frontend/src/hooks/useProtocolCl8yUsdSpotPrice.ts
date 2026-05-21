// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useChainId } from "wagmi";
import type { HexAddress } from "@/lib/addresses";
import { fetchCl8ySpotUsdFromKumbaya } from "@/lib/cl8ySpotUsdPrice";

export type ProtocolCl8yUsdSpotState = {
  usdPerCl8y: number | undefined;
  loading: boolean;
  error: string | undefined;
  fetchedAtMs: number | undefined;
  refresh: () => void;
};

/**
 * Loads CL8Y/USD once when `acceptedCl8y` becomes available; further updates only via {@link refresh}.
 */
export function useProtocolCl8yUsdSpotPrice(
  acceptedCl8y: HexAddress | undefined,
): ProtocolCl8yUsdSpotState {
  const wagmiConfig = useConfig();
  const chainId = useChainId();
  const [usdPerCl8y, setUsdPerCl8y] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [fetchedAtMs, setFetchedAtMs] = useState<number | undefined>(undefined);
  const inFlightRef = useRef(false);

  const runFetch = useCallback(async () => {
    if (!acceptedCl8y || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const quote = await fetchCl8ySpotUsdFromKumbaya(wagmiConfig, chainId, acceptedCl8y);
      if (quote === null) {
        setUsdPerCl8y(undefined);
        setError("CL8Y/USD quote unavailable (check Kumbaya config and pools).");
      } else {
        setUsdPerCl8y(quote.usdPerCl8y);
        setFetchedAtMs(Date.now());
        setError(undefined);
      }
    } catch {
      setUsdPerCl8y(undefined);
      setError("CL8Y/USD quote failed.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [acceptedCl8y, chainId, wagmiConfig]);

  useEffect(() => {
    if (!acceptedCl8y) {
      setUsdPerCl8y(undefined);
      setError(undefined);
      setFetchedAtMs(undefined);
      return;
    }
    void runFetch();
    // Intentionally only when accepted asset / chain becomes available — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- manual refresh only after initial load
  }, [acceptedCl8y, chainId]);

  return {
    usdPerCl8y,
    loading,
    error,
    fetchedAtMs,
    refresh: () => void runFetch(),
  };
}
