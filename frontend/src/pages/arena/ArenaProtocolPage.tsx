// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from "react";
import { ARENA_CHARM_MAX_WAD, ARENA_CHARM_MIN_WAD } from "@/lib/arenaConstants";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PageHero } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, type HexAddress } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { humanizeKvLabel } from "@/lib/humanizeIdentifier";
import { DOUB_TOKEN_LOGO } from "@/lib/tokenMedia";
import { ArenaLiveBuysActivitySection } from "@/pages/arena/ArenaLiveBuysActivitySection";
import { RawDataAccordion } from "@/pages/arena/ArenaSections";
import { ArenaSubnav } from "@/pages/arena/ArenaSubnav";
import { ArenaProtocolDonatePoolsSection } from "@/pages/arena/ArenaProtocolDonatePoolsSection";
import { WalletProfileModal } from "@/components/WalletProfileModal";
import { derivePhase, ledgerSecIntForPhase, phaseBadge } from "@/pages/arena/arenaSimplePhase";
import { useArenaProtocolLiveBuys } from "@/pages/arena/useArenaProtocolLiveBuys";
import { useArenaProtocolRawAccordion } from "@/pages/arena/useArenaProtocolRawAccordion";
import { useLastObservedAtForSerializedDep } from "@/lib/useLastObservedAtForSerializedDep";
import { useRelativeFreshnessLabel } from "@/lib/useRelativeFreshnessLabel";
import { cl8yWeiToUsdDisplay } from "@/lib/cl8ySpotUsdPrice";
import { PROTOCOL_CL8Y_USD_SPOT_TITLE } from "@/lib/cl8yUsdEquivalentDisplay";
import { formatTotalRaiseHeroDisplayFromWei } from "@/lib/arenaPageHelpers";
import { useProtocolCl8yUsdSpotPrice } from "@/hooks/useProtocolCl8yUsdSpotPrice";
import { ProtocolInlineRefreshButton } from "@/pages/arena/ProtocolInlineRefreshButton";
import { useLatestBlock } from "@/providers/LatestBlockContext";
import { useArenaProtocolData } from "@/pages/arena/ArenaProtocolDataContext";

const ARENA_VAULT_LABELS = [
  "Active podium (40%)",
  "Seed podium (30%)",
  "Admin sell vault (30%)",
] as const;

const ARENA_AUDIT_DECISIONS = [
  {
    eyebrow: "VERIFY",
    value: "State",
    title: "Contract reads: pause status, Last Buy deadline, CHARM band, and DOUB total raised.",
  },
  {
    eyebrow: "TRACE",
    value: "Routing",
    title: "ArenaBuyRouting sends DOUB buys to active podiums, seed podiums, and AdminSellVault.",
  },
  {
    eyebrow: "WATCH",
    value: "Actions",
    title: "Indexer activity covers buys plus WarBow steal, guard, and revenge events when available.",
  },
] as const;

const WAD = 10n ** 18n;

/** Indices into {@link mapArenaV2AdvancedCoreRows} output. */
const CORE = {
  arenaStart: 0,
  deadline: 1,
  totalDoubRaised: 2,
  minCharmWad: 4,
  maxCharmWad: 5,
  charmPriceWad: 7,
  doub: 8,
  referralRegistry: 10,
  timerExtensionSec: 13,
  timerCapSec: 15,
  paused: 19,
  podiumVaults: 21,
  buyCooldownSec: 23,
  timeArenaBuyRouter: 24,
  owner: 26,
} as const;

export function ArenaProtocolPage() {
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const onOpenWalletProfile = useCallback((addr: string) => setProfileAddress(addr), []);

  const tc = addresses.timeArena;
  const { protocolReading: reading, latchedAcceptedAssetAddr, heroChainNowSec } =
    useArenaProtocolData();

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
    const priceRow = get(CORE.charmPriceWad);
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
  const liveBuysPollLastOk = liveBuys.buys === null ? null : liveBuys.indexerNote === null;

  if (!tc) {
    return (
      <div className="page arena-protocol-page">
        <ArenaSubnav active="protocol" />
        <PageHero
          title="AUDIT"
          lede="Operator reads for TimeArena state, vault routing, and indexed actions."
          badgeLabel="Read-only"
          badgeTone="info"
        />
        <PageSection title="Configuration missing">
          <StatusMessage variant="error">
            VITE_TIME_ARENA_ADDRESS is not configured. Update <code>frontend/.env.local</code>.
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
      value: renderUnix(CORE.arenaStart),
      title: "Start timestamp. Arena remains live when unpaused; no sale-end redemption flow.",
    },
    {
      label: "Last Buy deadline",
      value: renderUnix(CORE.deadline),
      title: "Primary Last Buy timer deadline.",
    },
    {
      label: "CHARM price",
      value: renderAmount(CORE.charmPriceWad, 18),
      title: "Flat DOUB per CHARM rate from TimeArena.",
    },
    {
      label: "CHARM band",
      value: (
        <>
          {renderAmount(CORE.minCharmWad, 18)} - {renderAmount(CORE.maxCharmWad, 18)}
        </>
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
    <div className="page arena-protocol-page">
      <ArenaSubnav active="protocol" />

      <PageHero
        title="AUDIT"
        lede="Read-only operator console for TimeArena state, vault routing, and indexed actions."
        badgeLabel={protocolPhaseBadge.label}
        badgeTone={protocolPhaseBadge.tone}
        badgeIconSrc={protocolPhaseBadge.iconSrc}
        coinSrc={DOUB_TOKEN_LOGO}
        coinAlt="DOUB token glyph"
        sceneSrc="/art/scenes/arena-protocol.jpg"
      >
        <span className="arena-protocol__hero-pill" title="This route exposes reads and the donation sponsorship action only.">
          Operator
        </span>
        <span className="arena-protocol__hero-pill" title="TimeArena contracts remain authoritative; indexer rows are mirrors.">
          Onchain first
        </span>
        <span className="arena-protocol__hero-pill" title="Wallet profiles open in-app; contract addresses open explorer links.">
          Profile + explorer
        </span>
      </PageHero>

      <div className="arena-protocol__decision-grid" aria-label="AUDIT priorities">
        {ARENA_AUDIT_DECISIONS.map((item) => (
          <article className="arena-protocol__decision-card" key={item.eyebrow} title={item.title}>
            <span>{item.eyebrow}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

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
              <strong>{card.value}</strong>
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
        badgeLabel="40/30/30"
        badgeTone="info"
      >
        <ul className="arena-protocol__routing-grid" title="Onchain ArenaBuyRouting: 40% active podium, 30% seed podium, 30% admin sell vault.">
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

export default ArenaProtocolPage;
