// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useEffect, useState } from "react";
import type { BuyItem } from "@/lib/indexerApi";
import type { EnvelopeCurveParamsWire } from "@/lib/timeCurveBuyDisplay";
import { LiveBuyRow } from "@/pages/timecurve/LiveBuyRow";
import type { WalletFormatShort } from "@/lib/addressFormat";

type Props = {
  buys: BuyItem[] | null;
  /** Total buys in the indexer (all pages); shown next to the strip title. */
  indexedTotal: number | null;
  indexerNote: string | null;
  formatWallet: WalletFormatShort;
  /** When set, mini pie shows min–max spend band fill at buy time (needs `block_timestamp` on rows). */
  envelopeParams: EnvelopeCurveParamsWire | null;
  onSelectBuy?: (buy: BuyItem) => void;
  onMore?: () => void;
};

export const TimerHeroLiveBuys = memo(function TimerHeroLiveBuys({
  buys,
  indexedTotal,
  indexerNote,
  formatWallet,
  envelopeParams,
  onSelectBuy,
  onMore,
}: Props) {
  /** Wall clock for “Xs ago” — matches Simple recent buys (chain-interpolated “now” understates age when head is stale). */
  const [wallNowUnixSec, setWallNowUnixSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => {
      setWallNowUnixSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = buys?.slice(0, 5) ?? [];

  return (
    <aside className="timer-hero__live" aria-label="Latest buys from indexer">
      <div className="timer-hero__live-head">
        <div className="timer-hero__live-title">
          Live buys{indexedTotal !== null ? ` (${indexedTotal})` : ""}
        </div>
        {onMore !== undefined && (
          <button type="button" className="timer-hero__live-more" onClick={onMore}>
            More
          </button>
        )}
      </div>
      {indexerNote !== null && indexerNote !== "" && (
        <div className="timer-hero__live-placeholder timer-hero__live-placeholder--with-mascot">
          <img
            className="timer-hero__indexer-mascot"
            src="/art/cutouts/indexer-down-mascot.png"
            alt=""
            width={72}
            height={72}
            decoding="async"
          />
          <p>{indexerNote}</p>
        </div>
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
                nowUnixSec={wallNowUnixSec}
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
