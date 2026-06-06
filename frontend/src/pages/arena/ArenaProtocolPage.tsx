// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from "react";
import { ARENA_CHARM_MAX_WAD, ARENA_CHARM_MIN_WAD } from "@/lib/arenaConstants";
import { minCl8ySpendBroadcastHeadroom } from "@/lib/timeArenaMinSpendHeadroom";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { MegaScannerAddressLink } from "@/components/MegaScannerAddressLink";
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
          title="Protocol view"
          lede="Authoritative onchain reads for TimeArena."
          badgeLabel="Protocol"
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
      return <MegaScannerAddressLink address={String(r.result) as HexAddress} />;
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

  return (
    <div className="page arena-protocol-page">
      <ArenaSubnav active="protocol" />

      <PageHero
        title="Protocol view"
        lede="Raw, authoritative onchain reads for TimeArena. Use this surface to verify what the simple and arena views show."
        badgeLabel={protocolPhaseBadge.label}
        badgeTone={protocolPhaseBadge.tone}
        badgeIconSrc={protocolPhaseBadge.iconSrc}
        coinSrc={DOUB_TOKEN_LOGO}
        coinAlt="DOUB token glyph"
        sceneSrc="/art/scenes/arena-protocol.jpg"
      />

      <PageSection
        title="Arena state (semilive reads)"
        spotlight
        badgeLabel="contract reads"
        badgeTone="info"
        lede="Onchain TimeArena getters via JSON-RPC multicall (~1 s cadence while healthy)."
      >
        <div className="arena-protocol-raise-card" aria-label="Total raised summary">
          <div className="timer-hero__raise-lines">
            <div className="timer-hero__total-raise">
              TOTAL RAISE: {totalRaiseHeroDisplay.doub} DOUB
            </div>
            <div className="timer-hero__total-usd-block" title={PROTOCOL_CL8Y_USD_SPOT_TITLE}>
              <div className="timer-hero__total-usd arena-protocol__total-usd-row">
                <span>TOTAL USD: {totalRaiseHeroDisplay.usd}</span>
                <ProtocolInlineRefreshButton
                  ariaLabel="Refresh DOUB USD price"
                  disabled={cl8yUsd.loading}
                  onClick={cl8yUsd.refresh}
                />
              </div>
              {totalRaiseUsdFreshness ? (
                <div className="timer-hero__total-usd-affordance">
                  DOUB total seen {totalRaiseUsdFreshness}
                  {cl8yUsd.usdPerCl8y !== undefined
                    ? ` · 1 DOUB ≈ $${cl8yUsd.usdPerCl8y.toLocaleString(undefined, { maximumFractionDigits: 6 })} (Kumbaya)`
                    : cl8yUsd.error
                      ? ` · ${cl8yUsd.error}`
                      : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <dl className="kv">
          <dt>{humanizeKvLabel("arenaStart")}</dt>
          <dd>{renderUnix(CORE.arenaStart)}</dd>
          <dt>{humanizeKvLabel("deadline")}</dt>
          <dd>{renderUnix(CORE.deadline)}</dd>
          <dt>{humanizeKvLabel("totalDoubRaised")}</dt>
          <dd>{renderAmount(CORE.totalDoubRaised, 18)}</dd>
          <dt>{humanizeKvLabel("charmPriceWad")}</dt>
          <dd>{renderAmount(CORE.charmPriceWad, 18)}</dd>
          <dt>{humanizeKvLabel("minCharmWad")}</dt>
          <dd>{renderAmount(CORE.minCharmWad, 18)}</dd>
          <dt>{humanizeKvLabel("maxCharmWad")}</dt>
          <dd>{renderAmount(CORE.maxCharmWad, 18)}</dd>
          <dt>{humanizeKvLabel("paused")}</dt>
          <dd>{renderBool(CORE.paused)}</dd>
        </dl>
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
        title="Timer parameters"
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
        lede="Addresses that TimeArena forwards to."
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

export default ArenaProtocolPage;
