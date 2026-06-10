// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState, type ReactNode } from "react";
import { ArenaWalletHelpModal } from "@/components/ArenaWalletHelpModal";
import { useAccount, useWriteContract } from "wagmi";
import { ArenaXpHero } from "@/components/ArenaXpHero";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import { PageSection } from "@/components/ui/PageSection";
import { useWalletStats } from "@/hooks/useWalletStats";
import { timeArenaReadAbi } from "@/lib/abis";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { canClaimCred } from "@/lib/arenaCharmCredClaim";
import {
  ARENA_LAST_BUY_WALLET_LOCK_LEVEL,
  isArenaLastBuyWalletSurfaceUnlocked,
} from "@/lib/arenaPageHelpers";
import type { BuyItem } from "@/lib/indexerApi";
import { walletCharmCredHelpCopy } from "@/pages/arena/walletCharmCredCopy";
import type { PodiumReadRow } from "@/pages/arena/usePodiumReads";

const ARENA_CHARM_CRED_STAT_SIGFIGS = 3;

type CharmCredRowProps = {
  label: string;
  title?: string;
  testId: string;
  children: ReactNode;
};

function CharmCredRow({ label, title, testId, children }: CharmCredRowProps) {
  return (
    <div className="arena-charm-cred-card__row" title={title}>
      <span className="arena-charm-cred-card__label">{label}</span>
      <span className="arena-charm-cred-card__value" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}

function ArenaCharmCredHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="arena-charm-cred-card__help"
      data-testid="arena-charm-cred-help"
      aria-label="Open wallet tutorial"
      onClick={onClick}
    >
      ?
    </button>
  );
}

function ArenaCharmCredCardHeading({ actions }: { actions: ReactNode }) {
  return (
    <div className="section-heading">
      <div className="section-heading__copy">
        <h2>YOUR WALLET</h2>
      </div>
      <div className="section-heading__actions">{actions}</div>
    </div>
  );
}

function wadAmount(raw: string | undefined): ReactNode {
  if (raw === undefined) return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  return (
    <AmountDisplay raw={raw} decimals={18} sigfigs={ARENA_CHARM_CRED_STAT_SIGFIGS} />
  );
}

type ArenaCharmCredCardProps = {
  recentBuys?: readonly BuyItem[] | null;
  podiumRows?: readonly PodiumReadRow[] | null;
};

export function ArenaCharmCredCard({
  recentBuys = null,
  podiumRows = null,
}: ArenaCharmCredCardProps = {}) {
  const [walletHelpOpen, setWalletHelpOpen] = useState(false);
  const walletHelpCopy = walletCharmCredHelpCopy();
  const { address, isConnected } = useAccount();
  const arena = addresses.timeArena;
  const indexerOn = Boolean(indexerBaseUrl());
  const { data: stats, isLoading, isFetching } = useWalletStats(address);
  const { writeContractAsync, isPending: claimWritePending } = useWriteContract();

  const lastBuyEpoch = useMemo(
    () => (stats?.last_buy_epoch !== undefined ? BigInt(stats.last_buy_epoch) : undefined),
    [stats?.last_buy_epoch],
  );

  const claimEpoch = useMemo(() => {
    const raw = stats?.claimable_cred_epoch;
    if (raw === undefined || raw === null || raw === "") return undefined;
    return BigInt(raw);
  }, [stats?.claimable_cred_epoch]);

  const claimPending = useMemo(() => {
    const raw = stats?.claimable_cred;
    if (raw === undefined) return undefined;
    return BigInt(raw);
  }, [stats?.claimable_cred]);

  const readPending = isLoading || isFetching;
  const credConfigured =
    stats?.cred_balance_wad !== undefined ||
    stats?.pending_cred_accrual !== undefined ||
    stats?.claimable_cred !== undefined;

  const claimReady = canClaimCred({
    address,
    claimEpoch,
    claimPending,
  });

  const walletHelpButton = (
    <ArenaCharmCredHelpButton onClick={() => setWalletHelpOpen(true)} />
  );

  const walletBuyKnown = !isConnected || stats !== undefined || !readPending;
  const walletSurfaceUnlocked =
    walletBuyKnown &&
    isArenaLastBuyWalletSurfaceUnlocked({
      walletConnected: isConnected,
      walletStats: stats,
      arenaUsers: { recentBuys, podiumRows },
    });
  const lockWalletSurface = walletBuyKnown && !walletSurfaceUnlocked;

  const walletBody = (
    <>
      <ArenaXpHero />
      <div className="arena-charm-cred-card__stats">
        <CharmCredRow
          label={
            lastBuyEpoch !== undefined
              ? `CHARM Epoch ${lastBuyEpoch.toString()}`
              : "CHARM Epoch —"
          }
          title="Your current Last Buy epoch CHARM weight; this is claim weight, not a leaderboard."
          testId="arena-charm-cred-charm"
        >
          {!isConnected ? (
            <EmptyDataPlaceholder>Connect wallet</EmptyDataPlaceholder>
          ) : readPending && !stats ? (
            <EmptyDataPlaceholder>Loading CHARM…</EmptyDataPlaceholder>
          ) : stats?.epoch_charm_wad && BigInt(stats.epoch_charm_wad) > 0n ? (
            wadAmount(stats.epoch_charm_wad)
          ) : (
            <EmptyDataPlaceholder>No CHARM this epoch yet</EmptyDataPlaceholder>
          )}
        </CharmCredRow>
        <CharmCredRow
          label="CRED Accrual"
          title="Current active-epoch CRED preview from DOUB buys."
          testId="arena-charm-cred-pending"
        >
          {!isConnected ? (
            <EmptyDataPlaceholder>Connect wallet</EmptyDataPlaceholder>
          ) : readPending && !stats ? (
            <EmptyDataPlaceholder>Loading pending CRED…</EmptyDataPlaceholder>
          ) : stats?.pending_cred_accrual && BigInt(stats.pending_cred_accrual) > 0n ? (
            wadAmount(stats.pending_cred_accrual)
          ) : (
            <EmptyDataPlaceholder>No pending CRED this epoch yet</EmptyDataPlaceholder>
          )}
        </CharmCredRow>
        <CharmCredRow
          label="CRED Balance"
          title="Play CRED token balance in your connected wallet."
          testId="arena-charm-cred-balance"
        >
          {!isConnected ? (
            <EmptyDataPlaceholder>Connect wallet</EmptyDataPlaceholder>
          ) : !credConfigured ? (
            <EmptyDataPlaceholder>CRED unavailable</EmptyDataPlaceholder>
          ) : readPending && !stats ? (
            <EmptyDataPlaceholder>Loading CRED…</EmptyDataPlaceholder>
          ) : stats?.cred_balance_wad && BigInt(stats.cred_balance_wad) > 0n ? (
            wadAmount(stats.cred_balance_wad)
          ) : (
            <EmptyDataPlaceholder>No CRED yet</EmptyDataPlaceholder>
          )}
        </CharmCredRow>
      </div>
      <ChainMismatchWriteBarrier>
        <button
          type="button"
          className="btn-primary arena-charm-cred-card__claim"
          data-testid="arena-charm-cred-claim"
          disabled={!claimReady || claimWritePending || !address}
          title={
            claimReady
              ? undefined
              : claimEpoch === undefined
                ? "Claim opens after the first Last Buy epoch ends."
                : "Nothing to claim from the last ended epoch."
          }
          onClick={() => {
            if (claimEpoch === undefined || !arena) return;
            void writeContractAsync({
              address: arena,
              abi: timeArenaReadAbi,
              functionName: "claimCred",
              args: [claimEpoch],
            });
          }}
        >
          Claim CRED
        </button>
      </ChainMismatchWriteBarrier>
      {!claimReady && isConnected && claimEpoch !== undefined ? (
        <p
          className="muted arena-charm-cred-card__claim-hint"
          title={`Claim checks ended epoch ${claimEpoch.toString()}; active-epoch CRED stays locked until a Last Buy hard reset.`}
        >
          Claim after epoch end.
        </p>
      ) : null}
    </>
  );

  if (!arena) {
    return (
      <>
        <PageSection
          title="YOUR WALLET"
          dataTestId="arena-charm-cred-card"
          className="arena-charm-cred-card"
          actions={walletHelpButton}
        >
          <p className="muted">Time Arena address is not configured (VITE_TIME_ARENA_ADDRESS).</p>
        </PageSection>
        <ArenaWalletHelpModal
          open={walletHelpOpen}
          title={walletHelpCopy.title}
          sections={walletHelpCopy.sections}
          onClose={() => setWalletHelpOpen(false)}
        />
      </>
    );
  }

  if (!indexerOn) {
    return (
      <>
        <PageSection
          title="YOUR WALLET"
          dataTestId="arena-charm-cred-card"
          className="arena-charm-cred-card"
          actions={walletHelpButton}
        >
          <p className="muted">Indexer URL is not configured — wallet stats unavailable.</p>
        </PageSection>
        <ArenaWalletHelpModal
          open={walletHelpOpen}
          title={walletHelpCopy.title}
          sections={walletHelpCopy.sections}
          onClose={() => setWalletHelpOpen(false)}
        />
      </>
    );
  }

  const walletHelpModal = (
    <ArenaWalletHelpModal
      open={walletHelpOpen}
      title={walletHelpCopy.title}
      sections={walletHelpCopy.sections}
      onClose={() => setWalletHelpOpen(false)}
    />
  );

  if (lockWalletSurface) {
    return (
      <>
        <LockedUntilLevel
          requiredLevel={ARENA_LAST_BUY_WALLET_LOCK_LEVEL}
          className="data-panel arena-charm-cred-card arena-charm-cred-card__gate arena-level-gate arena-level-gate--locked"
          testId="arena-charm-cred-card"
          overlayTestId="arena-charm-cred-lock"
          detail="Buy CHARM to activate this mechanic."
        >
          <ArenaCharmCredCardHeading actions={walletHelpButton} />
          {walletBody}
        </LockedUntilLevel>
        {walletHelpModal}
      </>
    );
  }

  return (
    <>
      <PageSection
        title="YOUR WALLET"
        dataTestId="arena-charm-cred-card"
        className="arena-charm-cred-card"
        actions={walletHelpButton}
      >
        {walletBody}
      </PageSection>
      {walletHelpModal}
    </>
  );
}
