// SPDX-License-Identifier: AGPL-3.0-only

import { memo } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import type { EnvelopeCurveParams } from "@/lib/timeCurveBuyDisplay";
import { LiveBuyRow } from "@/pages/timecurve/LiveBuyRow";
import type { WalletFormatShort } from "@/lib/addressFormat";

type Props = {
  buys: BuyItem[] | null;
  indexerNote: string | null;
  formatWallet: WalletFormatShort;
  /** Wall or ledger “now” for relative buy age. */
  nowUnixSec: number;
  /** When set, mini pie shows min–max spend band fill at buy time (needs `block_timestamp` on rows). */
  envelopeParams: EnvelopeCurveParams | null;
  onSelectBuy?: (buy: BuyItem) => void;
  onMore?: () => void;
};

export const TimerHeroLiveBuys = memo(function TimerHeroLiveBuys({
  buys,
  indexerNote,
  formatWallet,
  nowUnixSec,
  envelopeParams,
  onSelectBuy,
  onMore,
}: Props) {
  const rows = buys?.slice(0, 5) ?? [];

  return (
    <aside className="timer-hero__live" aria-label="Latest buys from indexer">
      <div className="timer-hero__live-head">
        <div className="timer-hero__live-title">Live buys</div>
        {onMore !== undefined && (
          <button type="button" className="timer-hero__live-more" onClick={onMore}>
            More
          </button>
        )}
      </div>
      {indexerNote !== null && indexerNote !== "" && (
        <p className="timer-hero__live-placeholder">{indexerNote}</p>
      )}
      {indexerNote === null && buys === null && (
        <p className="timer-hero__live-placeholder">Loading recent buys…</p>
      )}
      {indexerNote === null && buys !== null && rows.length === 0 && (
        <p className="timer-hero__live-placeholder">No buys indexed yet.</p>
      )}
      {rows.length > 0 && (
        <ul className="timer-hero__live-list">
          {rows.map((buy) => (
            <li key={`${buy.tx_hash}-${buy.log_index}`} className="timer-hero__live-li">
              <LiveBuyRow
                buy={buy}
                formatWallet={formatWallet}
                onSelectBuy={onSelectBuy}
                nowUnixSec={nowUnixSec}
                envelopeParams={envelopeParams}
                variant="hero"
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
});
