// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { PageSection } from "@/components/ui/PageSection";
import { ARENA_TOTAL_USD_EQUIV_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatBpsAsPercent, formatLocaleInteger } from "@/lib/formatAmount";
import {
  computeDoubProjectionStats,
  PROJECTED_DOUB_SUPPLY_WHOLE,
} from "@/lib/doubProjectionStats";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import { CL8Y_USD_PRICE_PLACEHOLDER } from "@/pages/timeCurveArena/arenaPageHelpers";
import { StatCard } from "@/pages/timecurve/timecurveUi";
import { statFromOptionalString } from "@/lib/statDisplayFromContractRead";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";

export type TimeCurveProtocolDoubProjectionSectionProps = {
  totalRaisedSerialized: string | undefined;
  totalRaisedObservedAtMs: number | undefined;
  totalTokensForSaleSerialized: string | undefined;
  totalCharmWeightSerialized: string | undefined;
  currentPricePerCharmSerialized: string | undefined;
  readsPending: boolean;
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

export function TimeCurveProtocolDoubProjectionSection({
  totalRaisedSerialized,
  totalRaisedObservedAtMs,
  totalTokensForSaleSerialized,
  totalCharmWeightSerialized,
  currentPricePerCharmSerialized,
  readsPending,
}: TimeCurveProtocolDoubProjectionSectionProps) {
  const freshness = useRelativeFreshnessLabel(totalRaisedObservedAtMs);

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

  const marketCapUsd =
    snapshot !== null && Number.isFinite(snapshot.impliedMarketCapUsdPlaceholder)
      ? (snapshot.impliedMarketCapUsdPlaceholder * CL8Y_USD_PRICE_PLACEHOLDER).toLocaleString(
          undefined,
          { style: "currency", currency: "USD", maximumFractionDigits: 0 },
        )
      : undefined;

  return (
    <PageSection
      title="DOUB projection"
      badgeLabel="launch economics"
      badgeTone="info"
      lede="Live redemption and launch-liquidity economics from onchain sale totals. Full-supply figure is the 251M policy constant (includes 1M airdrops)."
      data-testid="timecurve-protocol-doub-projection"
    >
      <div className="stats-grid">
        <StatCard
          label="Projected total supply"
          value={`${formatLocaleInteger(PROJECTED_DOUB_SUPPLY_WHOLE)} DOUB`}
          meta={
            <>
              Policy constant (200M sale + 21.5M presale + 28.5M V3 LP + 1M airdrops); see
              launchplan-timecurve.md §4 (+ 1M airdrops per GitLab #229).
            </>
          }
        />
        <StatCard
          label="Sale bucket (onchain)"
          value={statFromOptionalString(totalTokensForSaleSerialized, statCtx, {
            mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} DOUB`,
            labels: { loading: "Loading sale bucket…", missing: "Sale bucket unavailable" },
          })}
          meta={
            snapshot?.saleBucketMatchesPolicy === false
              ? "Expected 200M when deploy follows launch plan."
              : "Should read 200M when deploy follows launch plan."
          }
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
          meta="Redemption rate; decreases as the sale progresses."
        />
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
          meta="1.275× clearing — DoubLPIncentives seed (GitLab #158)."
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
          meta="0.8× launch anchor."
        />
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
          meta={
            <>
              Uses launch-anchor CL8Y/DOUB × {formatLocaleInteger(PROJECTED_DOUB_SUPPLY_WHOLE)} DOUB
              supply.
              {freshness ? ` · totalRaised seen ${freshness}` : null}
            </>
          }
        />
        <StatCard
          label="Implied market cap (USD illustrative)"
          value={statFromOptionalString(marketCapUsd, statCtx, {
            mapSuccess: (s) => s,
            labels: { loading: "Loading USD…", missing: "USD unavailable" },
          })}
          meta={
            <span title={ARENA_TOTAL_USD_EQUIV_TITLE}>
              1 CL8Y = $1 placeholder — not a live oracle (#192).
            </span>
          }
        />
        <StatCard
          label="Per-CHARM price (live)"
          value={statFromOptionalString(currentPricePerCharmSerialized, statCtx, {
            mapSuccess: (raw) => `${formatBuyHubDerivedCompact(raw, 18)} CL8Y`,
            labels: { loading: "Loading price…", missing: "Price unavailable" },
          })}
        />
        <StatCard
          label="Sale allocation"
          value={statFromOptionalString(
            snapshot?.saleAllocationBps !== null
              ? snapshot?.saleAllocationBps?.toString()
              : undefined,
            statCtx,
            {
              mapSuccess: (raw) => formatBpsAsPercent(Number(raw)),
              labels: { loading: "Loading allocation…", missing: "Allocation unavailable" },
            },
          )}
          meta="totalCharmWeight ÷ totalTokensForSale (CHARM weight vs sale bucket)."
        />
      </div>
    </PageSection>
  );
}
