// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { GlassPanel } from "@/components/glass";
import { explorerTxUrl } from "@/lib/explorer";
import {
  ARENA_BUY_RESULT_COPY_BANNER_MS,
  ARENA_BUY_RESULT_COPY_REJECTED,
  ARENA_BUY_RESULT_COPY_SUCCESS,
  ARENA_BUY_RESULT_COPY_UNSUPPORTED,
} from "@/pages/arena/arenaBuyResultShareCopy";
import type { ArenaBuyShareSummary } from "@/pages/arena/arenaBuyShareSummary";

type Props = {
  summary: ArenaBuyShareSummary | null;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

type CopyBanner = {
  variant: "success" | "error";
  text: string;
};

async function copyText(text: string): Promise<"success" | "unsupported" | "rejected"> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return "unsupported";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "success";
  } catch {
    return "rejected";
  }
}

function rowClassName(tone: string | undefined): string {
  if (!tone) return "";
  return `arena-buy-result-share__row--${tone}`;
}

/** Closable post-buy transaction result card for screenshot-ready sharing (#365). */
export function ArenaBuyResultSharePopover({ summary, onDismiss, reduceMotion }: Props) {
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion ?? Boolean(systemReducedMotion);
  const [copyBanner, setCopyBanner] = useState<CopyBanner | null>(null);
  const copyBannerTimeoutRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const clearCopyBanner = useCallback(() => {
    if (copyBannerTimeoutRef.current !== null) {
      window.clearTimeout(copyBannerTimeoutRef.current);
      copyBannerTimeoutRef.current = null;
    }
    setCopyBanner(null);
  }, []);

  const showCopyBanner = useCallback(
    (banner: CopyBanner) => {
      clearCopyBanner();
      setCopyBanner(banner);
      copyBannerTimeoutRef.current = window.setTimeout(() => {
        setCopyBanner(null);
        copyBannerTimeoutRef.current = null;
      }, ARENA_BUY_RESULT_COPY_BANNER_MS);
    },
    [clearCopyBanner],
  );

  useEffect(() => () => clearCopyBanner(), [clearCopyBanner]);

  useEffect(() => {
    if (!summary) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, summary]);

  useEffect(() => {
    if (!summary) return;
    panelRef.current?.focus();
  }, [summary]);

  const handleCopySummary = useCallback(async () => {
    const result = await copyText(summary?.shareText ?? "");
    if (result === "success") {
      showCopyBanner({ variant: "success", text: ARENA_BUY_RESULT_COPY_SUCCESS });
    } else if (result === "unsupported") {
      showCopyBanner({ variant: "error", text: ARENA_BUY_RESULT_COPY_UNSUPPORTED });
    } else {
      showCopyBanner({ variant: "error", text: ARENA_BUY_RESULT_COPY_REJECTED });
    }
  }, [showCopyBanner, summary?.shareText]);

  const handleCopyTxLink = useCallback(async () => {
    const url = summary?.txHash ? explorerTxUrl(summary.txHash) : undefined;
    if (!url) return;
    const result = await copyText(url);
    if (result === "success") {
      showCopyBanner({ variant: "success", text: ARENA_BUY_RESULT_COPY_SUCCESS });
    } else if (result === "unsupported") {
      showCopyBanner({ variant: "error", text: ARENA_BUY_RESULT_COPY_UNSUPPORTED });
    } else {
      showCopyBanner({ variant: "error", text: ARENA_BUY_RESULT_COPY_REJECTED });
    }
  }, [showCopyBanner, summary?.txHash]);

  if (!summary) return null;

  const txUrl = summary.txHash ? explorerTxUrl(summary.txHash) : undefined;
  const motionProps = motionReduced
    ? {}
    : {
        initial: { opacity: 0, y: 12, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
        transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
      };

  const overlay = (
    <div
      className="arena-buy-result-share"
      data-testid="arena-buy-result-share-popover"
      data-pending={summary.pending ? "true" : "false"}
    >
      <button
        type="button"
        className="arena-buy-result-share__backdrop"
        aria-label="Dismiss buy result"
        data-testid="arena-buy-result-share-backdrop"
        onClick={onDismiss}
      />
      <motion.div className="arena-buy-result-share__motion" {...motionProps}>
        <GlassPanel className="arena-buy-result-share__panel" tone="live">
          <div
            ref={panelRef}
            className="arena-buy-result-share__content"
            data-testid="arena-buy-result-share-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Buy result"
            tabIndex={-1}
          >
            <div className="arena-buy-result-share__header">
              <p className="arena-buy-result-share__eyebrow">Buy result</p>
              <button
                type="button"
                className="arena-buy-result-share__close"
                aria-label="Close buy result"
                data-testid="arena-buy-result-share-close"
                onClick={onDismiss}
              >
                ×
              </button>
            </div>
            <p className="arena-buy-result-share__headline" data-testid="arena-buy-result-share-headline">
              {summary.headline}
            </p>
            {summary.pending ? (
              <p className="arena-buy-result-share__pending" data-testid="arena-buy-result-share-pending">
                Confirming onchain…
              </p>
            ) : null}
            <ul className="arena-buy-result-share__rows" aria-label="Buy effects">
              {summary.rows.map((row) => (
                <li
                  key={`${row.label}-${row.value}`}
                  className={["arena-buy-result-share__row", rowClassName(row.tone)]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid="arena-buy-result-share-row"
                >
                  <span className="arena-buy-result-share__row-label">
                    {row.icon ? `${row.icon} ` : ""}
                    {row.label}
                  </span>
                  <span className="arena-buy-result-share__row-value">{row.value}</span>
                </li>
              ))}
            </ul>
            <div className="arena-buy-result-share__actions">
              <button
                type="button"
                className="btn-ghost arena-buy-result-share__action"
                data-testid="arena-buy-result-share-copy-summary"
                onClick={() => void handleCopySummary()}
              >
                Copy summary
              </button>
              {txUrl ? (
                <button
                  type="button"
                  className="btn-ghost arena-buy-result-share__action"
                  data-testid="arena-buy-result-share-copy-tx"
                  onClick={() => void handleCopyTxLink()}
                >
                  Copy tx link
                </button>
              ) : null}
            </div>
            {copyBanner ? (
              <p
                className={[
                  "arena-buy-result-share__copy-banner",
                  copyBanner.variant === "error" ? "arena-buy-result-share__copy-banner--error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid="arena-buy-result-share-copy-feedback"
                role="status"
              >
                {copyBanner.text}
              </p>
            ) : null}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
}
