// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, type ReactNode } from "react";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { indexerBaseUrl } from "@/lib/addresses";
import { formatAmountTriple, formatLocaleInteger } from "@/lib/formatAmount";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import {
  platformUsagePageIndex,
  platformUsageTotalPages,
} from "@/lib/platformUsagePagination";
import type { PlatformUsageVelocityWindow } from "@/lib/indexerApi";
import { StatCard } from "@/pages/timecurve/timecurveUi";
import { PlatformUsagePagination } from "@/pages/timecurve/PlatformUsagePagination";
import { useTimecurveProtocolPlatformUsage } from "@/pages/timecurve/useTimecurveProtocolPlatformUsage";

type Props = {
  isOffline: boolean;
};

function formatCount(raw: string | undefined): ReactNode {
  if (raw === undefined) {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
  try {
    return formatLocaleInteger(BigInt(raw));
  } catch {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
}

function formatCl8yWei(raw: string | undefined): ReactNode {
  if (raw === undefined) {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
  try {
    return <AmountDisplay raw={raw} decimals={18} />;
  } catch {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
}

function WarbowStatPair({
  label,
  count,
  cl8yWei,
}: {
  label: string;
  count: string | undefined;
  cl8yWei: string | undefined;
}) {
  return (
    <StatCard
      label={label}
      value={
        <>
          {formatCount(count)} actions · {formatCl8yWei(cl8yWei)} CL8Y
        </>
      }
    />
  );
}

export function TimeCurveProtocolPlatformUsageSection({ isOffline }: Props) {
  const {
    data,
    err,
    initialLoading,
    pageLoading,
    offset,
    velocityWindow,
    onVelocityWindowChange,
    onPageChange,
    walletPageSize,
  } = useTimecurveProtocolPlatformUsage();

  const indexerConfigured = Boolean(indexerBaseUrl());
  const showData = data !== null && !err && indexerConfigured;
  const showEmptyIndexer = !indexerConfigured;
  const showOffline = indexerConfigured && (isOffline || err !== null);

  const totalWallets = useMemo(() => {
    if (!data?.wallets.total) {
      return 0;
    }
    const n = Number(data.wallets.total);
    return Number.isFinite(n) ? n : 0;
  }, [data?.wallets.total]);

  const currentPage = platformUsagePageIndex(offset, walletPageSize);
  const totalPages = platformUsageTotalPages(totalWallets, walletPageSize);

  const velocityBuyCount = data?.velocity.buy_count ?? "0";
  const velocityAvg = data?.velocity.avg_buys_per_hour;
  const velocityEmpty =
    showData && (velocityBuyCount === "0" || BigInt(velocityBuyCount) === 0n);

  return (
    <PageSection
      title="Platform usage"
      badgeLabel="indexer-backed"
      badgeTone="info"
      lede="Network-wide participation on the indexed chain: TimeCurve buys, WarBow CL8Y spend, and buy velocity. Reflects indexer history only (ingestion lag applies)."
      data-testid="timecurve-protocol-platform-usage"
    >
      {showEmptyIndexer ? (
        <StatusMessage variant="muted">
          Set <code>VITE_INDEXER_URL</code> to load platform usage stats.
        </StatusMessage>
      ) : null}

      {showOffline && !showEmptyIndexer ? (
        <StatusMessage variant="warning">
          {isOffline
            ? "Indexer offline · platform usage may be stale or unavailable."
            : err}
        </StatusMessage>
      ) : null}

      {initialLoading && indexerConfigured && !showData ? (
        <p className="muted">Loading platform usage…</p>
      ) : null}

      {showData ? (
        <>
          <div className="stats-grid">
            <StatCard label="Unique wallets" value={formatCount(data.unique_wallets)} />
            <StatCard label="Total buys" value={formatCount(data.total_buys)} />
            <StatCard
              label="Mean buys / wallet"
              value={data.mean_buys_per_wallet}
              meta={`Among ${formatCount(data.unique_buyers)} buyers with ≥1 buy`}
            />
            <StatCard label="Median buys / wallet" value={data.median_buys_per_wallet} />
          </div>

          <div className="stats-grid" aria-label="WarBow action volume">
            <WarbowStatPair
              label="Steals"
              count={data.warbow.steals.count}
              cl8yWei={data.warbow.steals.cl8y_spent_wei}
            />
            <WarbowStatPair
              label="Steal overrides"
              count={data.warbow.steal_overrides.count}
              cl8yWei={data.warbow.steal_overrides.cl8y_spent_wei}
            />
            <WarbowStatPair
              label="Revenges"
              count={data.warbow.revenges.count}
              cl8yWei={data.warbow.revenges.cl8y_spent_wei}
            />
            <WarbowStatPair
              label="Guards"
              count={data.warbow.guards.count}
              cl8yWei={data.warbow.guards.cl8y_spent_wei}
            />
          </div>

          <div className="platform-usage-velocity" data-testid="timecurve-protocol-platform-usage-velocity">
            <p className="platform-usage-velocity__label">Buy velocity</p>
            <div className="platform-usage-velocity__toggle" role="group" aria-label="Velocity window">
              {(["1h", "24h"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={[
                    "platform-usage-velocity__btn",
                    velocityWindow === w ? "platform-usage-velocity__btn--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={velocityWindow === w}
                  data-testid={`timecurve-protocol-platform-usage-velocity-${w}`}
                  onClick={() => onVelocityWindowChange(w as PlatformUsageVelocityWindow)}
                >
                  {w === "1h" ? "Last hour" : "Last day"}
                </button>
              ))}
            </div>
            {velocityEmpty ? (
              <p className="muted">No buys in this window.</p>
            ) : (
              <p>
                <strong>{formatCount(velocityBuyCount)}</strong> buys · avg{" "}
                <strong>{velocityAvg ?? "—"}</strong> buys / hour
              </p>
            )}
          </div>

          <div className="platform-usage-wallets">
            <h3 className="platform-usage-wallets__title">Wallets by CL8Y spent on buys</h3>
            {pageLoading ? <p className="muted">Refreshing wallet table…</p> : null}
            <div className="platform-usage-wallets__scroll">
              <table className="platform-usage-wallets__table">
                <thead>
                  <tr>
                    <th scope="col">Wallet</th>
                    <th scope="col">Buys</th>
                    <th scope="col">CL8Y spent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wallets.items.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyDataPlaceholder>No indexed buys yet</EmptyDataPlaceholder>
                      </td>
                    </tr>
                  ) : (
                    data.wallets.items.map((row) => (
                      <tr key={row.wallet}>
                        <td>
                          <AddressInline address={row.wallet} />
                        </td>
                        <td>{formatLocaleInteger(BigInt(row.buy_count))}</td>
                        <td>
                          {formatAmountTriple(BigInt(row.cl8y_spent_wei), 18).decimal}
                          <span className="muted">
                            {" "}
                            ({formatBuyHubDerivedCompact(row.cl8y_spent_wei, 18)} CL8Y)
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PlatformUsagePagination
              currentPage={currentPage}
              totalPages={totalPages}
              disabled={pageLoading}
              onPageChange={onPageChange}
            />
          </div>
        </>
      ) : null}
    </PageSection>
  );
}
