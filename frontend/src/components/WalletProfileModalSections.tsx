// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import type { ArenaWalletStats } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { CredTokenIcon } from "@/components/CredTokenIcon";
import { TokenLogo } from "@/components/TokenLogo";
import type { WalletProfileBalancesSnapshot } from "@/hooks/useWalletProfileBalances";
import { formatTimeBoosterPodiumSec } from "@/pages/arena/timeBoosterPodiumFormat";
import { usePodiumScoreClock } from "@/pages/arena/arenaSimplePodiumRanking";
import {
  CHARM_TOKEN_LOGO,
  CRED_TOKEN_LOGO,
  DOUB_TOKEN_LOGO,
  ETH_TOKEN_LOGO,
  USDM_TOKEN_LOGO,
} from "@/lib/tokenMedia";
import {
  formatWalletProfileRankLabel,
  formatWalletProfileIso8601,
  formatWalletProfileUnixSec,
  formatWalletProfileWinRate,
  walletProfileLevelLabel,
  walletProfilePodiumLabel,
} from "@/lib/walletProfileFormat";

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="wallet-profile-modal__stat">
      <span className="wallet-profile-modal__stat-label">{label}</span>
      <span className="wallet-profile-modal__stat-value">{children}</span>
    </li>
  );
}

function DoubAmount({ raw }: { raw: string }) {
  return <AmountDisplay raw={raw} decimals={18} valueMono={false} />;
}

function CredAmount({ raw }: { raw: string }) {
  return (
    <span className="token-amount token-amount--cred">
      <CredTokenIcon className="cred-token-icon" width={18} height={18} />
      <AmountDisplay raw={raw} decimals={18} valueMono={false} />
    </span>
  );
}

function TokenBalanceValue({
  logo,
  raw,
  decimals,
  symbol,
}: {
  logo: string;
  raw: bigint | undefined;
  decimals: number;
  symbol: string;
}) {
  if (raw === undefined) {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
  return (
    <span className="token-amount">
      <TokenLogo src={logo} width={18} height={18} />
      <AmountDisplay raw={String(raw)} decimals={decimals} valueMono={false} /> {symbol}
    </span>
  );
}

export function WalletProfileBalancesSection({
  balances,
}: {
  balances: WalletProfileBalancesSnapshot;
}) {
  return (
    <section className="wallet-profile-modal__section" data-testid="wallet-profile-balances">
      <h3 id="wallet-profile-balances">Wallet balances</h3>
      {balances.isLoading ? (
        <p className="wallet-profile-modal__empty">
          <EmptyDataPlaceholder>Loading balances…</EmptyDataPlaceholder>
        </p>
      ) : (
        <ul className="wallet-profile-modal__stats">
          <StatRow label="CHARM">
            <TokenBalanceValue logo={CHARM_TOKEN_LOGO} raw={balances.charmWad} decimals={18} symbol="CHARM" />
          </StatRow>
          <StatRow label="CRED">
            <TokenBalanceValue logo={CRED_TOKEN_LOGO} raw={balances.credWei} decimals={18} symbol="CRED" />
          </StatRow>
          <StatRow label="DOUB">
            <TokenBalanceValue logo={DOUB_TOKEN_LOGO} raw={balances.doubWei} decimals={18} symbol="DOUB" />
          </StatRow>
          <StatRow label="ETH">
            <TokenBalanceValue logo={ETH_TOKEN_LOGO} raw={balances.ethWei} decimals={18} symbol="ETH" />
          </StatRow>
          {balances.showUsdm ? (
            <StatRow label="USDM">
              <TokenBalanceValue logo={USDM_TOKEN_LOGO} raw={balances.usdmWei} decimals={18} symbol="USDM" />
            </StatRow>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function parseScoreUnixSec(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0") {
    return null;
  }
  try {
    const t = Number(BigInt(trimmed.split(".")[0]!));
    return Number.isFinite(t) ? t : null;
  } catch {
    const t = Math.floor(Number(trimmed));
    return Number.isFinite(t) ? t : null;
  }
}

function formatCurrentScoreValue(
  podium: string,
  score: string,
  nowUnixSec: number,
): ReactNode {
  switch (podium) {
    case "last_buy": {
      const buySec = parseScoreUnixSec(score);
      if (buySec === null) {
        return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
      }
      const delta = Math.max(0, Math.floor(nowUnixSec) - buySec);
      return <>{formatLocaleInteger(String(delta))}s ago</>;
    }
    case "time_booster":
      if (!score.trim() || score === "0") {
        return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
      }
      return <>+{formatTimeBoosterPodiumSec(BigInt(score))}</>;
    case "defended_streak":
      if (!score.trim() || score === "0") {
        return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
      }
      return <>{formatLocaleInteger(score)} sequential buys</>;
    case "warbow":
      if (!score.trim() || score === "0") {
        return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
      }
      return <>{formatLocaleInteger(score)} BP</>;
    default:
      return formatLocaleInteger(score);
  }
}

const CURRENT_SCORE_PODIUM_ORDER = [
  "last_buy",
  "warbow",
  "defended_streak",
  "time_booster",
] as const;

export function WalletProfileCurrentScoresSection({
  data,
  isLoading,
}: {
  data: ArenaWalletStats | undefined;
  isLoading: boolean;
}) {
  const nowUnixSec = usePodiumScoreClock(undefined);
  const rows = data?.current_scores ?? [];
  const rowsByPodium = new Map(rows.map((row) => [row.podium, row]));

  return (
    <section
      className="wallet-profile-modal__section"
      data-testid="wallet-profile-current-scores"
    >
      <h3 id="wallet-profile-current-scores">Current scores</h3>
      {isLoading ? (
        <p className="wallet-profile-modal__empty">
          <EmptyDataPlaceholder>Loading scores…</EmptyDataPlaceholder>
        </p>
      ) : (
        <ul className="wallet-profile-modal__score-list">
          {CURRENT_SCORE_PODIUM_ORDER.map((podiumKey) => {
            const row = rowsByPodium.get(podiumKey);
            if (!row) {
              return (
                <li key={podiumKey}>
                  {walletProfilePodiumLabel(podiumKey)} · <EmptyDataPlaceholder>—</EmptyDataPlaceholder>
                </li>
              );
            }
            return (
              <li key={podiumKey}>
                {walletProfilePodiumLabel(row.podium)} ·{" "}
                {formatCurrentScoreValue(row.podium, row.score, nowUnixSec)}
                {row.rank != null ? (
                  <>
                    {" "}
                    · {formatWalletProfileRankLabel(row.rank)}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatHighestScoreValue(podium: string, score: string): ReactNode {
  switch (podium) {
    case "last_buy":
      return (
        <>
          Peak CHARM <DoubAmount raw={score} />
        </>
      );
    case "time_booster":
      return <>Peak timer +{formatLocaleInteger(score)}s</>;
    case "defended_streak":
      return <>{formatLocaleInteger(score)} sequential buys</>;
    case "warbow":
      return <>{formatLocaleInteger(score)} BP</>;
    default:
      return formatLocaleInteger(score);
  }
}

export function WalletProfileOverviewSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-overview">Overview</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Buys">{formatLocaleInteger(data.buy_count)}</StatRow>
        <StatRow label="Epochs participated">{formatLocaleInteger(data.epochs_participated)}</StatRow>
        <StatRow label="First buy">{formatWalletProfileUnixSec(data.first_buy_at)}</StatRow>
        <StatRow label="Podium win rate">{formatWalletProfileWinRate(data.podium_win_rate)}</StatRow>
      </ul>
    </section>
  );
}

export function WalletProfilePodiumWinsSection({ data }: { data: ArenaWalletStats }) {
  const ranks = data.rank_distribution;
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-podium-wins">Podium wins</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Total won">
          <DoubAmount raw={data.total_won_doub} /> DOUB
        </StatRow>
        <StatRow label="1st / 2nd / 3rd">
          {formatLocaleInteger(ranks["1"] ?? "0")} / {formatLocaleInteger(ranks["2"] ?? "0")} /{" "}
          {formatLocaleInteger(ranks["3"] ?? "0")}
        </StatRow>
      </ul>
      {data.prizes_won.length === 0 ? (
        <p className="wallet-profile-modal__empty">
          <EmptyDataPlaceholder>No podium placements yet.</EmptyDataPlaceholder>
        </p>
      ) : (
        <ul className="wallet-profile-modal__prize-list">
          {data.prizes_won.map((p) => (
            <li key={`${p.podium}-${p.epoch}-${p.rank}`}>
              {formatWalletProfileRankLabel(p.rank)} · {walletProfilePodiumLabel(p.podium)} · epoch{" "}
              {formatLocaleInteger(p.epoch)} · <DoubAmount raw={p.amount_doub} /> DOUB
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WalletProfileSpendingSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-spending">Spending</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Total spent">
          <DoubAmount raw={data.total_spent_doub} /> DOUB
        </StatRow>
        <StatRow label="Average buy">
          <DoubAmount raw={data.average_buy_doub} /> DOUB
        </StatRow>
        <StatRow label="Largest buy">
          <DoubAmount raw={data.max_single_buy_doub} /> DOUB
        </StatRow>
      </ul>
    </section>
  );
}

export function WalletProfileXpSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-xp">XP / Level</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Level">{formatLocaleInteger(data.level)}</StatRow>
        <StatRow label="Total XP">{formatLocaleInteger(data.xp)}</StatRow>
      </ul>
    </section>
  );
}

const DEFAULT_LEVEL_HISTORY_LEVELS = ["1", "2", "3", "4", "5"] as const;

export function WalletProfileLevelHistorySection({ data }: { data: ArenaWalletStats }) {
  const history =
    data.level_history && data.level_history.length > 0
      ? data.level_history
      : DEFAULT_LEVEL_HISTORY_LEVELS.map((level) => ({ level, reached_at: null }));

  return (
    <section
      className="wallet-profile-modal__section"
      data-testid="wallet-profile-level-history"
    >
      <h3 id="wallet-profile-level-history">Level history</h3>
      <ul className="wallet-profile-modal__stats">
        {history.map((entry) => {
          const levelNum = Number.parseInt(entry.level, 10);
          const tierLabel = Number.isFinite(levelNum)
            ? walletProfileLevelLabel(levelNum)
            : entry.level;
          return (
            <StatRow key={entry.level} label={`Level ${entry.level} · ${tierLabel}`}>
              {formatWalletProfileIso8601(entry.reached_at)}
            </StatRow>
          );
        })}
      </ul>
    </section>
  );
}

export function WalletProfileWarbowSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-warbow">WarBow</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Steals">{formatLocaleInteger(data.warbow_steals)}</StatRow>
        <StatRow label="Guards">{formatLocaleInteger(data.warbow_guards)}</StatRow>
      </ul>
    </section>
  );
}

export function WalletProfileReferralsSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-referrals">Referrals</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="CRED earned from referrals">
          <CredAmount raw={data.referral_cred_earned} /> CRED
        </StatRow>
        <StatRow label="CRED claimed">
          <CredAmount raw={data.cred_claimed} /> CRED
        </StatRow>
      </ul>
    </section>
  );
}

export function WalletProfileFunFactsSection({ data }: { data: ArenaWalletStats }) {
  return (
    <section className="wallet-profile-modal__section">
      <h3 id="wallet-profile-fun-facts">Fun facts</h3>
      <ul className="wallet-profile-modal__stats">
        <StatRow label="Longest defended streak">
          {formatLocaleInteger(data.longest_defended_streak)} buys
        </StatRow>
      </ul>
      {data.highest_scores.length === 0 ? (
        <p className="wallet-profile-modal__empty">
          <EmptyDataPlaceholder>No peak scores recorded yet.</EmptyDataPlaceholder>
        </p>
      ) : (
        <ul className="wallet-profile-modal__score-list">
          {data.highest_scores.map((row) => (
            <li key={`${row.podium}-${row.epoch}`}>
              {walletProfilePodiumLabel(row.podium)} · epoch {formatLocaleInteger(row.epoch)} ·{" "}
              {formatHighestScoreValue(row.podium, row.score)}
              {row.rank != null ? (
                <>
                  {" "}
                  · placed {formatWalletProfileRankLabel(row.rank)}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WalletProfileStatsBody({
  data,
}: {
  data: ArenaWalletStats;
}) {
  return (
    <div className="wallet-profile-modal__sections">
      <WalletProfileOverviewSection data={data} />
      <WalletProfilePodiumWinsSection data={data} />
      <WalletProfileSpendingSection data={data} />
      <WalletProfileXpSection data={data} />
      <WalletProfileLevelHistorySection data={data} />
      <WalletProfileWarbowSection data={data} />
      <WalletProfileReferralsSection data={data} />
      <WalletProfileFunFactsSection data={data} />
    </div>
  );
}

export function WalletProfileLoadingState() {
  return (
    <p className="wallet-profile-modal__loading" aria-live="polite">
      <EmptyDataPlaceholder>Loading stats…</EmptyDataPlaceholder>
    </p>
  );
}

export function WalletProfileErrorState({ indexerUnset }: { indexerUnset: boolean }) {
  return (
    <p className="wallet-profile-modal__error" role="alert">
      <EmptyDataPlaceholder role="presentation">
        {indexerUnset
          ? "Indexer URL is not configured — wallet stats unavailable."
          : "Stats unavailable (indexer offline or empty)."}
      </EmptyDataPlaceholder>
    </p>
  );
}
