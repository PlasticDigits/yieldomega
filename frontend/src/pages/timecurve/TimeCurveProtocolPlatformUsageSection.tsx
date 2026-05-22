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
  formatPlatformUsageDecimalStat,
  platformUsageVelocityAvgSuffix,
} from "@/lib/platformUsageDisplay";
import {
  platformUsagePageIndex,
  platformUsageTotalPages,
  platformUsageWalletRank,
} from "@/lib/platformUsagePagination";
import type { PlatformUsageVelocityWindow } from "@/lib/indexerApi";
import { StatCard } from "@/pages/timecurve/timecurveUi";
import { PlatformUsagePagination } from "@/pages/timecurve/PlatformUsagePagination";
import { PlatformUsageSubsection } from "@/pages/timecurve/PlatformUsageSubsection";
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

function formatDecimalStat(raw: string | undefined): ReactNode {
  const formatted = formatPlatformUsageDecimalStat(raw);
  if (formatted === undefined) {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
  return formatted;
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
      className="platform-usage-warbow-card"
      value={
        <span className="platform-usage-warbow-stat">
          <span className="platform-usage-warbow-stat__line">
            {formatCount(count)} <span className="platform-usage-warbow-stat__unit">actions</span>
          </span>
          <span className="platform-usage-warbow-stat__line platform-usage-warbow-stat__line--cl8y">
            {formatCl8yWei(cl8yWei)} <span className="platform-usage-warbow-stat__unit">CL8Y</span>
          </span>
        </span>
      }
    />
  );
}

const VELOCITY_WINDOWS: readonly PlatformUsageVelocityWindow[] = ["1h", "24h", "sale"];

function velocityWindowLabel(w: PlatformUsageVelocityWindow): string {
  if (w === "1h") {
    return "Last hour";
  }
  if (w === "24h") {
    return "Last day";
  }
  return "Whole sale";
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

  const tableRefreshing = showData && pageLoading && !initialLoading;

  return (
    <PageSection
      title="Platform usage"
      badgeLabel="indexer-backed"
      badgeTone="info"
      lede="Network-wide participation on the indexed chain: TimeCurve buys, WarBow CL8Y spend, and buy velocity."
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
        <div className="platform-usage-body">
          <PlatformUsageSubsection
            title="Participation"
            dataTestId="timecurve-protocol-platform-usage-participation"
          >
            <div className="stats-grid">
              <StatCard label="Unique wallets" value={formatCount(data.unique_wallets)} />
              <StatCard label="Total buys" value={formatCount(data.total_buys)} />
              <StatCard
                label="Mean buys / wallet"
                value={formatDecimalStat(data.mean_buys_per_wallet)}
              />
              <StatCard
                label="Median buys / wallet"
                value={formatDecimalStat(data.median_buys_per_wallet)}
              />
            </div>
          </PlatformUsageSubsection>

          <PlatformUsageSubsection
            title="WarBow CL8Y volume"
            dataTestId="timecurve-protocol-platform-usage-warbow"
          >
            <div className="stats-grid platform-usage-warbow-grid" aria-label="WarBow action volume">
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
          </PlatformUsageSubsection>

          <div
            className="platform-usage-velocity"
            data-testid="timecurve-protocol-platform-usage-velocity"
          >
            <p className="platform-usage-velocity__label">Buy velocity</p>
            <div
              className="platform-usage-velocity__toggle timecurve-simple__rate-paywith timecurve-simple__rate-paywith--segmented"
              role="group"
              aria-label="Velocity window"
            >
              {VELOCITY_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={[
                    "timecurve-simple__rate-paywith-btn",
                    velocityWindow === w ? "timecurve-simple__rate-paywith-btn--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={velocityWindow === w}
                  data-testid={`timecurve-protocol-platform-usage-velocity-${w}`}
                  onClick={() => onVelocityWindowChange(w)}
                >
                  {velocityWindowLabel(w)}
                </button>
              ))}
            </div>
            {velocityEmpty ? (
              <p className="platform-usage-velocity__empty muted">No buys in this window.</p>
            ) : (
              <p className="platform-usage-velocity__summary">
                <strong>{formatCount(velocityBuyCount)}</strong> buys · avg{" "}
                <strong>{velocityAvg ?? "—"}</strong> {platformUsageVelocityAvgSuffix(velocityWindow)}
              </p>
            )}
          </div>

          <PlatformUsageSubsection
            title="Wallets by CL8Y spent on buys"
            className="platform-usage-wallets"
            dataTestId="timecurve-protocol-platform-usage-wallets"
          >
            <div className="platform-usage-wallets__title-row">
              <span
                className={[
                  "platform-usage-wallets__status",
                  tableRefreshing
                    ? "platform-usage-wallets__status--refresh"
                    : "platform-usage-wallets__status--ok",
                ].join(" ")}
                role="status"
                aria-live="polite"
                aria-label={
                  tableRefreshing ? "Refreshing wallet table" : "Wallet table up to date"
                }
                title={
                  tableRefreshing ? "Refreshing wallet table" : "Wallet table up to date"
                }
                data-testid="timecurve-protocol-platform-usage-wallet-status"
              >
                <span className="platform-usage-wallets__status-icon" aria-hidden>
                  {tableRefreshing ? "↻" : "✓"}
                </span>
                <span className="platform-usage-wallets__status-label">
                  {tableRefreshing ? "Refreshing…" : "Up to date"}
                </span>
              </span>
            </div>
            <div
              className={[
                "platform-usage-wallets__scroll",
                tableRefreshing ? "platform-usage-wallets__scroll--loading" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <table className="platform-usage-wallets__table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Wallet</th>
                    <th scope="col">Buys</th>
                    <th scope="col">CL8Y spent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wallets.items.length === 0 && !tableRefreshing ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyDataPlaceholder>No indexed buys yet</EmptyDataPlaceholder>
                      </td>
                    </tr>
                  ) : (
                    data.wallets.items.map((row, rowIndex) => (
                      <tr key={row.wallet}>
                        <td className="platform-usage-wallets__rank">
                          {platformUsageWalletRank(offset, rowIndex)}
                        </td>
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
          </PlatformUsageSubsection>
        </div>
      ) : null}
    </PageSection>
  );
}
