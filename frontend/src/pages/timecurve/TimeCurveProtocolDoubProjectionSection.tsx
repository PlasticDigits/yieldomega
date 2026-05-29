// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, type ReactNode } from "react";
import { useAccount, useReadContract } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { cl8yWeiToUsdDisplay } from "@/lib/cl8ySpotUsdPrice";
import { PROTOCOL_CL8Y_USD_SPOT_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatLocaleInteger } from "@/lib/formatAmount";
import {
  computeDoubProjectionStats,
  PROJECTED_DOUB_SUPPLY_WHOLE,
} from "@/lib/doubProjectionStats";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import { timeCurveReadAbi } from "@/lib/abis";
import { addresses } from "@/lib/addresses";
import type { ProtocolCl8yUsdSpotState } from "@/hooks/useProtocolCl8yUsdSpotPrice";
import { StatCard } from "@/pages/timecurve/timecurveUi";
import { statFromOptionalString } from "@/lib/statDisplayFromContractRead";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { ProtocolInlineRefreshButton } from "@/pages/timecurve/ProtocolInlineRefreshButton";

export type TimeCurveProtocolDoubProjectionSectionProps = {
  totalRaisedSerialized: string | undefined;
  totalTokensForSaleSerialized: string | undefined;
  totalCharmWeightSerialized: string | undefined;
  currentPricePerCharmSerialized: string | undefined;
  readsPending: boolean;
  cl8yUsd: ProtocolCl8yUsdSpotState;
};

function parseBigintOrUndefined(raw: string | undefined): bigint | undefined {
  if (raw === undefined) {
    return undefined;
  }
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

function StatValueRow({
  children,
  refresh,
}: {
  children: ReactNode;
  refresh?: { ariaLabel: string; disabled?: boolean; onClick: () => void };
}) {
  if (!refresh) {
    return <>{children}</>;
  }
  return (
    <span className="timecurve-protocol__stat-value-row">
      {children}
      <ProtocolInlineRefreshButton
        ariaLabel={refresh.ariaLabel}
        disabled={refresh.disabled}
        onClick={refresh.onClick}
      />
    </span>
  );
}

function ProjectionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = `doub-projection-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="doub-projection-group" aria-labelledby={headingId}>
      <div className="doub-projection-group__header">
        <h3 id={headingId}>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="stats-grid stats-grid--doub-projection">{children}</div>
    </section>
  );
}

export function TimeCurveProtocolDoubProjectionSection({
  totalRaisedSerialized,
  totalTokensForSaleSerialized,
  totalCharmWeightSerialized,
  currentPricePerCharmSerialized,
  readsPending,
  cl8yUsd,
}: TimeCurveProtocolDoubProjectionSectionProps) {
  const tc = addresses.timeArena;
  const { address, isConnected } = useAccount();

  const {
    data: walletCharmWeight,
    isPending: walletCharmPending,
    refetch: refetchWalletCharm,
  } = useReadContract({
    address: tc,
    abi: timeCurveReadAbi,
    functionName: "charmWeight",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tc && address) },
  });

  const snapshot = useMemo(() => {
    const totalRaised = parseBigintOrUndefined(totalRaisedSerialized);
    const totalTokensForSale = parseBigintOrUndefined(totalTokensForSaleSerialized);
    const totalCharmWeight = parseBigintOrUndefined(totalCharmWeightSerialized);
    const pricePerCharm = parseBigintOrUndefined(currentPricePerCharmSerialized);
    if (
      totalRaised === undefined ||
      totalTokensForSale === undefined ||
      totalCharmWeight === undefined ||
      pricePerCharm === undefined
    ) {
      return null;
    }
    return computeDoubProjectionStats({
      totalRaisedWei: totalRaised,
      totalTokensForSaleWei: totalTokensForSale,
      totalCharmWeightWei: totalCharmWeight,
      currentPricePerCharmWad: pricePerCharm,
    });
  }, [
    totalRaisedSerialized,
    totalTokensForSaleSerialized,
    totalCharmWeightSerialized,
    currentPricePerCharmSerialized,
  ]);

  const statCtx = { isPending: readsPending };

  const walletShareDisplay = useMemo(() => {
    if (!isConnected || !address) {
      return <EmptyDataPlaceholder>Connect wallet</EmptyDataPlaceholder>;
    }
    if (walletCharmPending) {
      return <EmptyDataPlaceholder>Loading…</EmptyDataPlaceholder>;
    }
    const totalCw = parseBigintOrUndefined(totalCharmWeightSerialized);
    const userCw =
      walletCharmWeight !== undefined ? (walletCharmWeight as bigint) : undefined;
    if (totalCw === undefined || userCw === undefined || totalCw === 0n) {
      return <EmptyDataPlaceholder>No data yet</EmptyDataPlaceholder>;
    }
    const pct = Number((userCw * 10_000n) / totalCw) / 100;
    if (!Number.isFinite(pct)) {
      return <EmptyDataPlaceholder>No data yet</EmptyDataPlaceholder>;
    }
    return `${pct.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`;
  }, [
    isConnected,
    address,
    walletCharmPending,
    totalCharmWeightSerialized,
    walletCharmWeight,
  ]);

  const marketCapUsd = useMemo(
    () =>
      snapshot !== null
        ? cl8yWeiToUsdDisplay(snapshot.impliedMarketCapCl8yWei, cl8yUsd.usdPerCl8y)
        : undefined,
    [snapshot, cl8yUsd.usdPerCl8y],
  );

  const usdRefresh = {
    ariaLabel: "Refresh CL8Y USD price",
    disabled: cl8yUsd.loading,
    onClick: cl8yUsd.refresh,
  };

  return (
    <PageSection
      title="DOUB projection"
      badgeLabel="launch economics"
      badgeTone="info"
      lede="Live redemption and launch-liquidity economics from onchain sale totals, grouped by supply, price anchors, and market lens."
      data-testid="timecurve-protocol-doub-projection"
    >
      <div className="doub-projection-groups" aria-label="DOUB projection stat groups">
        <ProjectionGroup
          title="Supply and redemption"
          description="Policy supply, the onchain sale bucket, and the current CHARM redemption rate."
        >
          <StatCard
            label="Projected total supply"
            value={`${formatLocaleInteger(PROJECTED_DOUB_SUPPLY_WHOLE)} DOUB`}
            meta="Policy supply: 200M sale + reserves + 1M airdrops"
            className="stat-card--priority"
          />
          <StatCard
            label="Sale bucket (onchain)"
            value={statFromOptionalString(totalTokensForSaleSerialized, statCtx, {
              mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} DOUB`,
              labels: { loading: "Loading sale bucket…", missing: "Sale bucket unavailable" },
            })}
          />
          <StatCard
            label="CHARM → DOUB at launch"
            value={statFromOptionalString(
              snapshot?.doubPerCharmAtLaunchWad !== undefined
                ? snapshot.doubPerCharmAtLaunchWad.toString()
                : undefined,
              statCtx,
              {
                mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} DOUB / CHARM`,
                labels: {
                  loading: "Loading redemption rate…",
                  missing: "No CHARM minted yet",
                },
              },
            )}
            meta="Decreases as sale progresses"
          />
        </ProjectionGroup>

        <ProjectionGroup
          title="Price anchors"
          description="Clearing, launch-anchor, Kumbaya floor, and live CHARM price stay visually distinct."
        >
          <StatCard
            label="Implied CL8Y / DOUB (clearing)"
            value={statFromOptionalString(
              snapshot?.clearingCl8yPerDoubWad.toString(),
              statCtx,
              {
                mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} CL8Y`,
                labels: { loading: "Loading clearing…", missing: "Clearing unavailable" },
              },
            )}
            meta="From totalRaised ÷ totalTokensForSale."
          />
          <StatCard
            label="Launch anchor CL8Y / DOUB"
            value={statFromOptionalString(
              snapshot?.launchAnchorCl8yPerDoubWad.toString(),
              statCtx,
              {
                mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} CL8Y`,
                labels: { loading: "Loading anchor…", missing: "Anchor unavailable" },
              },
            )}
            meta="1.275x clearing"
          />
          <StatCard
            label="Kumbaya band floor"
            value={statFromOptionalString(
              snapshot?.kumbayaBandLowerCl8yPerDoubWad.toString(),
              statCtx,
              {
                mapSuccess: (raw) => `${formatCompactFromRaw(raw, 18)} CL8Y`,
                labels: { loading: "Loading band…", missing: "Band unavailable" },
              },
            )}
            meta="0.25x launch anchor"
          />
          <StatCard
            label="Per-CHARM price (live)"
            value={statFromOptionalString(currentPricePerCharmSerialized, statCtx, {
              mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} CL8Y`,
              labels: { loading: "Loading price…", missing: "Price unavailable" },
            })}
          />
        </ProjectionGroup>

        <ProjectionGroup
          title="Market and wallet lens"
          description="Launch-anchor market cap pairs with Kumbaya USD quote and wallet-specific share."
        >
          <StatCard
            label="Implied market cap (CL8Y)"
            value={statFromOptionalString(
              snapshot?.impliedMarketCapCl8yWei.toString(),
              statCtx,
              {
                mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} CL8Y`,
                labels: { loading: "Loading market cap…", missing: "Market cap unavailable" },
              },
            )}
            className="stat-card--priority"
          />
          <StatCard
            label="Implied market cap (USD)"
            value={
              <StatValueRow refresh={usdRefresh}>
                {statFromOptionalString(marketCapUsd, statCtx, {
                  mapSuccess: (s) => s,
                  labels: {
                    loading: cl8yUsd.loading ? "Loading USD…" : "USD unavailable",
                    missing: cl8yUsd.error ?? "USD unavailable",
                  },
                })}
              </StatValueRow>
            }
            meta={
              <span title={PROTOCOL_CL8Y_USD_SPOT_TITLE}>
                Kumbaya USDM quote per 1 CL8Y
                {cl8yUsd.usdPerCl8y !== undefined
                  ? ` ($${cl8yUsd.usdPerCl8y.toLocaleString(undefined, { maximumFractionDigits: 6 })})`
                  : null}
              </span>
            }
          />
          <StatCard
            label="Your share of sale"
            value={
              <StatValueRow
                refresh={
                  isConnected && address
                    ? {
                        ariaLabel: "Refresh wallet CHARM share",
                        disabled: walletCharmPending,
                        onClick: () => void refetchWalletCharm(),
                      }
                    : undefined
                }
              >
                {walletShareDisplay}
              </StatValueRow>
            }
            meta="Your percentage holding in connected wallet"
          />
        </ProjectionGroup>
      </div>
    </PageSection>
  );
}
