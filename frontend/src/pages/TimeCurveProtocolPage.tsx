// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState } from "react";
import { envelopeCurveParamsFromWire, type EnvelopeCurveParamsWire } from "@/lib/timeCurveBuyDisplay";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeCurveMinSpendHeadroom";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { MegaScannerAddressLink } from "@/components/MegaScannerAddressLink";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, type HexAddress } from "@/lib/addresses";
import { formatLocaleInteger, formatBpsAsPercent } from "@/lib/formatAmount";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { humanizeKvLabel } from "@/lib/humanizeIdentifier";
import { DOUB_TOKEN_LOGO } from "@/lib/tokenMedia";
import { TimeCurveLiveCharts } from "@/pages/timecurve/TimeCurveLiveCharts";
import { TimeCurveLiveBuysActivitySection } from "@/pages/timecurve/TimeCurveLiveBuysActivitySection";
import { RawDataAccordion } from "@/pages/timecurve/TimeCurveSections";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { TimeCurveProtocolDoubProjectionSection } from "@/pages/timecurve/TimeCurveProtocolDoubProjectionSection";
import { TimeCurveProtocolPlatformUsageSection } from "@/pages/timecurve/TimeCurveProtocolPlatformUsageSection";
import { TimeCurveProtocolDonatePoolsSection } from "@/pages/timecurve/TimeCurveProtocolDonatePoolsSection";
import { WalletProfileModal } from "@/components/WalletProfileModal";
import { TimeCurveProtocolWarbowRefreshSection } from "@/pages/timecurve/TimeCurveProtocolWarbowRefreshSection";
import { derivePhase, ledgerSecIntForPhase, phaseBadge } from "@/pages/timecurve/timeCurveSimplePhase";
import { useTimecurveProtocolLiveBuys } from "@/pages/timecurve/useTimecurveProtocolLiveBuys";
import { useTimecurveProtocolRawAccordion } from "@/pages/timecurve/useTimecurveProtocolRawAccordion";
import { useLastObservedAtForSerializedDep } from "@/lib/useLastObservedAtForSerializedDep";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";
import { cl8yWeiToUsdDisplay } from "@/lib/cl8ySpotUsdPrice";
import { PROTOCOL_CL8Y_USD_SPOT_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatTotalRaiseHeroDisplayFromWei } from "@/pages/timeCurveArena/arenaPageHelpers";
import { useProtocolCl8yUsdSpotPrice } from "@/hooks/useProtocolCl8yUsdSpotPrice";
import { ProtocolInlineRefreshButton } from "@/pages/timecurve/ProtocolInlineRefreshButton";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import { useTimeCurveProtocolData } from "@/pages/timecurve/TimeCurveProtocolDataContext";

/**
 * Protocol view for `/timecurve/protocol` — a focused dump of authoritative
 * onchain reads + reserve fee routing for operators / power users.
 *
 * Invariant: every value rendered here is read directly from a public view
 * function on `TimeArena` / vault contracts (legacy `TimeCurve` ABI where env aliases).
 * We never derive
 * values that the contract does not expose, so this page can be used to
 * verify the simple / arena views. **TOTAL RAISE / TOTAL USD** mirror the
 * former Arena hero (same formatting on `totalRaised()` wei). **Live buys** use the indexer read-model
 * (same cards as the former Arena rail) alongside these RPC reads. The WarBow
 * refresh helper uses the indexer only as an offline candidate list for calldata ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160)); writes remain plain RPC.
 */

const ARENA_VAULT_LABELS = [
  "Active podium (40%)",
  "Seed podium (30%)",
  "Admin sell vault (30%)",
] as const;

/** Last good TimeCurveLiveCharts inputs — avoids mount/unmount flicker while RPC refetch errors. */
type ProtocolStickyChartsPayload = {
  saleStartSec: number;
  deadlineSec: number;
  initialMinBuy: string;
  growthRateWad: string;
  basePriceWad: string;
  dailyIncrementWad: string;
};

export function TimeCurveProtocolPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);

  const tc = addresses.timeCurve;
  const {
    protocolReading: reading,
    charmPriceRows,
    latchedAcceptedAssetAddr,
    heroChainNowSec,
    refetchProtocolReads,
  } = useTimeCurveProtocolData();

  const cl8yUsd = useProtocolCl8yUsdSpotPrice(latchedAcceptedAssetAddr);

  const get = (i: number) => reading[i];

  const { data: latestBlock } = useLatestBlock();
  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const blockChainSec = blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000;
  const ledgerSecInt = Math.floor(blockChainSec);

  const [displayTick, setDisplayTick] = useState(0);
  const [blockSyncWallMs, setBlockSyncWallMs] = useState(() => Date.now());

  useEffect(() => {
    if (latestBlock?.timestamp !== undefined) {
      setBlockSyncWallMs(Date.now());
    }
  }, [latestBlock?.number, latestBlock?.timestamp]);

  useEffect(() => {
    const id = window.setInterval(() => setDisplayTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, []);

  const effectiveLedgerSec = useMemo(() => {
    void displayTick;
    if (blockTimestampSec !== undefined) {
      return blockTimestampSec + (Date.now() - blockSyncWallMs) / 1000;
    }
    return Date.now() / 1000;
  }, [blockTimestampSec, blockSyncWallMs, displayTick]);

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  const liveBuys = useTimecurveProtocolLiveBuys();
  const { isOffline } = useIndexerConnectivity();

  const totalRaisedRow = get(3);
  const totalRaiseSerialized =
    totalRaisedRow?.status === "success" && totalRaisedRow.result !== undefined
      ? String(totalRaisedRow.result as bigint)
      : undefined;
  const totalRaiseObservedAtMs = useLastObservedAtForSerializedDep(totalRaiseSerialized);
  const totalRaiseUsdFreshness = useRelativeFreshnessLabel(totalRaiseObservedAtMs);

  const totalRaiseHeroDisplay = useMemo(() => {
    if (!totalRaiseSerialized) {
      return { cl8y: "—" as const, usd: "—" as const };
    }
    const cl8y = formatTotalRaiseHeroDisplayFromWei(BigInt(totalRaiseSerialized), 18).cl8y;
    const usd =
      cl8yWeiToUsdDisplay(BigInt(totalRaiseSerialized), cl8yUsd.usdPerCl8y) ?? "—";
    return { cl8y, usd };
  }, [totalRaiseSerialized, cl8yUsd.usdPerCl8y]);

  const buyEnvelopeParamsWire = useMemo((): EnvelopeCurveParamsWire | null => {
    const saleStartRow = get(0);
    const initialMinBuyRow = get(9);
    const growthRateRow = get(10);
    if (
      saleStartRow?.status !== "success" ||
      initialMinBuyRow?.status !== "success" ||
      growthRateRow?.status !== "success" ||
      charmPriceRows?.[0]?.status !== "success" ||
      charmPriceRows?.[1]?.status !== "success"
    ) {
      return null;
    }
    const start = Number(saleStartRow.result as bigint);
    if (start <= 0) {
      return null;
    }
    return {
      saleStartSec: start,
      charmEnvelopeRefWad: (initialMinBuyRow.result as bigint).toString(),
      growthRateWad: (growthRateRow.result as bigint).toString(),
      basePriceWad: (charmPriceRows[0].result as bigint).toString(),
      dailyIncrementWad: (charmPriceRows[1].result as bigint).toString(),
    };
  }, [reading, charmPriceRows]);

  const tickerEnvelopeParams = useMemo(
    () => envelopeCurveParamsFromWire(buyEnvelopeParamsWire),
    [buyEnvelopeParamsWire],
  );

  const cl8ySpendBounds = useMemo(() => {
    const minBuy = get(6);
    const maxBuy = get(7);
    if (minBuy?.status !== "success" || maxBuy?.status !== "success") {
      return null;
    }
    const minS = minCl8ySpendBroadcastHeadroom(minBuy.result as bigint);
    const maxS = maxBuy.result as bigint;
    if (minS > maxS) {
      return null;
    }
    return { minS, maxS };
  }, [reading]);

  const liveBuysPollLastOk = liveBuys.buys === null ? null : liveBuys.indexerNote === null;

  const protocolRawAccordion = useTimecurveProtocolRawAccordion();

  const readingsForCharts = reading;
  const chartsGateSaleStartRow = readingsForCharts[0];
  const chartsGateDeadlineRow = readingsForCharts[1];
  const chartsGateEndedRow = readingsForCharts[2];

  const protocolChartsPhaseGate = derivePhase({
    hasCoreData: readingsForCharts.length > 0 && Boolean(tc),
    ended:
      chartsGateEndedRow?.status === "success"
        ? (chartsGateEndedRow.result as boolean)
        : undefined,
    saleStartSec:
      chartsGateSaleStartRow?.status === "success"
        ? Number(chartsGateSaleStartRow.result as bigint)
        : undefined,
    deadlineSec:
      chartsGateDeadlineRow?.status === "success"
        ? Number(chartsGateDeadlineRow.result as bigint)
        : undefined,
    ledgerSecInt: phaseLedgerSecInt,
  });

  const protocolLiveChartsFresh =
    Boolean(tc) &&
    protocolChartsPhaseGate === "saleActive" &&
    chartsGateDeadlineRow?.status === "success" &&
    chartsGateSaleStartRow?.status === "success" &&
    readingsForCharts[9]?.status === "success" &&
    readingsForCharts[10]?.status === "success" &&
    charmPriceRows?.[0]?.status === "success" &&
    charmPriceRows?.[1]?.status === "success";

  const [protocolChartsSticky, setProtocolChartsSticky] = useState<
    ProtocolStickyChartsPayload | null
  >(null);

  useEffect(() => {
    if (!tc) {
      setProtocolChartsSticky(null);
    }
  }, [tc]);

  useEffect(() => {
    if (!protocolLiveChartsFresh) {
      return;
    }
    setProtocolChartsSticky({
      saleStartSec: Number(chartsGateSaleStartRow!.result as bigint),
      deadlineSec: Number(chartsGateDeadlineRow!.result as bigint),
      initialMinBuy: (readingsForCharts[9]!.result as bigint).toString(),
      growthRateWad: (readingsForCharts[10]!.result as bigint).toString(),
      basePriceWad: (charmPriceRows![0]!.result as bigint).toString(),
      dailyIncrementWad: (charmPriceRows![1]!.result as bigint).toString(),
    });
  }, [protocolLiveChartsFresh, chartsGateSaleStartRow, chartsGateDeadlineRow, charmPriceRows, readingsForCharts]);

  useEffect(() => {
    if (
      chartsGateSaleStartRow?.status !== "success" ||
      chartsGateDeadlineRow?.status !== "success" ||
      chartsGateEndedRow?.status !== "success"
    ) {
      return;
    }
    const phase = derivePhase({
      hasCoreData: true,
      ended: chartsGateEndedRow.result as boolean,
      saleStartSec: Number(chartsGateSaleStartRow.result as bigint),
      deadlineSec: Number(chartsGateDeadlineRow.result as bigint),
      ledgerSecInt: phaseLedgerSecInt,
    });
    if (phase !== "saleActive") {
      setProtocolChartsSticky(null);
    }
  }, [chartsGateSaleStartRow, chartsGateDeadlineRow, chartsGateEndedRow, phaseLedgerSecInt]);

  if (!tc) {
    return (
      <div className="page timecurve-protocol-page">
        <TimeCurveSubnav active="protocol" />
        <PageHero
          title="Protocol view"
          lede="Authoritative onchain reads for TimeCurve."
          badgeLabel="Protocol"
          badgeTone="info"
        />
        <PageSection title="Configuration missing">
          <StatusMessage variant="error">
            VITE_TIMECURVE_ADDRESS is not configured. Update <code>frontend/.env.local</code>.
          </StatusMessage>
        </PageSection>
      </div>
    );
  }

  const renderUnix = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <UnixTimestampDisplay raw={String(r.result as bigint)} />;
    }
    return "—";
  };
  const renderAmount = (i: number, decimals: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <AmountDisplay raw={String(r.result as bigint)} decimals={decimals} />;
    }
    return "—";
  };
  const renderInt = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return formatLocaleInteger(BigInt(r.result as bigint));
    }
    return "—";
  };
  const renderBool = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return String(r.result as boolean);
    }
    return "—";
  };
  const renderAddress = (i: number) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <MegaScannerAddressLink address={String(r.result) as HexAddress} />;
    }
    return "—";
  };

  const saleStartRow = get(0);
  const deadlineRow = get(1);
  const endedRow = get(2);
  const protocolPhase = derivePhase({
    hasCoreData: reading.length > 0,
    ended: endedRow?.status === "success" ? (endedRow.result as boolean) : undefined,
    saleStartSec:
      saleStartRow?.status === "success" ? Number(saleStartRow.result as bigint) : undefined,
    deadlineSec:
      deadlineRow?.status === "success" ? Number(deadlineRow.result as bigint) : undefined,
    ledgerSecInt: phaseLedgerSecInt,
  });
  const protocolPhaseBadge = phaseBadge(protocolPhase);

  const saleEnded =
    endedRow?.status === "success" ? (endedRow.result as boolean) : true;

  return (
    <div className="page timecurve-protocol-page">
      <TimeCurveSubnav active="protocol" />

      <PageHero
        title="Protocol view"
        lede="Raw, authoritative onchain reads for TimeCurve. Use this surface to verify what the simple and arena views show."
        badgeLabel={protocolPhaseBadge.label}
        badgeTone={protocolPhaseBadge.tone}
        badgeIconSrc={protocolPhaseBadge.iconSrc}
        coinSrc={DOUB_TOKEN_LOGO}
        coinAlt="DOUB token glyph"
        sceneSrc="/art/scenes/timecurve-protocol.jpg"
      />

      {protocolChartsSticky && protocolChartsPhaseGate === "saleActive" && (
        <TimeCurveLiveCharts
          saleActive
          saleStartSec={protocolChartsSticky.saleStartSec}
          deadlineSec={protocolChartsSticky.deadlineSec}
          nowSec={effectiveLedgerSec}
          initialMinBuy={protocolChartsSticky.initialMinBuy}
          growthRateWad={protocolChartsSticky.growthRateWad}
          basePriceWad={protocolChartsSticky.basePriceWad}
          dailyIncrementWad={protocolChartsSticky.dailyIncrementWad}
          decimals={18}
        />
      )}

      <PageSection
        title="Sale state (semilive reads)"
        spotlight
        badgeLabel="contract reads"
        badgeTone="info"
        lede='Onchain getters via JSON-RPC multicall (~1 s cadence while healthy). After transport errors or HTTP 429 the app backs off (~5 s → ~15 s → ~30 s, same tiers as indexer polling). Intermittent per-call multicall failures keep displaying the last successful row so sale state, total raise, live charts, and FeeRouter sinks do not flicker.'
      >
        <div className="timecurve-protocol-raise-card" aria-label="Total raised summary">
          <div className="timer-hero__raise-lines">
            <div className="timer-hero__total-raise">
              TOTAL RAISE: {totalRaiseHeroDisplay.cl8y} CL8Y
            </div>
            <div className="timer-hero__total-usd-block" title={PROTOCOL_CL8Y_USD_SPOT_TITLE}>
              <div className="timer-hero__total-usd timecurve-protocol__total-usd-row">
                <span>TOTAL USD: {totalRaiseHeroDisplay.usd}</span>
                <ProtocolInlineRefreshButton
                  ariaLabel="Refresh CL8Y USD price"
                  disabled={cl8yUsd.loading}
                  onClick={cl8yUsd.refresh}
                />
              </div>
              {totalRaiseUsdFreshness ? (
                <div className="timer-hero__total-usd-affordance">
                  CL8Y total seen {totalRaiseUsdFreshness}
                  {cl8yUsd.usdPerCl8y !== undefined
                    ? ` · 1 CL8Y ≈ $${cl8yUsd.usdPerCl8y.toLocaleString(undefined, { maximumFractionDigits: 6 })} (Kumbaya)`
                    : cl8yUsd.error
                      ? ` · ${cl8yUsd.error}`
                      : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <dl className="kv">
          <dt>{humanizeKvLabel("saleStart")}</dt>
          <dd>{renderUnix(0)}</dd>
          <dt>{humanizeKvLabel("deadline")}</dt>
          <dd>{renderUnix(1)}</dd>
          <dt>{humanizeKvLabel("ended")}</dt>
          <dd>{renderBool(2)}</dd>
          <dt>{humanizeKvLabel("totalRaised")}</dt>
          <dd>{renderAmount(3, 18)}</dd>
          <dt>{humanizeKvLabel("totalCharmWeight")}</dt>
          <dd>{renderAmount(4, 18)}</dd>
          <dt>{humanizeKvLabel("totalTokensForSale")}</dt>
          <dd>{renderAmount(5, 18)}</dd>
          <dt>{humanizeKvLabel("currentMinBuyAmount")}</dt>
          <dd>{renderAmount(6, 18)}</dd>
          <dt>{humanizeKvLabel("currentMaxBuyAmount")}</dt>
          <dd>{renderAmount(7, 18)}</dd>
          <dt>{humanizeKvLabel("currentPricePerCharmWad")}</dt>
          <dd>{renderAmount(8, 18)}</dd>
          <dt>{humanizeKvLabel("prizesDistributed")}</dt>
          <dd>{renderBool(21)}</dd>
        </dl>
      </PageSection>

      {protocolPhase !== "saleStartPending" && (
        <TimeCurveProtocolDoubProjectionSection
          totalRaisedSerialized={totalRaiseSerialized}
          cl8yUsd={cl8yUsd}
          totalTokensForSaleSerialized={
            get(5)?.status === "success" && get(5)!.result !== undefined
              ? String(get(5)!.result as bigint)
              : undefined
          }
          totalCharmWeightSerialized={
            get(4)?.status === "success" && get(4)!.result !== undefined
              ? String(get(4)!.result as bigint)
              : undefined
          }
          currentPricePerCharmSerialized={
            get(8)?.status === "success" && get(8)!.result !== undefined
              ? String(get(8)!.result as bigint)
              : undefined
          }
          readsPending={reading.length === 0}
        />
      )}

      <TimeCurveLiveBuysActivitySection
        recentBuys={liveBuys.buys}
        decimals={18}
        tickerEnvelopeParams={tickerEnvelopeParams}
        cl8ySpendBounds={cl8ySpendBounds}
        isOffline={isOffline}
        buyPollLastOk={liveBuysPollLastOk}
        buysNextOffset={liveBuys.buysNextOffset}
        loadingMoreBuys={liveBuys.loadingMoreBuys}
        buyPagesExpanded={liveBuys.hasExpandedBuyPages}
        onLoadMore={() => void liveBuys.handleLoadMoreBuys()}
      />

      <TimeCurveProtocolPlatformUsageSection isOffline={isOffline} />

      <TimeCurveProtocolDonatePoolsSection
        isOffline={isOffline}
        onOpenWalletProfile={onOpenWalletProfile}
      />

      <PageSection
        title="Immutable parameters"
        badgeLabel="constructor args"
        badgeTone="info"
        lede="These were fixed at deploy time and cannot change."
      >
        <dl className="kv">
          <dt>{humanizeKvLabel("initialMinBuy (envelope ref)")}</dt>
          <dd>{renderAmount(9, 18)}</dd>
          <dt>{humanizeKvLabel("growthRateWad")}</dt>
          <dd>
            {(() => {
              const r = get(10);
              return r?.status === "success" && r.result !== undefined
                ? formatCompactFromRaw(r.result as bigint, 18)
                : "—";
            })()}
          </dd>
          <dt>{humanizeKvLabel("timerExtensionSec")}</dt>
          <dd>{renderInt(11)}</dd>
          <dt>{humanizeKvLabel("initialTimerSec")}</dt>
          <dd>{renderInt(12)}</dd>
          <dt>{humanizeKvLabel("timerCapSec")}</dt>
          <dd>{renderInt(13)}</dd>
          <dt>{humanizeKvLabel("buyCooldownSec")}</dt>
          <dd>{renderInt(14)}</dd>
          <dt>{humanizeKvLabel("REFERRAL_EACH_BPS")}</dt>
          <dd>
            {(() => {
              const r = get(15);
              return r?.status === "success" && r.result !== undefined
                ? formatBpsAsPercent(Number(r.result))
                : "—";
            })()}
          </dd>
          <dt>{humanizeKvLabel("charmPrice basePriceWad")}</dt>
          <dd>
            {charmPriceRows?.[0]?.status === "success" && charmPriceRows[0].result !== undefined ? (
              <AmountDisplay raw={String(charmPriceRows[0].result)} decimals={18} />
            ) : (
              "—"
            )}
          </dd>
          <dt>{humanizeKvLabel("charmPrice dailyIncrementWad")}</dt>
          <dd>
            {charmPriceRows?.[1]?.status === "success" && charmPriceRows[1].result !== undefined ? (
              <AmountDisplay raw={String(charmPriceRows[1].result)} decimals={18} />
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </PageSection>

      <PageSection
        title="WarBow rule constants"
        badgeLabel="PvP rules"
        badgeTone="info"
        lede="Onchain caps that bound steal / guard / flag mechanics."
      >
        <dl className="kv">
          <dt>{humanizeKvLabel("WARBOW_FLAG_SILENCE_SEC")}</dt>
          <dd>{renderInt(24)}</dd>
          <dt>{humanizeKvLabel("WARBOW_FLAG_CLAIM_BP")}</dt>
          <dd>{renderInt(25)}</dd>
          <dt>{humanizeKvLabel("WARBOW_MAX_STEALS_PER_DAY")}</dt>
          <dd>{renderInt(26)}</dd>
          <dt>{humanizeKvLabel("WARBOW_STEAL_BURN_WAD")}</dt>
          <dd>{renderAmount(27, 18)}</dd>
          <dt>{humanizeKvLabel("WARBOW_GUARD_BURN_WAD")}</dt>
          <dd>{renderAmount(28, 18)}</dd>
          <dt>{humanizeKvLabel("WARBOW_REVENGE_WINDOW_SEC")}</dt>
          <dd>{renderInt(29)}</dd>
          <dt>{humanizeKvLabel("warbowPendingFlagOwner")}</dt>
          <dd>{renderAddress(22)}</dd>
          <dt>{humanizeKvLabel("warbowPendingFlagPlantAt")}</dt>
          <dd>{renderUnix(23)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="WarBow podium (governance)"
        badgeLabel="indexer + owner"
        badgeTone="info"
        lede="After `endSale`, the owner calls `finalizeWarbowPodium(first, second, third)` with live `battlePoints` ordering (GitLab #172). Load indexer reference candidates here; requires `VITE_INDEXER_URL` and a connected wallet on the build target chain for writes."
      >
        <TimeCurveProtocolWarbowRefreshSection
          timeCurve={tc}
          saleEnded={saleEnded}
          refetchParentReads={() => void refetchProtocolReads()}
        />
      </PageSection>

      <PageSection
        title="Wired contracts"
        badgeLabel="addresses"
        badgeTone="info"
        lede="Addresses that TimeCurve forwards to."
      >
        <dl className="kv">
          <dt>{humanizeKvLabel("acceptedAsset (CL8Y)")}</dt>
          <dd>{renderAddress(19)}</dd>
          <dt>{humanizeKvLabel("launchedToken")}</dt>
          <dd>{renderAddress(20)}</dd>
          <dt>{humanizeKvLabel("charmPrice")}</dt>
          <dd>{renderAddress(18)}</dd>
          <dt>{humanizeKvLabel("feeRouter")}</dt>
          <dd>{renderAddress(16)}</dd>
          <dt>{humanizeKvLabel("podiumPool")}</dt>
          <dd>{renderAddress(17)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Arena prize vaults"
        badgeLabel="Arena v2"
        badgeTone="info"
        lede="DOUB from each buy routes 40% active podium · 30% seed podium · 30% admin sell vault (onchain ArenaBuyRouting)."
      >
        <ul className="event-list">
          {ARENA_VAULT_LABELS.map((label) => (
            <li key={label}>
              <strong>{label}</strong>
            </li>
          ))}
        </ul>
        <ArenaVaultAddressesPanel />
      </PageSection>

      <RawDataAccordion {...protocolRawAccordion} />

      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
    </div>
  );
}

export default TimeCurveProtocolPage;
