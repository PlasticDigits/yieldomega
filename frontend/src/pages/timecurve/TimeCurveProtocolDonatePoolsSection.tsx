// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { AmountDisplay } from "@/components/AmountDisplay";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { ChainMismatchWriteBarrier } from "@/components/ChainMismatchWriteBarrier";
import { indexerBaseUrl } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import { explorerTxUrl } from "@/lib/explorer";
import { formatRelativeFreshnessEnglish } from "@/lib/cl8yUsdEquivalentDisplay";
import { ProtocolInlineRefreshButton } from "@/pages/timecurve/ProtocolInlineRefreshButton";
import { useTimecurveProtocolDonatePools } from "@/pages/timecurve/useTimecurveProtocolDonatePools";

const DONATE_DISCLOSURE =
  "Donating to the pools makes YieldOmega prizes more exciting, but does not provide you with any benefit.";

type Props = {
  isOffline: boolean;
  onOpenWalletProfile?: (address: string) => void;
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

function formatDoubWad(raw: string | undefined): ReactNode {
  if (raw === undefined) {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
  try {
    return <AmountDisplay raw={raw} decimals={18} />;
  } catch {
    return <EmptyDataPlaceholder>—</EmptyDataPlaceholder>;
  }
}

export function TimeCurveProtocolDonatePoolsSection({ isOffline, onOpenWalletProfile }: Props) {
  const {
    timeArena,
    data,
    initialLoading,
    refreshing,
    indexerErr,
    loadIndexer,
    amountInput,
    setAmountInput,
    parsedAmountWei,
    doubBalanceWei,
    submitting,
    writeErr,
    writeOk,
    donate,
    isConnected,
  } = useTimecurveProtocolDonatePools();

  const indexerUnset = !indexerBaseUrl();
  const showIndexerPlaceholder = indexerUnset || Boolean(indexerErr) || (!initialLoading && !data);

  return (
    <PageSection
      title="Donate to pools"
      badgeLabel="prize sponsorship"
      badgeTone="info"
      lede="Permissionless DOUB top-up across all eight prize vaults (no platform take). History is indexer-backed."
      dataTestId="timecurve-protocol-donate-pools"
    >
      <StatusMessage variant="warning">{DONATE_DISCLOSURE}</StatusMessage>

      {indexerUnset ? (
        <p className="muted">
          Set <code>VITE_INDEXER_URL</code> to load donation totals and history.
        </p>
      ) : null}
      {isOffline ? (
        <p className="muted">Indexer offline · donation history may be stale or unavailable.</p>
      ) : null}

      <div className="donate-pools-stats">
        <div className="donate-pools-stats__row">
          <span className="donate-pools-stats__label">Total donated (network)</span>
          <span className="donate-pools-stats__value" data-testid="timecurve-protocol-donate-pools-total">
            {showIndexerPlaceholder ? (
              <EmptyDataPlaceholder>—</EmptyDataPlaceholder>
            ) : (
              formatDoubWad(data?.total_donated_doub_wad)
            )}
          </span>
          <ProtocolInlineRefreshButton
            ariaLabel="Refresh donation stats"
            disabled={refreshing}
            onClick={() => void loadIndexer()}
          />
        </div>
        {isConnected ? (
          <div className="donate-pools-stats__row">
            <span className="donate-pools-stats__label">Your donations</span>
            <span className="donate-pools-stats__value" data-testid="timecurve-protocol-donate-pools-yours">
              {showIndexerPlaceholder ? (
                <EmptyDataPlaceholder>—</EmptyDataPlaceholder>
              ) : (
                formatDoubWad(data?.donor_summary?.total_donated_doub_wad ?? "0")
              )}
            </span>
            {!showIndexerPlaceholder && data?.donor_summary ? (
              <span className="muted donate-pools-stats__meta">
                {formatCount(data.donor_summary.donation_count)} donation
                {data.donor_summary.donation_count === "1" ? "" : "s"}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <ChainMismatchWriteBarrier testId="timecurve-protocol-donate-pools-chain-write-gate">
        <div className="donate-pools-write">
          <label className="donate-pools-write__label" htmlFor="timecurve-protocol-donate-amount">
            DOUB amount
          </label>
          <input
            id="timecurve-protocol-donate-amount"
            className="donate-pools-write__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={!timeArena || submitting}
            data-testid="timecurve-protocol-donate-pools-amount"
          />
          {isConnected && doubBalanceWei != null ? (
            <p className="muted donate-pools-write__balance">
              Wallet balance: <AmountDisplay raw={String(doubBalanceWei)} decimals={18} /> DOUB
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn--primary donate-pools-write__cta"
            disabled={
              !isConnected ||
              !timeArena ||
              submitting ||
              parsedAmountWei == null ||
              parsedAmountWei <= 0n
            }
            onClick={() => void donate()}
            data-testid="timecurve-protocol-donate-pools-submit"
          >
            {submitting ? "Donating…" : "Donate to pools"}
          </button>
          {writeErr ? <p className="error-text">{writeErr}</p> : null}
          {writeOk ? <p className="success-text">{writeOk}</p> : null}
        </div>
      </ChainMismatchWriteBarrier>

      <div className="donate-pools-recent">
        <h3 className="donate-pools-recent__title">Recent donations</h3>
        {initialLoading ? <p className="muted">Loading donation history…</p> : null}
        {!initialLoading && showIndexerPlaceholder ? (
          <EmptyDataPlaceholder>
            {indexerErr ?? "Donation history unavailable."}
          </EmptyDataPlaceholder>
        ) : null}
        {!initialLoading && !showIndexerPlaceholder && data?.recent.length === 0 ? (
          <p className="muted">No donations indexed yet.</p>
        ) : null}
        {!showIndexerPlaceholder && data && data.recent.length > 0 ? (
          <ul className="donate-pools-recent__list" data-testid="timecurve-protocol-donate-pools-recent">
            {data.recent.map((row) => {
              const ts = row.block_timestamp ? Number(row.block_timestamp) : undefined;
              const relLabel =
                ts != null && Number.isFinite(ts)
                  ? formatRelativeFreshnessEnglish(ts * 1000, Date.now())
                  : null;
              return (
                <li key={`${row.tx_hash}-${row.donor}`} className="donate-pools-recent__item">
                  <div className="donate-pools-recent__row-main">
                    <AddressInline
                      address={row.donor}
                      tailHexDigits={4}
                      onOpenProfile={onOpenWalletProfile}
                    />
                    <span className="donate-pools-recent__amount">
                      {formatDoubWad(row.amount_doub_wad)} DOUB
                    </span>
                    {relLabel ? (
                      <span className="muted donate-pools-recent__time">{relLabel}</span>
                    ) : null}
                  </div>
                  <a
                    className="donate-pools-recent__tx"
                    href={explorerTxUrl(row.tx_hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </PageSection>
  );
}

export { DONATE_DISCLOSURE };
