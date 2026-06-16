// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { formatAmountTriple, formatLocaleInteger } from "@/lib/formatAmount";
import { fetchReferralReferrerLeaderboard, type ReferralReferrerLeaderboardItem } from "@/lib/indexerApi";
import {
  aggregateReferralLeaderboardGlobalTotalsFromItems,
  fetchReferralReferrerLeaderboardAllItems,
  parseReferralLeaderboardGlobalTotals,
  type ReferralLeaderboardGlobalTotals,
} from "@/lib/referralLeaderboardGlobals";
import {
  REFERRAL_LEADERBOARD_PAGE_SIZE,
  referralLeaderboardPageIndex,
  referralLeaderboardTotalPages,
} from "@/lib/referralLeaderboardPagination";
import { ReferralLeaderboardPagination } from "@/pages/referrals/ReferralLeaderboardPagination";

type Props = { className?: string };

export function ReferralLeaderboardSection({ className }: Props) {
  const { address } = useAccount();
  const [items, setItems] = useState<ReferralReferrerLeaderboardItem[] | null>(null);
  const [globals, setGlobals] = useState<ReferralLeaderboardGlobalTotals | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadPage = useCallback(async (pageOffset: number, cancelled: () => boolean) => {
    setPageLoading(true);
    setErr(null);
    try {
      const page = await fetchReferralReferrerLeaderboard(
        REFERRAL_LEADERBOARD_PAGE_SIZE,
        pageOffset,
      );
      if (cancelled()) {
        return;
      }
      if (!page) {
        setItems([]);
        setErr("Leaderboard is unavailable right now. Try again in a moment.");
        return;
      }
      setItems(page.items);
      const fromPage = parseReferralLeaderboardGlobalTotals(page);
      if (fromPage) {
        setGlobals(fromPage);
      } else if (pageOffset === 0) {
        const allItems = await fetchReferralReferrerLeaderboardAllItems();
        if (!cancelled() && allItems) {
          setGlobals(aggregateReferralLeaderboardGlobalTotalsFromItems(allItems));
        } else if (!cancelled()) {
          setGlobals({
            totalCodesRegistered: 0n,
            totalBuys: 0n,
            totalCredWad: 0n,
            totalReferrers: 0,
          });
        }
      }
    } catch {
      if (!cancelled()) {
        setItems([]);
        setErr("Could not load referral leaderboard.");
      }
    } finally {
      if (!cancelled()) {
        setPageLoading(false);
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPage(offset, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [offset, loadPage]);

  const currentPage = referralLeaderboardPageIndex(offset, REFERRAL_LEADERBOARD_PAGE_SIZE);
  const totalPages = referralLeaderboardTotalPages(
    globals?.totalReferrers ?? 0,
    REFERRAL_LEADERBOARD_PAGE_SIZE,
  );

  const rows = useMemo(() => {
    if (!items) {
      return [];
    }
    return items.map((it) => {
      const codes = it.codes_registered_count ?? "0";
      return {
        ...it,
        codes_registered_count: codes,
        amount: formatAmountTriple(BigInt(it.total_referrer_cred_wad), 18),
        isYou: address?.toLowerCase() === it.referrer.toLowerCase(),
      };
    });
  }, [items, address]);

  const topCred = formatAmountTriple(globals?.totalCredWad ?? 0n, 18);
  const showSummary = globals !== null && !initialLoading && !err;
  const showEmpty =
    showSummary && globals.totalReferrers === 0 && (items === null || items.length === 0);
  const showList = showSummary && items !== null && items.length > 0;

  const onPageChange = (page: number) => {
    const nextOffset = (page - 1) * REFERRAL_LEADERBOARD_PAGE_SIZE;
    if (nextOffset !== offset) {
      setOffset(nextOffset);
    }
  };

  return (
    <PageSection
      className={className}
      title="Guide leaderboard"
      badgeLabel="Guides"
      badgeTone="live"
    >
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {initialLoading ? (
        <StatusMessage variant="muted">Loading leaderboard…</StatusMessage>
      ) : showSummary ? (
        <>
          <LeaderboardSummary globals={globals} topCredAbbrev={topCred.abbrev} />
          {showEmpty ? (
            <StatusMessage variant="muted">
              No indexed guide registrations or referral buys yet.
            </StatusMessage>
          ) : null}
          {showList ? (
            <>
              <LeaderboardList pageLoading={pageLoading} rows={rows} currentPage={currentPage} />
              <ReferralLeaderboardPagination
                currentPage={currentPage}
                totalPages={totalPages}
                disabled={pageLoading}
                onPageChange={onPageChange}
              />
            </>
          ) : null}
        </>
      ) : null}
    </PageSection>
  );
}

function LeaderboardSummary({
  globals,
  topCredAbbrev,
}: {
  globals: ReferralLeaderboardGlobalTotals | null;
  topCredAbbrev: string;
}) {
  return (
    <div className="referrals-leaderboard__summary" aria-label="Referral leaderboard totals">
      <SummaryCell
        label="Codes"
        value={formatLocaleInteger(globals?.totalCodesRegistered ?? 0n)}
        title="Global ReferralCodeRegistered rows indexed for ReferralRegistry."
      />
      <SummaryCell
        label="Referred buys"
        value={formatLocaleInteger(globals?.totalBuys ?? 0n)}
        title="Global referred DOUB buys indexed from TimeArena ReferralCredApplied events."
      />
      <SummaryCell
        label="Guide CRED"
        value={topCredAbbrev}
        title="Total referrer-side Play CRED indexed from ReferralCredApplied."
      />
    </div>
  );
}

function SummaryCell({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <div title={title}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type Row = ReferralReferrerLeaderboardItem & {
  amount: ReturnType<typeof formatAmountTriple>;
  isYou: boolean;
};

function LeaderboardList({
  pageLoading,
  rows,
  currentPage,
}: {
  pageLoading: boolean;
  rows: Row[];
  currentPage: number;
}) {
  return (
    <div
      className={[
        "referrals-leaderboard-list-wrap",
        pageLoading ? "referrals-leaderboard-list-wrap--loading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={pageLoading}
    >
      {pageLoading ? (
        <StatusMessage variant="muted" className="referrals-leaderboard-list-wrap__loading">
          Loading page…
        </StatusMessage>
      ) : null}
      <ol className="referrals-leaderboard-list">
        {rows.map((row) => (
          <li
            key={row.referrer}
            className={[
              "referrals-leaderboard-row",
              row.rank === 1 && currentPage === 1 ? "referrals-leaderboard-row--first" : "",
              row.isYou ? "referrals-leaderboard-row--you" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="referrals-leaderboard-row__rank">#{row.rank}</span>
            <div className="referrals-leaderboard-row__identity">
              <AddressInline
                address={row.referrer}
                size={22}
              />
              <span>
                {formatLocaleInteger(row.codes_registered_count)}{" "}
                {row.codes_registered_count === "1" ? "code" : "codes"}
                <br />
                {formatLocaleInteger(row.referred_buy_count)} referred{" "}
                {row.referred_buy_count === "1" ? "buy" : "buys"}
              </span>
            </div>
            <div className="referrals-leaderboard-row__score">
              <strong>{row.amount.abbrev}</strong>
              <span>CRED</span>
              <small>{row.amount.decimal}</small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
