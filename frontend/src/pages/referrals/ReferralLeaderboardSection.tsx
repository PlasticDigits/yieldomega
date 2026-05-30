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
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { truncateHexAddress } from "@/pages/referrals/referralAddressDisplay";
import { ReferralLeaderboardPagination } from "@/pages/referrals/ReferralLeaderboardPagination";

const REF_CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

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
      lede="Ranked by Play CRED earned from qualifying referred buys (indexed ReferralCredApplied). Guides who registered a code on ReferralRegistry appear as soon as that event is indexed—even before the first qualifying buy."
      cutout={{
        src: REF_CUT.tertiary,
        width: 108,
        height: 108,
        className: "referrals-leaderboard__cutout cutout-decoration--bob",
      }}
    >
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {initialLoading ? (
        <StatusMessage variant="muted">Loading leaderboard…</StatusMessage>
      ) : showSummary ? (
        <>
          <LeaderboardSummary globals={globals} topCredAbbrev={topCred.abbrev} />
          {showEmpty ? (
            <StatusMessage variant="muted">
              No indexed guide registrations or referral buys yet. Register a code (ReferralRegistry) or
              link buys (TimeArena ReferralCredApplied) to appear here.
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
        label="Codes registered (global)"
        value={formatLocaleInteger(globals?.totalCodesRegistered ?? 0n)}
      />
      <SummaryCell
        label="Recorded referral buys (global)"
        value={formatLocaleInteger(globals?.totalBuys ?? 0n)}
      />
      <SummaryCell label="Total guide CRED (global)" value={topCredAbbrev} />
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
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
                formatWallet={(addr, fb) => (addr ? truncateHexAddress(addr, 8, 6) : fb)}
                size={22}
              />
              <span>
                {formatLocaleInteger(row.codes_registered_count)} onchain{" "}
                {row.codes_registered_count === "1" ? "code" : "codes"} registered
                <br />
                {formatLocaleInteger(row.referred_buy_count)} recorded{" "}
                {row.referred_buy_count === "1" ? "buy" : "buys"} with this referrer code
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
