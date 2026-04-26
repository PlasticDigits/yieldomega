// SPDX-License-Identifier: AGPL-3.0-only

import { sameAddress, shortAddress, type WalletFormatShort } from "./addressFormat";
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
  /** Base-10 string — avoids BigInt in React props (dev profiler JSON). */
  secondsAdded: string;
  totalRaisedAfter: string;
  hardReset: boolean;
  meta: string;
};

export type BattlePointBreakdownRow = {
  key: string;
  label: string;
  value: bigint;
};

/** Single highest-priority line for compact “live buy” tiles (hero strip). */
export type BuyHighlight = {
  label: string;
  sub?: string;
};

/**
 * Pick the most salient stat for a buy row. Higher list = higher priority.
 * Indexer fields are optional on older rows; fall through until something matches.
 */
export function pickBuyHighlightStat(buy: BuyItem): BuyHighlight {
  const flagPenalty = parseBigInt(buy.bp_flag_penalty) ?? 0n;
  const streakBreak = parseBigInt(buy.bp_streak_break_bonus) ?? 0n;
  const ambush = parseBigInt(buy.bp_ambush_bonus) ?? 0n;
  const clutch = parseBigInt(buy.bp_clutch_bonus) ?? 0n;
  const resetBp = parseBigInt(buy.bp_timer_reset_bonus) ?? 0n;
  const activeStreak = parseBigInt(buy.buyer_active_defended_streak) ?? 0n;
  const bestStreak = parseBigInt(buy.buyer_best_defended_streak) ?? 0n;
  const bpAfter = parseBigInt(buy.battle_points_after);
  const seconds = parseBigInt(buy.actual_seconds_added) ?? 0n;

  if (flagPenalty > 0n) {
    return { label: "Flag penalty — BP hit", sub: `−${flagPenalty.toString()} BP` };
  }
  if (buy.timer_hard_reset) {
    return {
      label: "Timer hard reset",
      sub: seconds > 0n ? `+${seconds.toString()}s on the clock` : undefined,
    };
  }
  if (streakBreak > 0n) {
    return { label: "Broke a defended streak", sub: `+${streakBreak.toString()} BP` };
  }
  if (ambush > 0n) {
    return { label: "Ambush bonus", sub: `+${ambush.toString()} BP` };
  }
  if (clutch > 0n) {
    return { label: "Clutch timing", sub: `+${clutch.toString()} BP` };
  }
  if (resetBp > 0n) {
    return { label: "Timer reset bonus", sub: `+${resetBp.toString()} BP` };
  }
  if (activeStreak >= 2n) {
    return {
      label: "Defended streak",
      sub: `${activeStreak.toString()} active · best ${bestStreak.toString()}`,
    };
  }
  if (bpAfter !== null && bpAfter > 0n) {
    return { label: "WarBow ladder", sub: `${bpAfter.toString()} BP total` };
  }
  if (seconds > 0n) {
    return { label: "Extended timer", sub: `+${seconds.toString()}s` };
  }
  return { label: "Buy indexed", sub: "On-chain" };
}

export type BuyImpactTone = "danger" | "warning" | "success" | "info" | "neutral";

export type BuyImpactTick = {
  id: string;
  label: string;
  sub?: string;
  tone: BuyImpactTone;
};

/** Up to `max` salient WarBow / timer impacts for compact rows (color-coded chips). */
export function listBuyImpactTicks(buy: BuyItem, max = 5): BuyImpactTick[] {
  const out: BuyImpactTick[] = [];
  const push = (t: BuyImpactTick) => {
    if (out.length < max) {
      out.push(t);
    }
  };

  const flagPenalty = parseBigInt(buy.bp_flag_penalty) ?? 0n;
  const streakBreak = parseBigInt(buy.bp_streak_break_bonus) ?? 0n;
  const ambush = parseBigInt(buy.bp_ambush_bonus) ?? 0n;
  const clutch = parseBigInt(buy.bp_clutch_bonus) ?? 0n;
  const resetBp = parseBigInt(buy.bp_timer_reset_bonus) ?? 0n;
  const activeStreak = parseBigInt(buy.buyer_active_defended_streak) ?? 0n;
  const bpAfter = parseBigInt(buy.battle_points_after);
  const seconds = parseBigInt(buy.actual_seconds_added) ?? 0n;

  if (flagPenalty > 0n) {
    push({ id: "flag", label: "Flag −BP", sub: flagPenalty.toString(), tone: "danger" });
  }
  if (buy.timer_hard_reset) {
    push({
      id: "hreset",
      label: "Hard reset",
      sub: seconds > 0n ? `+${seconds.toString()}s` : undefined,
      tone: "warning",
    });
  }
  if (streakBreak > 0n) {
    push({ id: "sbreak", label: "Streak break", sub: `+${streakBreak.toString()} BP`, tone: "success" });
  }
  if (ambush > 0n) {
    push({ id: "ambush", label: "Ambush", sub: `+${ambush.toString()} BP`, tone: "success" });
  }
  if (clutch > 0n) {
    push({ id: "clutch", label: "Clutch", sub: `+${clutch.toString()} BP`, tone: "success" });
  }
  if (resetBp > 0n) {
    push({ id: "tbp", label: "Timer BP", sub: `+${resetBp.toString()} BP`, tone: "warning" });
  }
  if (activeStreak >= 2n) {
    push({
      id: "def",
      label: "Defend",
      sub: `${activeStreak.toString()}×`,
      tone: "info",
    });
  }
  if (bpAfter !== null && bpAfter > 0n) {
    push({ id: "wb", label: "WarBow", sub: `${bpAfter.toString()} BP`, tone: "info" });
  }
  if (seconds > 0n && !buy.timer_hard_reset) {
    push({ id: "tadd", label: "+Clock", sub: `+${seconds.toString()}s`, tone: "neutral" });
  }

  if (out.length === 0) {
    push({ id: "buy", label: "Buy", sub: "—", tone: "neutral" });
  }
  return out.slice(0, max);
}

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

function perspectiveLabel(
  actor: string | undefined,
  viewer: string | undefined,
  selfText: string,
  formatShort: WalletFormatShort,
): string {
  if (sameAddress(actor, viewer)) {
    return selfText;
  }
  return formatShort(actor, "Unknown player");
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

  /** When remaining is already at `timerCapSec`, `extendDeadline` cannot add the full +120s (on-chain `actualSecondsAdded` is 0). */
  if (timerExtensionPreview === 0 && remainingSec > 300) {
    return {
      tone: "calm",
      label: "Timer at max window",
      detail:
        "The countdown is already at the maximum remaining time allowed by the contract (timer cap). Buys still matter for podiums and WarBow, but the deadline cannot extend past this cap—so you will not see a +120s jump until remaining drops below the cap.",
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

export function buildBuyFeedNarrative(
  buy: BuyItem,
  viewer: string | undefined,
  formatShort: WalletFormatShort = shortAddress,
): FeedNarrative {
  const buyer = perspectiveLabel(buy.buyer, viewer, "You", formatShort);
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
    headline = `${buyer} pulled the timer back into safer ground`;
  } else if (streakBreakBonus > 0n) {
    headline = `${buyer} cracked a defended streak`;
  } else if (clutchBonus > 0n) {
    headline = `${buyer} landed a clutch save`;
  }

  return {
    eyebrow: "Momentum shift",
    headline,
    detail: impactParts.length > 0 ? impactParts.join(" · ") : "Fresh buy mirrored from chain.",
    tags,
  };
}

export function buildBuyHistoryPoints(
  buys: BuyItem[] | null | undefined,
  limit = 6,
  formatShort: WalletFormatShort = shortAddress,
): BuyHistoryPoint[] {
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
      buyer: formatShort(buy.buyer, "Unknown player"),
      width,
      secondsAdded: secondsAdded.toString(),
      totalRaisedAfter: totalRaisedAfter.toString(),
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

export type BuyDetailRow = {
  label: string;
  value: string;
};

/** Flat key/value rows for a full buy-detail panel (indexer-derived fields). */
export function formatBuyDetailRows(buy: BuyItem): BuyDetailRow[] {
  const nz = (v: unknown): string => {
    if (v === undefined || v === null) {
      return "—";
    }
    if (typeof v === "boolean") {
      return v ? "yes" : "no";
    }
    const s = String(v).trim();
    return s.length > 0 ? s : "—";
  };

  return [
    { label: "Block", value: nz(buy.block_number) },
    { label: "Block hash", value: nz(buy.block_hash) },
    { label: "TimeCurve contract", value: nz(buy.contract_address) },
    { label: "Transaction", value: nz(buy.tx_hash) },
    { label: "Log index", value: String(buy.log_index) },
    { label: "Block time (unix sec)", value: nz(buy.block_timestamp) },
    { label: "Buyer", value: nz(buy.buyer) },
    { label: "Spend amount (raw)", value: nz(buy.amount) },
    { label: "CHARM (wad)", value: nz(buy.charm_wad) },
    { label: "Price per CHARM (wad)", value: nz(buy.price_per_charm_wad) },
    { label: "New deadline (unix sec)", value: nz(buy.new_deadline) },
    { label: "Total raised after (raw)", value: nz(buy.total_raised_after) },
    { label: "Buy index", value: nz(buy.buy_index) },
    { label: "Seconds added (effective)", value: nz(buy.actual_seconds_added) },
    { label: "Timer hard reset", value: nz(buy.timer_hard_reset) },
    { label: "Battle points after", value: nz(buy.battle_points_after) },
    { label: "BP — base buy", value: nz(buy.bp_base_buy) },
    { label: "BP — timer reset", value: nz(buy.bp_timer_reset_bonus) },
    { label: "BP — clutch", value: nz(buy.bp_clutch_bonus) },
    { label: "BP — streak break", value: nz(buy.bp_streak_break_bonus) },
    { label: "BP — ambush", value: nz(buy.bp_ambush_bonus) },
    { label: "BP — flag penalty", value: nz(buy.bp_flag_penalty) },
    {
      label: "Buy.flagPlanted (true iff this buy opted into WarBow flag plant; see docs)",
      value: nz(buy.flag_planted),
    },
    { label: "Buyer effective timer (sec indexed)", value: nz(buy.buyer_total_effective_timer_sec) },
    { label: "Buyer active defended streak", value: nz(buy.buyer_active_defended_streak) },
    { label: "Buyer best defended streak", value: nz(buy.buyer_best_defended_streak) },
  ];
}

export function describeStealPreflight(
  params: {
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
  },
  formatShort: WalletFormatShort = shortAddress,
): WarbowPreflightNarrative {
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
      detail: `${formatShort(victim, "Victim")} has ${victimBattlePoints} BP vs your ${viewerBattlePoints} BP, so the steal would revert right now.`,
    };
  }
  if (victimStealsToday !== undefined && victimStealsToday >= maxStealsPerDay && !bypassSelected) {
    return {
      tone: "warning",
      title: "Daily cap reached",
      detail: `${formatShort(victim, "Victim")} already hit ${maxStealsPerDay} steals today. Enable bypass if you still want to burn for the hit.`,
    };
  }
  return {
    tone: guardActive ? "warning" : "success",
    title: "Steal looks eligible",
    detail: guardActive
      ? `${formatShort(victim, "Victim")} passes the 2x rule. Your own guard is already live, so decide whether to keep defending or convert that safety into pressure.`
      : `${formatShort(victim, "Victim")} passes the 2x rule${victimStealsToday !== undefined ? ` and is at ${victimStealsToday}/${maxStealsPerDay} steals today` : ""}.`,
  };
}

export function buildWarbowFeedNarrative(
  item: WarbowBattleFeedItem,
  viewer: string | undefined,
  formatShort: WalletFormatShort = shortAddress,
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
        headline: `${perspectiveLabel(attacker, viewer, "You", formatShort)} stole from ${perspectiveLabel(victim, viewer, "you", formatShort)}`,
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
        headline: `${perspectiveLabel(avenger, viewer, "You", formatShort)} struck back at ${perspectiveLabel(stealer, viewer, "you", formatShort)}`,
        detail: amountBp !== null ? `Revenge reclaimed ${amountBp} BP.` : "A revenge window was converted into a counter-hit.",
        tags,
      };
    case "guard_activated":
      if (burnPaidWad !== null) {
        tags.push("guarded");
      }
      return {
        eyebrow: "WarBow defense",
        headline: `${perspectiveLabel(player, viewer, "You", formatShort)} activated guard`,
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
        eyebrow: "Flag won",
        headline: `${perspectiveLabel(player, viewer, "You", formatShort)} held silence and claimed the flag`,
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
      tags.push("pending cleared");
      return {
        eyebrow: "Flag destroyed",
        headline: `${perspectiveLabel(formerHolder, viewer, "You", formatShort)} lost a flag to ${perspectiveLabel(
          interrupter,
          viewer,
          "you",
          formatShort,
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
        headline: `${perspectiveLabel(detail.wallet as string | undefined, viewer, "You", formatShort)} kept the streak alive`,
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
        headline: `${perspectiveLabel(interrupter, viewer, "You", formatShort)} snapped ${perspectiveLabel(formerHolder, viewer, "your", formatShort)} streak`,
        detail:
          brokenLength !== null
            ? `A defended streak of ${brokenLength} was ended.`
            : "A defended streak was cut off by another buyer.",
        tags,
      };
    case "defended_streak_window_cleared":
      return {
        eyebrow: "Window cleared",
        headline: `${perspectiveLabel(detail.cleared_wallet as string | undefined, viewer, "You", formatShort)} lost the under-15-minute window`,
        detail: "The timer climbed high enough that the current streak phase reset.",
        tags,
      };
    case "cl8y_burned":
      if (burnPaidWad !== null) {
        tags.push("CL8Y burn");
      }
      return {
        eyebrow: "WarBow burn",
        headline: `${perspectiveLabel(detail.payer as string | undefined, viewer, "You", formatShort)} paid the PvP burn`,
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
