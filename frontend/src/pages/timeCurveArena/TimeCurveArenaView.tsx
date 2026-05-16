// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from "motion/react";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { PageHeroArcadeBanner, PageHeroHeading } from "@/components/ui/PageHero";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { indexerBaseUrl } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { TimeCurveSubnav } from "@/pages/timecurve/TimeCurveSubnav";
import { useArenaWarbowRankSfx } from "@/pages/timeCurveArena/useArenaWarbowRankSfx";
import { usePeerBuyHeadSfx } from "@/pages/timecurve/usePeerBuyHeadSfx";
import { TimerHeroLiveBuys } from "@/pages/timecurve/TimerHeroLiveBuys";
import { TimecurveBuyModals } from "@/pages/timecurve/TimecurveBuyModals";
import { WarbowHeroActions } from "./WarbowHeroActions";
import { useTimeCurveArenaModel } from "./useTimeCurveArenaModel";

const WARBOW_PARTICLE_ICONS = [
  { src: "/art/icons/warbow-particle-shield.png" },
  { src: "/art/icons/warbow-particle-bow.png" },
  { src: "/art/icons/warbow-particle-sword.png" },
  { src: "/art/icons/warbow-particle-bow.png" },
  { src: "/art/icons/warbow-particle-shield.png" },
  { src: "/art/icons/warbow-particle-sword.png" },
  { src: "/art/icons/warbow-particle-shield.png" },
  { src: "/art/icons/warbow-particle-bow.png" },
  { src: "/art/icons/warbow-particle-sword.png" },
  { src: "/art/icons/warbow-particle-bow.png" },
  { src: "/art/icons/warbow-particle-shield.png" },
  { src: "/art/icons/warbow-particle-sword.png" },
];

export function TimeCurveArenaView() {
  const props = useTimeCurveArenaModel();
  const { mismatch: chainMismatch } = useWalletTargetChainMismatch();
  const {
    address,
    buyEnvelopeParams,
    buyFeeRoutingEnabled,
    buyListModalOpen,
    buys,
    buysNextOffset,
    buysTotal,
    canDistributePrizesAsOwner,
    decimals,
    detailBuy,
    effectiveLedgerSec,
    ended,
    formatWallet,
    gasClaim,
    gasDistribute,
    guardUntilSec,
    guardedActive,
    handleLoadMoreBuys,
    hasRevengeOpen,
    indexerNote,
    isConnected,
    isWriting,
    loadingMoreBuys,
    openBuyListModal,
    pendingRevengeTargets,
    prefersReducedMotion,
    pvpErr,
    revengeDeadlineSec,
    revengeIndexerConfigured,
    runVoid,
    runWarBowGuard,
    runWarBowRevenge,
    runWarBowSteal,
    saleActive,
    saleEnded,
    secondaryButtonMotion,
    selectBuy,
    setBuyListModalOpen,
    setDetailBuy,
    setStealBypass,
    setStealBypassForVictim,
    stealBypass,
    stealBypassByVictim,
    stealHeroRows,
    attackerAtDailyStealCap,
    attackerStealsTodayBigInt,
    tc,
    timerExpiredAwaitingEnd,
    viewerBattlePoints,
    warbowBypassBurnWad,
    warbowGuardBurnWad,
    warbowMaxSteals,
    warbowRank,
  } = props;

  const onchainEnded = ended?.status === "success" && Boolean(ended.result);
  /** `saleEnded` OR `saleExpiredAwaitingEnd` — settlement CTAs surface without the removed standings rail (GitLab #188). */
  const showPostRoundSettlementPanel = saleEnded || timerExpiredAwaitingEnd;

  usePeerBuyHeadSfx({
    recentBuys: buys,
    walletAddress: address,
    reduceMotion: Boolean(prefersReducedMotion),
  });

  useArenaWarbowRankSfx({
    viewerConnected: Boolean(address),
    saleActive,
    warbowRank,
  });

  if (!tc) {
    return (
      <section className="page page--timecurve">
        <TimeCurveSubnav active="arena" />
        <header className="page-hero">
          <PageHeroHeading badgeLabel="Config needed" badgeTone="warning" />
        </header>
        <div className="timecurve-arena-missing-config__live-buys" data-testid="timecurve-arena-missing-config-buys">
          <TimerHeroLiveBuys
            buys={buys}
            indexedTotal={buysTotal}
            indexerNote={indexerNote}
            formatWallet={formatWallet}
            envelopeParams={buyEnvelopeParams}
            onSelectBuy={indexerBaseUrl() && indexerNote === null ? selectBuy : undefined}
            onMore={indexerBaseUrl() && indexerNote === null ? openBuyListModal : undefined}
          />
        </div>
        <div className="page-hero">
          <PageHeroArcadeBanner
            lede={
              <>
                Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see <code>.env.example</code>) to
                read live onchain sale state.
              </>
            }
            mascot={{
              src: "/art/cutouts/loading-mascot-circle.png",
              width: 192,
              height: 192,
              className: "cutout-decoration--sway",
            }}
          />
        </div>

        <TimecurveBuyModals
          listOpen={buyListModalOpen}
          onCloseList={() => setBuyListModalOpen(false)}
          detailBuy={detailBuy}
          onCloseDetail={() => setDetailBuy(null)}
          onSelectBuy={selectBuy}
          buys={buys}
          indexedTotal={buysTotal}
          buysLoading={buys === null && indexerNote === null}
          buysNextOffset={buysNextOffset}
          loadingMoreBuys={loadingMoreBuys}
          onLoadMoreBuys={handleLoadMoreBuys}
          address={address}
          formatWallet={formatWallet}
          decimals={decimals}
          envelopeParams={buyEnvelopeParams}
        />
      </section>
    );
  }

  return (
    <section className="page page--timecurve">
      <TimeCurveSubnav active="arena" />
      <div className="page-hero">
        <PageHeroArcadeBanner
          className="arcade-banner--warbow-gradient"
          coinSrc={null}
          particleIcons={WARBOW_PARTICLE_ICONS}
        >
          <ChainMismatchWriteBarrier testId="timecurve-arena-hero-warbow-chain-write-gate">
            <WarbowHeroActions
              saleActive={saleActive}
              saleEnded={saleEnded}
              isConnected={isConnected}
              address={address}
              formatWallet={formatWallet}
              warbowRank={warbowRank}
              viewerBattlePoints={viewerBattlePoints?.toString()}
              viewerStealsToday={attackerStealsTodayBigInt}
              warbowMaxStealsPerDay={warbowMaxSteals}
              stealHeroRows={stealHeroRows}
              attackerAtDailyStealCap={attackerAtDailyStealCap}
              stealBypass={stealBypass}
              setStealBypass={setStealBypass}
              stealBypassByVictim={stealBypassByVictim}
              setStealBypassForVictim={setStealBypassForVictim}
              runWarBowSteal={runWarBowSteal}
              runWarBowGuard={runWarBowGuard}
              runWarBowRevenge={runWarBowRevenge}
              guardedActive={guardedActive}
              guardChainNowSec={effectiveLedgerSec}
              guardUntilSec={guardUntilSec.toString()}
              hasRevengeOpen={hasRevengeOpen}
              pendingRevengeTargets={pendingRevengeTargets}
              revengeIndexerConfigured={revengeIndexerConfigured}
              revengeDeadlineSec={revengeDeadlineSec.toString()}
              warbowGuardBurnWad={warbowGuardBurnWad.toString()}
              warbowBypassBurnWad={warbowBypassBurnWad.toString()}
              buyFeeRoutingEnabled={buyFeeRoutingEnabled}
              isWriting={isWriting}
            />
          </ChainMismatchWriteBarrier>
          {pvpErr && <StatusMessage variant="error">{pvpErr}</StatusMessage>}
        </PageHeroArcadeBanner>
      </div>

      {showPostRoundSettlementPanel && (
        <ChainMismatchWriteBarrier testId="timecurve-arena-standings-chain-write-gate">
          <PageSection
            title={saleEnded ? "After sale actions" : "Round over — settle onchain"}
            badgeLabel={saleEnded ? "Redeem and settle" : "End sale first"}
            badgeTone="warning"
            lede={
              saleEnded
                ? "When the timer expires, use this panel to end the round, redeem charms, and settle the reserve podium pool."
                : "The live timer is past deadline. Call End sale first (any wallet may submit). Then redeem CHARM for DOUB and, when you are the owner with payouts enabled, distribute reserve prizes."
            }
          >
            <div className="timecurve-action-row">
              {!onchainEnded && (
                <motion.button
                  type="button"
                  className="btn-secondary btn-secondary--critical"
                  disabled={isWriting || chainMismatch}
                  data-testid="timecurve-arena-end-sale"
                  onClick={() => runVoid("endSale")}
                  {...secondaryButtonMotion}
                >
                  End sale
                </motion.button>
              )}
              <motion.button
                type="button"
                className="btn-secondary btn-secondary--priority"
                disabled={isWriting || chainMismatch || !onchainEnded}
                data-testid="timecurve-arena-redeem-charms"
                title={
                  !onchainEnded
                    ? "Run End sale onchain first — redeemCharms requires TimeCurve.ended()."
                    : undefined
                }
                onClick={() => runVoid("redeemCharms")}
                {...secondaryButtonMotion}
              >
                Redeem charms
              </motion.button>
              <motion.button
                type="button"
                className="btn-secondary btn-secondary--priority"
                disabled={isWriting || chainMismatch || !canDistributePrizesAsOwner || !onchainEnded}
                data-testid="timecurve-arena-distribute-prizes"
                title={
                  !onchainEnded
                    ? "Run End sale onchain first — distributePrizes requires TimeCurve.ended()."
                    : undefined
                }
                onClick={() => runVoid("distributePrizes")}
                {...secondaryButtonMotion}
              >
                Distribute prizes
              </motion.button>
            </div>
            {!onchainEnded && (
              <StatusMessage variant="muted">
                Redeem charms and Distribute prizes stay disabled until <strong>End sale</strong> succeeds —{" "}
                <code>redeemCharms</code> and <code>distributePrizes</code> require <code>ended == true</code> on{" "}
                <code>TimeCurve</code>.
              </StatusMessage>
            )}
            {(gasClaim !== undefined || gasDistribute !== undefined) && (
              <StatusMessage variant="muted">
                {gasClaim !== undefined && <>Estimated gas for redeem: ~{formatLocaleInteger(gasClaim)} units</>}
                {gasClaim !== undefined && gasDistribute !== undefined && <> · </>}
                {gasDistribute !== undefined && (
                  <>Estimated gas for prize distribution: ~{formatLocaleInteger(gasDistribute)} units</>
                )}
              </StatusMessage>
            )}
          </PageSection>
        </ChainMismatchWriteBarrier>
      )}

      {pvpErr && <StatusMessage variant="error">{pvpErr}</StatusMessage>}

      <TimecurveBuyModals
        listOpen={buyListModalOpen}
        onCloseList={() => setBuyListModalOpen(false)}
        detailBuy={detailBuy}
        onCloseDetail={() => setDetailBuy(null)}
        onSelectBuy={selectBuy}
        buys={buys}
        indexedTotal={buysTotal}
        buysLoading={buys === null && indexerNote === null}
        buysNextOffset={buysNextOffset}
        loadingMoreBuys={loadingMoreBuys}
        onLoadMoreBuys={handleLoadMoreBuys}
        address={address}
        formatWallet={formatWallet}
        decimals={decimals}
        envelopeParams={buyEnvelopeParams}
      />
    </section>
  );

}
