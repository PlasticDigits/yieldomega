// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { indexerBaseUrl } from "@/lib/addresses";
import {
  fetchTimecurvePlatformUsage,
  type PlatformUsageVelocityWindow,
  type TimecurvePlatformUsage,
} from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import {
  PLATFORM_USAGE_WALLET_PAGE_SIZE,
  platformUsageOffsetForPage,
} from "@/lib/platformUsagePagination";

export function useTimecurveProtocolPlatformUsage() {
  const [data, setData] = useState<TimecurvePlatformUsage | null>(null);
  const [offset, setOffset] = useState(0);
  const [velocityWindow, setVelocityWindow] = useState<PlatformUsageVelocityWindow>("1h");
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestSeq = 0;
    let timeoutId = 0;

    const load = async () => {
      const id = ++requestSeq;
      if (offset === 0) {
        setPageLoading(true);
      }
      setErr(null);
      try {
        const page = await fetchTimecurvePlatformUsage(
          PLATFORM_USAGE_WALLET_PAGE_SIZE,
          offset,
          velocityWindow,
        );
        if (cancelled || id !== requestSeq) {
          return;
        }
        const ok = page != null;
        if (indexerBaseUrl()) {
          reportIndexerFetchAttempt(ok);
        }
        if (!page) {
          setData(null);
          setErr(
            indexerBaseUrl()
              ? "Platform usage is unavailable right now. Try again in a moment."
              : "Set VITE_INDEXER_URL to load platform usage from the indexer.",
          );
          return;
        }
        setData(page);
      } catch {
        if (!cancelled) {
          setData(null);
          setErr("Could not load platform usage.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
          setInitialLoading(false);
        }
      }
    };

    const scheduleLoop = () => {
      timeoutId = window.setTimeout(async () => {
        await load();
        if (!cancelled && indexerBaseUrl()) {
          scheduleLoop();
        }
      }, getIndexerBackoffPollMs(3000));
    };

    void (async () => {
      await load();
      if (!cancelled && indexerBaseUrl()) {
        scheduleLoop();
      }
    })();

    return () => {
      cancelled = true;
      requestSeq += 1;
      window.clearTimeout(timeoutId);
    };
  }, [offset, velocityWindow]);

  const onVelocityWindowChange = useCallback((window: PlatformUsageVelocityWindow) => {
    setVelocityWindow(window);
    setOffset(0);
  }, []);

  const onPageChange = useCallback((page: number) => {
    setOffset(platformUsageOffsetForPage(page, PLATFORM_USAGE_WALLET_PAGE_SIZE));
  }, []);

  return {
    data,
    err,
    initialLoading,
    pageLoading,
    offset,
    velocityWindow,
    onVelocityWindowChange,
    onPageChange,
    walletPageSize: PLATFORM_USAGE_WALLET_PAGE_SIZE,
  };
}
