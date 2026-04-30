// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useId, useMemo, useRef, useState, type UIEvent } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { Modal } from "@/components/ui/Modal";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import type { BuyItem } from "@/lib/indexerApi";
import type { EnvelopeCurveParamsWire } from "@/lib/timeCurveBuyDisplay";
import { explorerTxUrl } from "@/lib/explorer";
import {
  buildBuyBattlePointBreakdown,
  buildBuyFeedNarrative,
  formatBuyDetailRows,
  pickBuyHighlightStat,
} from "@/lib/timeCurveUx";
import type { WalletFormatShort } from "@/lib/addressFormat";
import { LiveBuyRow } from "@/pages/timecurve/LiveBuyRow";

function isUnixSecString(raw: string): boolean {
  if (!/^\d+$/.test(raw.trim())) {
    return false;
  }
  try {
    const n = BigInt(raw.trim());
    return n >= 0n && n < 1n << 64n;
  } catch {
    return false;
  }
}

type Props = {
  listOpen: boolean;
  onCloseList: () => void;
  detailBuy: BuyItem | null;
  onCloseDetail: () => void;
  onSelectBuy: (buy: BuyItem) => void;
  buys: BuyItem[] | null;
  /** Total indexed buy rows (all pages); paired with `buys.length` for “showing: x/total”. */
  indexedTotal: number | null;
  buysLoading: boolean;
  buysNextOffset: number | null;
  loadingMoreBuys: boolean;
  onLoadMoreBuys: () => void;
  address: string | undefined;
  formatWallet: WalletFormatShort;
  decimals: number;
  envelopeParams: EnvelopeCurveParamsWire | null;
};

export function TimecurveBuyModals({
  listOpen,
  onCloseList,
  detailBuy,
  onCloseDetail,
  onSelectBuy,
  buys,
  indexedTotal,
  buysLoading,
  buysNextOffset,
  loadingMoreBuys,
  onLoadMoreBuys,
  address,
  formatWallet,
  decimals,
  envelopeParams,
}: Props) {
  const listTitleId = useId();
  const detailTitleId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [wallNowUnixSec, setWallNowUnixSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => {
      setWallNowUnixSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const listModalTitle = useMemo(() => {
    const loaded = buys?.length ?? 0;
    const totalPart = indexedTotal !== null ? String(indexedTotal) : "…";
    return `All indexed buys · showing: ${loaded}/${totalPart}`;
  }, [buys, indexedTotal]);

  const narrative = useMemo(
    () => (detailBuy ? buildBuyFeedNarrative(detailBuy, address, formatWallet) : null),
    [detailBuy, address, formatWallet],
  );

  const highlight = useMemo(() => (detailBuy ? pickBuyHighlightStat(detailBuy) : null), [detailBuy]);

  const bpRows = useMemo(
    () => (detailBuy ? buildBuyBattlePointBreakdown(detailBuy) : []),
    [detailBuy],
  );

  const detailRows = useMemo(() => (detailBuy ? formatBuyDetailRows(detailBuy) : []), [detailBuy]);

  const txUrl = detailBuy ? explorerTxUrl(detailBuy.tx_hash) : undefined;

  const maybeLoadMore = useCallback(() => {
    if (loadingMoreBuys || buysNextOffset === null) {
      return;
    }
    onLoadMoreBuys();
  }, [loadingMoreBuys, buysNextOffset, onLoadMoreBuys]);

  useEffect(() => {
    if (!listOpen || buys === null || buys.length === 0 || loadingMoreBuys || buysNextOffset === null) {
      return;
    }
    const el = listRef.current;
    if (!el) {
      return;
    }
    if (el.scrollHeight <= el.clientHeight + 24) {
      maybeLoadMore();
    }
  }, [listOpen, buys, loadingMoreBuys, buysNextOffset, maybeLoadMore]);

  const handleListScroll = useCallback(
    (e: UIEvent<HTMLUListElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 96) {
        maybeLoadMore();
      }
    },
    [maybeLoadMore],
  );

  return (
    <>
      <Modal open={listOpen} title={listModalTitle} titleId={listTitleId} onClose={onCloseList} layer="list">
        {buysLoading && <p className="modal-bc-placeholder">Loading buys from the indexer…</p>}
        {!buysLoading && buys !== null && buys.length === 0 && (
          <p className="modal-bc-placeholder">No buys indexed yet.</p>
        )}
        {!buysLoading && buys !== null && buys.length > 0 && (
          <div className="modal-bc-shell">
            <p className="modal-bc-intro">
              Scan the latest momentum swings, timer saves, and flag pressure. Select a row for the full indexed
              breakdown.
            </p>
            <ul className="modal-bc-list" aria-label="Indexed buys" ref={listRef} onScroll={handleListScroll}>
              {buys.map((buy) => (
                <li key={`${buy.tx_hash}-${buy.log_index}`} className="modal-bc-li">
                  <LiveBuyRow
                    buy={buy}
                    formatWallet={formatWallet}
                    onSelectBuy={onSelectBuy}
                    nowUnixSec={wallNowUnixSec}
                    envelopeParams={envelopeParams}
                    variant="modal"
                  />
                </li>
              ))}
            </ul>
            {(loadingMoreBuys || buysNextOffset !== null) && (
              <div className="modal-bc-more" aria-live="polite">
                {loadingMoreBuys ? "Loading more…" : "Scroll for more"}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={detailBuy !== null}
        title="Buy details"
        titleId={detailTitleId}
        onClose={onCloseDetail}
        layer="detail"
      >
        {detailBuy && narrative && highlight && (
          <div className="modal-bc-detail">
            <div className="modal-bc-detail__hero">
              <p className="modal-bc-detail__eyebrow">{narrative.eyebrow}</p>
              <p className="modal-bc-detail__headline">{narrative.headline}</p>
              <p className="modal-bc-detail__detail">{narrative.detail}</p>
              {narrative.tags.length > 0 && (
                <ul className="modal-bc-detail__tags">
                  {narrative.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <p className="modal-bc-detail__highlight">
                <span className="modal-bc-detail__highlight-label">{highlight.label}</span>
                {highlight.sub ? (
                  <span className="modal-bc-detail__highlight-sub">{highlight.sub}</span>
                ) : null}
              </p>
            </div>

            {txUrl && (
              <p className="modal-bc-detail__link">
                <a href={txUrl} target="_blank" rel="noreferrer noopener">
                  View transaction on explorer
                </a>
              </p>
            )}

            <div className="modal-bc-detail__times">
              {isUnixSecString(detailBuy.new_deadline) && (
                <div className="modal-bc-detail__time-block">
                  <div className="modal-bc-detail__time-label">New deadline</div>
                  <UnixTimestampDisplay raw={detailBuy.new_deadline.trim()} />
                </div>
              )}
              {detailBuy.block_timestamp != null &&
                detailBuy.block_timestamp !== "" &&
                isUnixSecString(detailBuy.block_timestamp) && (
                  <div className="modal-bc-detail__time-block">
                    <div className="modal-bc-detail__time-label">Block time</div>
                    <UnixTimestampDisplay raw={detailBuy.block_timestamp.trim()} />
                  </div>
                )}
            </div>

            <div className="modal-bc-detail__amounts">
              <div className="modal-bc-detail__amount-block">
                <div className="modal-bc-detail__time-label">Spend</div>
                <AmountDisplay raw={detailBuy.amount} decimals={decimals} />
              </div>
              <div className="modal-bc-detail__amount-block">
                <div className="modal-bc-detail__time-label">CHARM</div>
                <AmountDisplay raw={detailBuy.charm_wad} decimals={decimals} />
              </div>
              <div className="modal-bc-detail__amount-block">
                <div className="modal-bc-detail__time-label">Price / CHARM</div>
                <AmountDisplay raw={detailBuy.price_per_charm_wad} decimals={decimals} />
              </div>
              <div className="modal-bc-detail__amount-block">
                <div className="modal-bc-detail__time-label">Total raised after</div>
                <AmountDisplay raw={detailBuy.total_raised_after} decimals={decimals} />
              </div>
            </div>

            {bpRows.length > 0 && (
              <div className="modal-bc-detail__bp">
                <div className="modal-bc-detail__time-label">Battle points (non-zero)</div>
                <ul className="modal-bc-detail__bp-list">
                  {bpRows.map((r) => (
                    <li key={r.key}>
                      {r.label}: {r.value.toString()} BP
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-bc-detail__raw">
              <div className="modal-bc-detail__time-label">Indexer fields</div>
              <dl className="modal-bc-dl">
                {detailRows.map((row) => (
                  <div key={row.label} className="modal-bc-dl__row">
                    <dt>{row.label}</dt>
                    <dd className="mono">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
