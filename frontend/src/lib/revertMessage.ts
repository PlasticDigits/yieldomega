// SPDX-License-Identifier: AGPL-3.0-only

import { BaseError } from "viem";

/** Map common revert strings to short UI copy (still show raw tail if unknown). */
export function friendlyRevertMessage(raw: string): string {
  const s = raw.toLowerCase();
  const map: [string, string][] = [
    ["timecurve: below min buy", "Amount is below the current minimum buy."],
    ["timecurve: above cap", "Amount exceeds the per-transaction cap."],
    ["timecurve: below min charms", "This charm size slipped below the live minimum for the current timer state."],
    ["timecurve: above max charms", "This charm size is above the live maximum for the current timer state."],
    ["timecurve: timer expired", "The sale timer has expired."],
    ["timecurve: timer not expired", "This action only works after the live timer fully expires."],
    ["timecurve: ended", "This sale has ended."],
    ["timecurve: already ended", "This sale was already ended onchain."],
    ["timecurve: not started", "The sale has not started yet."],
    ["timecurve: bad phase", "This action is not available in the current sale phase."],
    ["timecurve: self-referral", "You cannot use your own referral code."],
    ["timecurve: invalid referral", "That referral code is not registered."],
    ["timecurve: referral disabled", "Referrals are not enabled for this deployment."],
    ["timecurve: referral amount", "This referral bonus no longer fits inside the selected charm size."],
    ["timecurve: not ended", "This action is only available after the sale ends."],
    ["timecurve: no charm weight", "This wallet has no charm weight to redeem."],
    ["timecurve: already redeemed", "This wallet already redeemed its charms."],
    ["timecurve: nothing to redeem", "There is nothing claimable for this wallet at current totals."],
    ["timecurve: steal victim daily limit", "That victim already hit the daily steal cap unless you pay the bypass burn."],
    ["timecurve: steal 2x rule", "You can only steal from a rival with at least 2x your Battle Points."],
    ["timecurve: bad victim", "Choose a real rival address instead of zero or your own wallet."],
    ["timecurve: steal zero", "That steal would move zero Battle Points, so the contract rejected it."],
    ["timecurve: not flag holder", "Only the wallet holding the planted flag can claim it."],
    ["timecurve: flag silence", "The silence timer has not finished, so the flag is not claimable yet."],
    ["timecurve: revenge not pending", "There is no pending revenge target for this wallet."],
    ["timecurve: revenge expired", "The revenge window already expired."],
    ["timecurve: revenge zero", "That revenge would move zero Battle Points, so it was rejected."],
    ["timecurve: prizes done", "Prize distribution already ran for this round."],
    ["referralregistry: code taken", "That referral code is already taken."],
    ["referralregistry: already registered", "This wallet already registered a code."],
    ["referralregistry: invalid length", "Referral code must be 3–16 characters."],
    ["referralregistry: invalid charset", "Referral code may only use letters and digits."],
    ["burrow:", "Treasury rule rejected this transaction (see wallet details)."],
    ["user rejected", "Transaction was rejected in the wallet."],
    ["user denied", "Transaction was rejected in the wallet."],
  ];
  for (const [k, v] of map) {
    if (s.includes(k)) {
      return v;
    }
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

const BARE_BUY_CHARM_SHIFT_HINT =
  "The CHARM amount band or onchain price moved between quote and submit. Try nudging the CHARM amount slightly or wait one block and retry.";

function looksLikeBareExecutionRevert(raw: string): boolean {
  const s = raw.toLowerCase();
  if (s.includes("user rejected") || s.includes("user denied")) return false;
  if (s.includes("timecurve:")) return false;
  return (
    s.includes("execution reverted for an unknown reason") ||
    s.includes("execution reverted with no data") ||
    /^execution reverted\.?$/i.test(s.trim())
  );
}

export type FriendlyRevertOpts = {
  /** Use when catching from TimeCurve buy / `buyViaKumbaya` submit ([GitLab #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)). */
  buySubmit?: boolean;
};

/** Prefer viem `BaseError` fields (`shortMessage`, `details`) when present. */
export function friendlyRevertFromUnknown(err: unknown, opts?: FriendlyRevertOpts): string {
  let raw: string;
  if (err instanceof BaseError) {
    const details = "details" in err && typeof err.details === "string" ? err.details : "";
    raw = [err.shortMessage, details, err.message].filter(Boolean).join(" ");
  } else if (err instanceof Error) {
    raw = err.message;
  } else {
    raw = String(err);
  }
  if (opts?.buySubmit && looksLikeBareExecutionRevert(raw)) {
    return BARE_BUY_CHARM_SHIFT_HINT;
  }
  return friendlyRevertMessage(raw);
}
