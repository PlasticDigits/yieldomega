// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { StatusMessage } from "@/components/ui/StatusMessage";

export function StatCard({
  label,
  value,
  meta,
  className,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["stat-card", className].filter(Boolean).join(" ")}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {meta && <div className="stat-card__meta">{meta}</div>}
    </div>
  );
}

export type RankingRow = {
  key: string;
  rank: number;
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  highlight?: boolean;
};

const PODIUM_RANK_TROPHY_SRC = [
  "/art/icons/timecurve-podium-rank-first.png?v=1",
  "/art/icons/timecurve-podium-rank-second.png?v=1",
  "/art/icons/timecurve-podium-rank-third.png?v=1",
] as const;

export function RankingList({ rows, emptyText }: { rows: RankingRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <StatusMessage variant="muted">{emptyText}</StatusMessage>;
  }

  return (
    <ol className="ranking-list">
      {rows.map((row) => {
        const classes = [
          "ranking-list__item",
          row.rank === 1 ? "ranking-list__item--first" : "",
          row.rank === 2 ? "ranking-list__item--second" : "",
          row.rank === 3 ? "ranking-list__item--third" : "",
          row.highlight ? "ranking-list__item--you" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={row.key} className={classes}>
            <span className="ranking-list__rank">{row.rank}</span>
            <div>
              <div>{row.label}</div>
              {row.meta && <div className="ranking-list__meta">{row.meta}</div>}
            </div>
            <strong>{row.value}</strong>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Podium reserve list — spring entrance when a row `key` changes (place reassigned)
 * plus optional layout interpolation when participants move between ranks.
 */
export function PodiumRankingList({
  rows,
  emptyText,
  burstNonce = 0,
}: {
  rows: RankingRow[];
  emptyText: string;
  burstNonce?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (rows.length === 0) {
    return <StatusMessage variant="muted">{emptyText}</StatusMessage>;
  }

  return (
    <ol
      className="ranking-list ranking-list--podium-motion"
      data-podium-burst={burstNonce > 0 ? String(burstNonce % 1000) : undefined}
    >
      {rows.map((row) => {
        const classes = [
          "ranking-list__item",
          row.rank === 1 ? "ranking-list__item--first" : "",
          row.rank === 2 ? "ranking-list__item--second" : "",
          row.rank === 3 ? "ranking-list__item--third" : "",
          row.highlight ? "ranking-list__item--you" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <motion.li
            key={row.key}
            layout={!prefersReducedMotion}
            className={classes}
            initial={
              prefersReducedMotion ? false : { opacity: 0.45, y: 10, filter: "brightness(1.22)" }
            }
            animate={{ opacity: 1, y: 0, filter: "brightness(1)" }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 520, damping: 36, mass: 0.82 }
            }
          >
            <span className="ranking-list__rank" aria-label={`Rank ${row.rank}`}>
              <img
                src={PODIUM_RANK_TROPHY_SRC[row.rank - 1] ?? PODIUM_RANK_TROPHY_SRC[2]}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
              />
              <span className="visually-hidden">{row.rank}</span>
            </span>
            <strong>{row.value}</strong>
            <div>{row.label}</div>
            {row.meta && <div className="ranking-list__meta">{row.meta}</div>}
          </motion.li>
        );
      })}
    </ol>
  );
}

export function FeedCard({
  eyebrow,
  title,
  meta,
  tags = [],
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  tags?: string[];
  className?: string;
}) {
  return (
    <li className={["feed-card", className].filter(Boolean).join(" ")}>
      {eyebrow && <div className="feed-card__eyebrow">{eyebrow}</div>}
      <div className="feed-card__title">{title}</div>
      {meta && <div className="feed-card__meta">{meta}</div>}
      {tags.length > 0 && (
        <div className="feed-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="feed-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
