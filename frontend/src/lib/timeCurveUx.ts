// SPDX-License-Identifier: AGPL-3.0-only

import { sameAddress, shortAddress } from "./addressFormat";
import type { BuyItem, WarbowBattleFeedItem } from "./indexerApi";

export type TimerPreviewNarrative = {
  tone: "calm" | "warning" | "critical";
  label: string;
  detail: string;
};

export type FeedNarrative = {
  eyebrow: string;
  headline: string;
  detail: string;
  tags: string[];
};

export type BuyHistoryPoint = {
  key: string;
  buyer: string;
  width: number;
  secondsAdded: bigint;
  totalRaisedAfter: bigint;
  hardReset: boolean;
  meta: string;
};

export type BattlePointBreakdownRow = {
  key: string;
  label: string;
  value: bigint;
};

export type WarbowPreflightNarrative = {
  tone: "muted" | "success" | "warning" | "error";
  title: string;
  detail: string;
};

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function perspectiveLabel(actor: string | undefined, viewer: string | undefined, selfText: string): string {
  if (sameAddress(actor, viewer)) {
    return selfText;
  }
  return shortAddress(actor, "Unknown player");
}

export function describeTimerPreview(
  remainingSec: number | undefined,
  timerExtensionPreview: number | undefined,
): TimerPreviewNarrative {
  if (remainingSec === undefined || timerExtensionPreview === undefined) {
    return {
      tone: "calm",
      label: "Waiting for live timer data",
      detail: "Timer pressure will appear once the sale is readable from chain.",
    };
  }

  if (remainingSec <= 300) {
    return {
      tone: "critical",
      label: "Clutch window",
      detail:
        remainingSec < 780
          ? "A buy here hard-resets the clock toward 15 minutes, which can flip the entire room."
          : `A buy now can still add about ${timerExtensionPreview}s, but every second feels expensive.`,
    };
  }

  if (remainingSec <= 3600) {
    return {
      tone: "warning",
      label: "Race is heating up",
      detail:
        remainingSec < 780
          ? "The next buyer is entering the hard-reset band and can yank the round back to safety."
          : `A buy here likely adds about ${timerExtensionPreview}s and can swing podium pressure fast.`,
    };
  }

  return {
    tone: "calm",
    label: "Room to set up a move",
    detail: `A standard buy currently adds about ${timerExtensionPreview}s to the clock.`,
  };
}

export function buildBuyFeedNarrative(buy: BuyItem, viewer: string | undefined): FeedNarrative {
  const buyer = perspectiveLabel(buy.buyer, viewer, "You");
  const actualSecondsAdded = parseBigInt(buy.actual_seconds_added) ?? 0n;
  const battlePointsAfter = parseBigInt(buy.battle_points_after);
  const streakBreakBonus = parseBigInt(buy.bp_streak_break_bonus) ?? 0n;
  const ambushBonus = parseBigInt(buy.bp_ambush_bonus) ?? 0n;
  const clutchBonus = parseBigInt(buy.bp_clutch_bonus) ?? 0n;
  const activeStreak = parseBigInt(buy.buyer_active_defended_streak) ?? 0n;
  const bestStreak = parseBigInt(buy.buyer_best_defended_streak) ?? 0n;
  const tags: string[] = [];

  if (actualSecondsAdded > 0n) {
    tags.push(`+${actualSecondsAdded}s`);
  }
  if (buy.timer_hard_reset) {
    tags.push("hard reset");
  }
  if (buy.flag_planted) {
    tags.push("flag planted");
  }
  if (clutchBonus > 0n) {
    tags.push("clutch");
  }
  if (ambushBonus > 0n) {
    tags.push("ambush");
  }
  if (streakBreakBonus > 0n) {
    tags.push("streak break");
  }
  if (activeStreak > 0n) {
    tags.push(`streak ${activeStreak}`);
  }

  const impactParts: string[] = [];
  if (actualSecondsAdded > 0n) {
    impactParts.push(`added ${actualSecondsAdded}s`);
  }
  if (battlePointsAfter !== null) {
    impactParts.push(`moved to ${battlePointsAfter} BP`);
  }
  if (bestStreak > 0n) {
    impactParts.push(`best defended streak ${bestStreak}`);
  }

  let headline = `${buyer} hit the curve`;
  if (buy.timer_hard_reset) {
    headline = `${buyer} yanked the timer back from the brink`;
  } else if (streakBreakBonus > 0n) {
    headline = `${buyer} broke a defended streak`;
  } else if (clutchBonus > 0n) {
    headline = `${buyer} landed a clutch buy`;
  }

  return {
    eyebrow: "Buy event",
    headline,
    detail: impactParts.length > 0 ? impactParts.join(" · ") : "Fresh buy indexed from chain.",
    tags,
  };
}

export function buildBuyHistoryPoints(buys: BuyItem[] | null | undefined, limit = 6): BuyHistoryPoint[] {
  if (!buys || buys.length === 0) {
    return [];
  }
  const recent = buys.slice(0, limit).reverse();
  const maxSeconds = recent.reduce((acc, buy) => {
    const value = parseBigInt(buy.actual_seconds_added) ?? 0n;
    return value > acc ? value : acc;
  }, 0n);

  return recent.map((buy, index) => {
    const secondsAdded = parseBigInt(buy.actual_seconds_added) ?? 0n;
    const totalRaisedAfter = parseBigInt(buy.total_raised_after) ?? 0n;
    const width = maxSeconds > 0n ? Number((secondsAdded * 100n) / maxSeconds) : 0;
    return {
      key: `${buy.tx_hash}-${buy.log_index}-${index}`,
      buyer: shortAddress(buy.buyer, "Unknown player"),
      width,
      secondsAdded,
      totalRaisedAfter,
      hardReset: buy.timer_hard_reset === true,
      meta: buy.timer_hard_reset
        ? "Hard reset back toward safety"
        : secondsAdded > 0n
          ? `Added ${secondsAdded}s`
          : "No extra timer room indexed",
    };
  });
}

export function buildBuyBattlePointBreakdown(buy: BuyItem): BattlePointBreakdownRow[] {
  const rows: BattlePointBreakdownRow[] = [
    { key: "base", label: "Base buy", value: parseBigInt(buy.bp_base_buy) ?? 0n },
    { key: "reset", label: "Timer reset", value: parseBigInt(buy.bp_timer_reset_bonus) ?? 0n },
    { key: "clutch", label: "Clutch", value: parseBigInt(buy.bp_clutch_bonus) ?? 0n },
    { key: "streak", label: "Streak break", value: parseBigInt(buy.bp_streak_break_bonus) ?? 0n },
    { key: "ambush", label: "Ambush", value: parseBigInt(buy.bp_ambush_bonus) ?? 0n },
    { key: "penalty", label: "Flag penalty", value: parseBigInt(buy.bp_flag_penalty) ?? 0n },
  ];
  return rows.filter((row) => row.value !== 0n);
}

export function describeStealPreflight(params: {
  connected: boolean;
  saleActive: boolean;
  saleEnded: boolean;
  viewer: string | undefined;
  victim: string | undefined;
  viewerBattlePoints: bigint | undefined;
  victimBattlePoints: bigint | undefined;
  victimStealsToday: bigint | undefined;
  maxStealsPerDay: bigint;
  bypassSelected: boolean;
  guardActive: boolean;
}): WarbowPreflightNarrative {
  const {
    connected,
    saleActive,
    saleEnded,
    viewer,
    victim,
    viewerBattlePoints,
    victimBattlePoints,
    victimStealsToday,
    maxStealsPerDay,
    bypassSelected,
    guardActive,
  } = params;

  if (!connected) {
    return {
      tone: "muted",
      title: "Connect to inspect WarBow",
      detail: "Live BP reads, per-victim steal caps, and write simulation need a connected wallet.",
    };
  }
  if (!saleActive) {
    return {
      tone: saleEnded ? "warning" : "muted",
      title: saleEnded ? "Round already expired" : "Waiting for live round",
      detail: saleEnded
        ? "Steal and guard actions are mostly over once the timer expires. Only residual revenge state may remain."
        : "WarBow actions unlock when the live round is running.",
    };
  }
  if (!victim) {
    return {
      tone: "muted",
      title: "Pick a rival",
      detail: "Enter a victim address to compare BP, daily cap pressure, and pre-sign steal eligibility.",
    };
  }
  if (sameAddress(viewer, victim)) {
    return {
      tone: "error",
      title: "Self-target blocked",
      detail: "WarBow only targets rivals. Pick another wallet with at least 2x your Battle Points.",
    };
  }
  if (viewerBattlePoints === undefined || victimBattlePoints === undefined) {
    return {
      tone: "muted",
      title: "Waiting for live BP reads",
      detail: "The page is still pulling Battle Points for you and the victim before it can grade the steal.",
    };
  }
  if (victimBattlePoints < viewerBattlePoints * 2n) {
    return {
      tone: "error",
      title: "2x rule not met",
      detail: `${shortAddress(victim, "Victim")} has ${victimBattlePoints} BP vs your ${viewerBattlePoints} BP, so the steal would revert right now.`,
    };
  }
  if (victimStealsToday !== undefined && victimStealsToday >= maxStealsPerDay && !bypassSelected) {
    return {
      tone: "warning",
      title: "Daily cap reached",
      detail: `${shortAddress(victim, "Victim")} already hit ${maxStealsPerDay} steals today. Enable bypass if you still want to burn for the hit.`,
    };
  }
  return {
    tone: guardActive ? "warning" : "success",
    title: "Steal looks eligible",
    detail: guardActive
      ? `${shortAddress(victim, "Victim")} passes the 2x rule. Your own guard is already live, so decide whether to keep defending or convert that safety into pressure.`
      : `${shortAddress(victim, "Victim")} passes the 2x rule${victimStealsToday !== undefined ? ` and is at ${victimStealsToday}/${maxStealsPerDay} steals today` : ""}.`,
  };
}

export function buildWarbowFeedNarrative(
  item: WarbowBattleFeedItem,
  viewer: string | undefined,
): FeedNarrative {
  const detail = (item.detail ?? {}) as Record<string, unknown>;
  const attacker = detail.attacker as string | undefined;
  const victim = detail.victim as string | undefined;
  const avenger = detail.avenger as string | undefined;
  const stealer = detail.stealer as string | undefined;
  const player = detail.player as string | undefined;
  const interrupter = detail.interrupter as string | undefined;
  const formerHolder = detail.former_holder as string | undefined;
  const amountBp = parseBigInt(detail.amount_bp);
  const burnPaidWad = parseBigInt(detail.burn_paid_wad);
  const bonusBp = parseBigInt(detail.bonus_bp);
  const penaltyBp = parseBigInt(detail.penalty_bp);
  const activeStreak = parseBigInt(detail.active_streak);
  const brokenLength = parseBigInt(detail.broken_active_length);
  const attackerBpAfter = parseBigInt(detail.attacker_bp_after);
  const victimBpAfter = parseBigInt(detail.victim_bp_after);
  const playerBpAfter = parseBigInt(detail.battle_points_after);
  const guardUntilTs = parseBigInt(detail.guard_until_ts);
  const tags: string[] = [];

  switch (item.kind) {
    case "steal":
      if (amountBp !== null) {
        tags.push(`${amountBp} BP swing`);
      }
      if (detail.bypassed_victim_daily_limit === true) {
        tags.push("cap bypass");
      }
      return {
        eyebrow: "WarBow steal",
        headline: `${perspectiveLabel(attacker, viewer, "You")} stole from ${perspectiveLabel(victim, viewer, "you")}`,
        detail:
          amountBp !== null
            ? `Momentum changed hands for ${amountBp} BP${attackerBpAfter !== null && victimBpAfter !== null ? `, moving the ladder to ${attackerBpAfter} vs ${victimBpAfter}.` : "."}`
            : "A steal landed and shuffled pressure on the ladder.",
        tags,
      };
    case "revenge":
      if (amountBp !== null) {
        tags.push(`${amountBp} BP swing`);
      }
      return {
        eyebrow: "WarBow revenge",
        headline: `${perspectiveLabel(avenger, viewer, "You")} struck back at ${perspectiveLabel(stealer, viewer, "you")}`,
        detail: amountBp !== null ? `Revenge reclaimed ${amountBp} BP.` : "A revenge window was converted into a counter-hit.",
        tags,
      };
    case "guard_activated":
      if (burnPaidWad !== null) {
        tags.push("guarded");
      }
      return {
        eyebrow: "WarBow defense",
        headline: `${perspectiveLabel(player, viewer, "You")} activated guard`,
        detail:
          guardUntilTs !== null
            ? `Incoming steals are softened while guard is live until ${new Date(Number(guardUntilTs) * 1000).toLocaleTimeString()}.`
            : "Incoming steals are softened while guard is live.",
        tags,
      };
    case "flag_claimed":
      if (bonusBp !== null) {
        tags.push(`+${bonusBp} BP`);
      }
      return {
        eyebrow: "Flag claimed",
        headline: `${perspectiveLabel(player, viewer, "You")} held silence and claimed the flag`,
        detail:
          bonusBp !== null
            ? `The quiet window paid out ${bonusBp} BP${playerBpAfter !== null ? `, pushing the holder to ${playerBpAfter} BP.` : "."}`
            : "Silence converted into a Battle Points bonus.",
        tags,
      };
    case "flag_penalized":
      if (penaltyBp !== null) {
        tags.push(`-${penaltyBp} BP`);
      }
      return {
        eyebrow: "Flag denied",
        headline: `${perspectiveLabel(formerHolder, viewer, "You")} lost a flag to ${perspectiveLabel(
          interrupter,
          viewer,
          shortAddress(interrupter, "Unknown player"),
        )}`,
        detail: penaltyBp !== null ? `The interruption cost ${penaltyBp} BP.` : "A late interrupt erased a claimable flag.",
        tags,
      };
    case "defended_streak_continued":
      if (activeStreak !== null) {
        tags.push(`streak ${activeStreak}`);
      }
      return {
        eyebrow: "Defended streak",
        headline: `${perspectiveLabel(detail.wallet as string | undefined, viewer, "You")} kept the streak alive`,
        detail:
          activeStreak !== null
            ? `The under-15-minute defense chain reached ${activeStreak}.`
            : "Another under-window defense landed.",
        tags,
      };
    case "defended_streak_broken":
      if (brokenLength !== null) {
        tags.push(`broke ${brokenLength}`);
      }
      return {
        eyebrow: "Streak break",
        headline: `${perspectiveLabel(interrupter, viewer, "You")} snapped ${perspectiveLabel(formerHolder, viewer, "your")} streak`,
        detail:
          brokenLength !== null
            ? `A defended streak of ${brokenLength} was ended.`
            : "A defended streak was cut off by another buyer.",
        tags,
      };
    case "defended_streak_window_cleared":
      return {
        eyebrow: "Window cleared",
        headline: `${perspectiveLabel(detail.cleared_wallet as string | undefined, viewer, "You")} lost the under-15-minute window`,
        detail: "The timer climbed high enough that the current streak phase reset.",
        tags,
      };
    case "cl8y_burned":
      if (burnPaidWad !== null) {
        tags.push("CL8Y burn");
      }
      return {
        eyebrow: "WarBow burn",
        headline: `${perspectiveLabel(detail.payer as string | undefined, viewer, "You")} paid the PvP burn`,
        detail: "WarBow actions keep their risk visible by burning CL8Y onchain.",
        tags,
      };
    default:
      return {
        eyebrow: "WarBow event",
        headline: item.kind.replace(/_/g, " "),
        detail: "Battle activity mirrored from the indexer.",
        tags,
      };
  }
}
