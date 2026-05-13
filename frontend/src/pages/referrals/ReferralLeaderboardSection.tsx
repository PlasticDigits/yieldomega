// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { AddressInline } from "@/components/AddressInline";
import { formatAmountTriple, formatLocaleInteger } from "@/lib/formatAmount";
import {
  fetchReferralReferrerLeaderboard,
  type ReferralReferrerLeaderboardItem,
} from "@/lib/indexerApi";
import { PLACEHOLDER_CUTOUTS_BY_SLUG } from "@/lib/surfaceContent";
import { truncateHexAddress } from "@/pages/referrals/referralAddressDisplay";

const REF_CUT = PLACEHOLDER_CUTOUTS_BY_SLUG.referrals;

type Props = { className?: string };

export function ReferralLeaderboardSection({ className }: Props) {
  const { address } = useAccount();
  const [items, setItems] = useState<ReferralReferrerLeaderboardItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    void fetchReferralReferrerLeaderboard(20, 0).then(
      (page) => {
        if (!cancelled) {
          if (!page) {
            setItems([]);
            setErr("Leaderboard is unavailable right now. Try again in a moment.");
          } else {
            setItems(page.items);
          }
        }
      },
      () => {
        if (!cancelled) {
          setItems([]);
          setErr("Could not load referral leaderboard.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboard = useMemo(() => {
    if (!items) {
      return { rows: [], totalBuys: 0n, totalCharmWad: 0n };
    }
    return items.reduce(
      (acc, it) => {
        acc.rows.push({
          ...it,
          amount: formatAmountTriple(BigInt(it.total_referrer_charm_wad), 18),
          isYou: address?.toLowerCase() === it.referrer.toLowerCase(),
        });
        acc.totalBuys += BigInt(it.referred_buy_count);
        acc.totalCharmWad += BigInt(it.total_referrer_charm_wad);
        return acc;
      },
      {
        rows: [] as Array<
          ReferralReferrerLeaderboardItem & {
            amount: ReturnType<typeof formatAmountTriple>;
            isYou: boolean;
          }
        >,
        totalBuys: 0n,
        totalCharmWad: 0n,
      },
    );
  }, [items, address]);

  const topCharm = formatAmountTriple(leaderboard.totalCharmWad, 18);

  return (
    <PageSection
      className={className}
      title="Referrer leaderboard"
      badgeLabel="Referrers"
      badgeTone="live"
      lede="Ranked by total referrer CHARM from qualifying referral purchases. No synthetic points."
      cutout={{
        src: REF_CUT.tertiary,
        width: 108,
        height: 108,
        className: "referrals-leaderboard__cutout cutout-decoration--bob",
      }}
    >
      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {!items ? (
        <StatusMessage variant="muted">Loading leaderboard…</StatusMessage>
      ) : items.length === 0 ? (
        <StatusMessage variant="muted">
          No referral activity in the leaderboard yet — it fills in as referrers earn CHARM from linked buys.
        </StatusMessage>
      ) : (
        <>
          <div className="referrals-leaderboard__summary" aria-label="Referral leaderboard totals">
            <div>
              <span>Recorded referral buys</span>
              <strong>{formatLocaleInteger(leaderboard.totalBuys)}</strong>
            </div>
            <div>
              <span>Total referrer CHARM</span>
              <strong>{topCharm.abbrev}</strong>
            </div>
          </div>
          <ol className="referrals-leaderboard-list">
            {leaderboard.rows.map((row) => (
              <li
                key={row.referrer}
                className={[
                  "referrals-leaderboard-row",
                  row.rank === 1 ? "referrals-leaderboard-row--first" : "",
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
                    {formatLocaleInteger(row.referred_buy_count)} recorded{" "}
                    {row.referred_buy_count === "1" ? "buy" : "buys"} using this code
                  </span>
                </div>
                <div className="referrals-leaderboard-row__score">
                  <strong>{row.amount.abbrev}</strong>
                  <span>CHARM</span>
                  <small>{row.amount.decimal}</small>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </PageSection>
  );
}
