// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useArenaPlayerLevel } from "@/hooks/useArenaPlayerLevel";
import { ARENA_CHARM_MAX_WAD, ARENA_CHARM_MIN_WAD } from "@/lib/arenaConstants";
import type { ArenaFeatureKey } from "@/lib/arenaProgression";
import { FeatureMechanicModal } from "@/components/FeatureMechanicModal";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageHeroHeading } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, type HexAddress } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { humanizeKvLabel } from "@/lib/humanizeIdentifier";
import { ArenaLiveBuysActivitySection } from "@/pages/arena/ArenaLiveBuysActivitySection";
import { RawDataAccordion } from "@/pages/arena/ArenaSections";
import { ArenaProtocolDonatePoolsSection } from "@/pages/arena/ArenaProtocolDonatePoolsSection";
import { WalletProfileModal } from "@/components/WalletProfileModal";
import { derivePhase, ledgerSecIntForPhase, phaseBadge } from "@/pages/arena/arenaSimplePhase";
import { useArenaProtocolLiveBuys } from "@/pages/arena/useArenaProtocolLiveBuys";
import { useArenaProtocolRawAccordion } from "@/pages/arena/useArenaProtocolRawAccordion";
import { useArenaProtocolPodiumAudit } from "@/pages/arena/useArenaProtocolPodiumAudit";
import { useLastObservedAtForSerializedDep } from "@/lib/useLastObservedAtForSerializedDep";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";
import { cl8yWeiToUsdDisplay } from "@/lib/cl8ySpotUsdPrice";
import { PROTOCOL_CL8Y_USD_SPOT_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatTotalRaiseHeroDisplayFromWei } from "@/lib/arenaPageHelpers";
import { useProtocolCl8yUsdSpotPrice } from "@/hooks/useProtocolCl8yUsdSpotPrice";
import { ProtocolInlineRefreshButton } from "@/pages/arena/ProtocolInlineRefreshButton";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import { useArenaProtocolData } from "@/pages/arena/ArenaProtocolDataContext";
import { ArenaSimplePodiumSection } from "@/pages/arena/ArenaSimplePodiumSection";
import { usePodiumReads } from "@/pages/arena/usePodiumReads";
import { ARENA_V2_ADVANCED_CORE_ROW_INDICES as CORE } from "@/pages/arena/arenaV2AdvancedSessionBridge";

const ARENA_VAULT_LABELS = [
  "100% podium prize vaults",
  "25% per competitive track",
  "70% / 20% / 10% epoch tranches",
] as const;

const WAD = 10n ** 18n;

export function ArenaProtocolPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [featureModal, setFeatureModal] = useState<ArenaFeatureKey | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);
  const openFeatureHelp = useCallback((feature: ArenaFeatureKey) => {
    setFeatureModal(feature);
  }, []);

  const tc = addresses.timeArena;
  const { address: connectedAddress } = useAccount();
  const { protocolReading: reading, latchedAcceptedAssetAddr, heroChainNowSec } =
    useArenaProtocolData();
  const podiumReads = usePodiumReads(tc ?? undefined);
  const { levelBigint: playerLevelRaw } = useArenaPlayerLevel(connectedAddress);

  const cl8yUsd = useProtocolCl8yUsdSpotPrice(latchedAcceptedAssetAddr);
  const get = (i: number) => reading[i];

  const { data: latestBlock } = useLatestBlock();
  const blockTimestampSec =
    latestBlock?.timestamp !== undefined ? Number(latestBlock.timestamp) : undefined;
  const ledgerSecInt = Math.floor(
    blockTimestampSec !== undefined ? blockTimestampSec : Date.now() / 1000,
  );

  const phaseLedgerSecInt = useMemo(
    () =>
      ledgerSecIntForPhase({
        blockLedgerSecInt: ledgerSecInt,
        heroChainNowSec: heroChainNowSec,
      }),
    [ledgerSecInt, heroChainNowSec],
  );

  const liveBuys = useArenaProtocolLiveBuys();
  const { isOffline } = useIndexerConnectivity();

  const totalRaisedRow = get(CORE.totalDoubRaised);
  const totalRaiseSerialized =
    totalRaisedRow?.status === "success" && totalRaisedRow.result !== undefined
      ? String(totalRaisedRow.result as bigint)
      : undefined;
  const totalRaiseObservedAtMs = useLastObservedAtForSerializedDep(totalRaiseSerialized);
  const totalRaiseUsdFreshness = useRelativeFreshnessLabel(totalRaiseObservedAtMs);

  const totalRaiseHeroDisplay = useMemo(() => {
    if (!totalRaiseSerialized) {
      return { doub: "—" as const, usd: "—" as const };
    }
    const doub = formatTotalRaiseHeroDisplayFromWei(BigInt(totalRaiseSerialized), 18).cl8y;
    const usd = cl8yWeiToUsdDisplay(BigInt(totalRaiseSerialized), cl8yUsd.usdPerCl8y) ?? "—";
    return { doub, usd };
  }, [totalRaiseSerialized, cl8yUsd.usdPerCl8y]);

  const cl8ySpendBounds = useMemo(() => {
    const priceRow = reading[CORE.charmPriceWad];
    if (priceRow?.status !== "success") {
      return null;
    }
    const price = priceRow.result as bigint;
    const minS = minCl8ySpendBroadcastHeadroom((ARENA_CHARM_MIN_WAD * price) / WAD);
    const maxS = (ARENA_CHARM_MAX_WAD * price) / WAD;
    if (minS > maxS) {
      return null;
    }
    return { minS, maxS };
  }, [reading]);

  const protocolRawAccordion = useArenaProtocolRawAccordion();
  const podiumAudit = useArenaProtocolPodiumAudit(
    tc ?? undefined,
    podiumReads.data,
    podiumReads.indexerRows,
    heroChainNowSec,
  );
  const liveBuysPollLastOk = liveBuys.buys === null ? null : liveBuys.indexerNote === null;

  if (!tc) {
    return (
      <div className="page arena-protocol-page yga-secondary-page">
        <header className="page-hero">
          <PageHeroHeading title="AUDIT" badgeLabel="Read-only" badgeTone="info" />
        </header>
        <PageSection title="Configuration missing">
          <StatusMessage variant="error">
            VITE_TIME_ARENA_ADDRESS is not configured. Update <code>frontend/.env.local</code>.
          </StatusMessage>
        </PageSection>
      </div>
    );
  }

  const renderUnix = (i: number, compact = false) => {
    const r = get(i);
    if (r?.status === "success" && r.result !== undefined) {
      return <UnixTimestampDisplay raw={String(r.result as bigint)} compact={compact} />;
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
      return <AddressInline address={String(r.result) as HexAddress} tailHexDigits={6} size={18} />;
    }
    return "—";
  };

  const saleStartRow = get(CORE.arenaStart);
  const deadlineRow = get(CORE.deadline);
  const protocolPhase = derivePhase({
    hasCoreData: reading.length > 0,
    saleStartSec:
      saleStartRow?.status === "success" ? Number(saleStartRow.result as bigint) : undefined,
    deadlineSec:
      deadlineRow?.status === "success" ? Number(deadlineRow.result as bigint) : undefined,
    ledgerSecInt: phaseLedgerSecInt,
  });
  const protocolPhaseBadge = phaseBadge(protocolPhase);
  const stateCards = [
    {
      label: "Arena start",
      value: renderUnix(CORE.arenaStart, true),
      title: "Start timestamp. Arena remains live when unpaused; no sale-end redemption flow.",
    },
    {
      label: "Last Buy deadline",
      value: renderUnix(CORE.deadline, true),
      title: "Primary Last Buy timer deadline.",
    },
    {
      label: "DOUB / CHARM (effective)",
      value: renderAmount(CORE.charmPriceWad, 18),
      title:
        "Current DOUB per CHARM for DOUB buys: epoch TWAP anchor + ~10%/day growth until Last Buy hard reset ([#305](https://gitlab.com/PlasticDigits/yieldomega/-/issues/305)). CRED buys use flat 100 CRED/CHARM.",
    },
    {
      label: "CHARM band",
      value: (
        <span className="arena-protocol__stat-range">
          {renderAmount(CORE.minCharmWad, 18)}
          <span className="arena-protocol__stat-range-sep" aria-hidden="true">
            –
          </span>
          {renderAmount(CORE.maxCharmWad, 18)}
        </span>
      ),
      title: "Minimum and maximum CHARM weight per buy.",
    },
    {
      label: "Paused",
      value: renderBool(CORE.paused),
      title: "Operator pause gate. When false, Arena is live.",
    },
  ];

  return (
    <div className="page arena-protocol-page yga-secondary-page">
      <header className="page-hero">
        <PageHeroHeading
          title="AUDIT"
          badgeLabel={protocolPhaseBadge.label}
          badgeTone={protocolPhaseBadge.tone}
          badgeIconSrc={protocolPhaseBadge.iconSrc}
        />
      </header>

      <ArenaSimplePodiumSection
        podiumRows={podiumReads.data}
        podiumLoading={podiumReads.isLoading}
        podiumPayoutPreview={podiumReads.podiumPayoutPreview}
        decimals={18}
        address={connectedAddress}
        playerLevel={playerLevelRaw}
        recentBuys={liveBuys.buys}
        podiumNowUnixSec={heroChainNowSec}
        onOpenWalletProfile={onOpenWalletProfile}
        onFeatureHelp={openFeatureHelp}
      />

      <PageSection
        title="State deck"
        spotlight
        badgeLabel="RPC reads"
        badgeTone="info"
        actions={<span className="arena-protocol__cadence" title="JSON-RPC multicall cadence while healthy.">~1s</span>}
      >
        <div className="arena-protocol__state-grid">
          <article className="arena-protocol-raise-card" aria-label="Total raised summary">
            <span className="arena-protocol__stat-kicker">Total raised</span>
            <strong>{totalRaiseHeroDisplay.doub} DOUB</strong>
            <div className="timer-hero__total-usd-block" title={PROTOCOL_CL8Y_USD_SPOT_TITLE}>
              <div className="timer-hero__total-usd arena-protocol__total-usd-row">
                <span>{totalRaiseHeroDisplay.usd}</span>
                <ProtocolInlineRefreshButton
                  ariaLabel="Refresh DOUB USD price"
                  disabled={cl8yUsd.loading}
                  onClick={cl8yUsd.refresh}
                />
              </div>
              {totalRaiseUsdFreshness ? (
                <div className="timer-hero__total-usd-affordance">
                  Seen {totalRaiseUsdFreshness}
                  {cl8yUsd.usdPerCl8y !== undefined
                    ? ` · 1 DOUB ~$${cl8yUsd.usdPerCl8y.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                    : cl8yUsd.error
                      ? ` · ${cl8yUsd.error}`
                      : null}
                </div>
              ) : null}
            </div>
          </article>
          {stateCards.map((card) => (
            <article className="arena-protocol__stat-card" key={card.label} title={card.title}>
              <span className="arena-protocol__stat-kicker">{card.label}</span>
              <div className="arena-protocol__stat-value">{card.value}</div>
            </article>
          ))}
        </div>
      </PageSection>

      <ArenaLiveBuysActivitySection
        recentBuys={liveBuys.buys}
        recentActivity={liveBuys.activity}
        decimals={18}
        tickerEnvelopeParams={null}
        cl8ySpendBounds={cl8ySpendBounds}
        isOffline={isOffline}
        buyPollLastOk={liveBuysPollLastOk}
        buysNextOffset={liveBuys.buysNextOffset}
        loadingMoreBuys={liveBuys.loadingMoreBuys}
        buyPagesExpanded={liveBuys.hasExpandedBuyPages}
        onLoadMore={() => void liveBuys.handleLoadMoreBuys()}
        onOpenWalletProfile={onOpenWalletProfile}
      />

      <ArenaProtocolDonatePoolsSection
        isOffline={isOffline}
        onOpenWalletProfile={onOpenWalletProfile}
      />

      <PageSection
        title="Timer config"
        badgeLabel="onchain config"
        badgeTone="info"
      >
        <dl className="kv">
          <dt>{humanizeKvLabel("timerExtensionSec")}</dt>
          <dd>{renderInt(CORE.timerExtensionSec)}</dd>
          <dt>{humanizeKvLabel("timerCapSec")}</dt>
          <dd>{renderInt(CORE.timerCapSec)}</dd>
          <dt>{humanizeKvLabel("buyCooldownSec")}</dt>
          <dd>{renderInt(CORE.buyCooldownSec)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Wired contracts"
        badgeLabel="addresses"
        badgeTone="info"
      >
        <dl className="kv">
          <dt>{humanizeKvLabel("doub")}</dt>
          <dd>{renderAddress(CORE.doub)}</dd>
          <dt>{humanizeKvLabel("referralRegistry")}</dt>
          <dd>{renderAddress(CORE.referralRegistry)}</dd>
          <dt>{humanizeKvLabel("podiumVaults")}</dt>
          <dd>{renderAddress(CORE.podiumVaults)}</dd>
          <dt>{humanizeKvLabel("timeArenaBuyRouter")}</dt>
          <dd>{renderAddress(CORE.timeArenaBuyRouter)}</dd>
          <dt>{humanizeKvLabel("owner")}</dt>
          <dd>{renderAddress(CORE.owner)}</dd>
        </dl>
      </PageSection>

      <PageSection
        title="Arena prize vaults"
        badgeLabel="100% podiums"
        badgeTone="info"
      >
        <ul className="arena-protocol__routing-grid" title="Onchain ArenaBuyRouting: 100% to podium vaults — 25% per category, 70/20/10 across current and next two epochs.">
          {ARENA_VAULT_LABELS.map((label) => (
            <li key={label}>
              <strong>{label}</strong>
            </li>
          ))}
        </ul>
        <ArenaVaultAddressesPanel />
      </PageSection>

      <RawDataAccordion
        {...protocolRawAccordion}
        podiumAuditRows={podiumAudit.rows}
        podiumAuditEpochPlus1={podiumAudit.epochPlus1Label}
        podiumAuditEpochPlus2={podiumAudit.epochPlus2Label}
        buyRouting={podiumReads.buyRouting}
      />

      <WalletProfileModal address={profileAddress} onClose={() => setProfileAddress(null)} />
      <FeatureMechanicModal feature={featureModal} onClose={() => setFeatureModal(null)} />
    </div>
  );
}

export default ArenaProtocolPage;
