// SPDX-License-Identifier: AGPL-3.0-only

import { BaseError } from "viem";
import { parseCommaSeparatedRpcUrls } from "@/lib/chain";
import { WALLET_WRITE_NOT_READY_MESSAGE } from "@/lib/walletBuySessionGuard";
import { GasSoftCapExceededError } from "@/lib/writeContractWithGasBuffer";

/** Placeholder when RPC URLs or hosted keys would otherwise appear in UI ([GitLab #145](https://gitlab.com/PlasticDigits/yieldomega/-/issues/145)). */
export const REDACTED_RPC_URL_MARKER = "[RPC URL redacted]";

export type RedactUserVisibleRpcOpts = {
  /** Extra substrings to strip (tests); longest-first merge with build-time RPC when set. */
  extraKnownRpcUrlSubstrings?: readonly string[];
};

/**
 * Removes embedded RPC URLs from user-visible error text so screenshots / DevTools do not leak keys.
 * Applies each URL in comma-separated **`VITE_RPC_URL`** when defined, plus generic **`*.alchemy.com/v2/*`**, **`*.infura.io/v3/*`**, **`*.quiknode.pro/*`** patterns.
 */
export function redactSensitiveUrlsInUserMessage(raw: string, opts?: RedactUserVisibleRpcOpts): string {
  let s = raw;
  const fromEnv = parseCommaSeparatedRpcUrls(
    typeof import.meta.env.VITE_RPC_URL === "string" ? import.meta.env.VITE_RPC_URL : undefined,
  );
  const extras = opts?.extraKnownRpcUrlSubstrings ?? [];
  const known = [...extras, ...fromEnv].sort((a, b) => b.length - a.length);
  for (const fragment of known) {
    if (!fragment.length || !s.includes(fragment)) continue;
    s = s.split(fragment).join(REDACTED_RPC_URL_MARKER);
  }
  const patterns: RegExp[] = [
    /https?:\/\/[^\s)'"<]+\.alchemy\.com\/v2\/[^\s)'"<]+/gi,
    /wss?:\/\/[^\s)'"<]+\.alchemy\.com[^\s)'"<]+/gi,
    /https?:\/\/[^\s)'"<]+\.infura\.io\/v3\/[^\s)'"<]+/gi,
    /https?:\/\/[^\s)'"<]+\.quiknode\.pro\/[^\s)'"<]+/gi,
  ];
  for (const re of patterns) {
    s = s.replace(re, REDACTED_RPC_URL_MARKER);
  }
  return s;
}

/** OpenZeppelin IERC20Errors `ERC20InsufficientAllowance` selector — surfaced by CL8Y `safeTransferFrom` pulls. */
export const ERC20_INSUFFICIENT_ALLOWANCE_SELECTOR = "0xfb8f41b2";

/** Map common revert strings to short UI copy (still show raw tail if unknown). */
export function friendlyRevertMessage(raw: string): string {
  const s = raw.toLowerCase();
  const map: [string, string][] = [
    ["timecurve: below min buy", "Amount is below the current minimum buy."],
    ["timearena: below min buy", "Amount is below the current minimum buy."],
    ["timecurve: above cap", "Amount exceeds the per-transaction cap."],
    ["timecurve: below min charms", "This charm size slipped below the live minimum for the current timer state."],
    ["timecurve: above max charms", "This charm size is above the live maximum for the current timer state."],
    ["timearena: charm bounds", "This charm size is outside the live min–max band. Nudge the amount or wait one block and retry."],
    ["timecurve: timer expired", "The arena timer has expired."],
    ["timearena: timer expired", "The arena timer has expired."],
    ["timecurve: timer not expired", "This action only works after the live timer fully expires."],
    ["timecurve: ended", "This sale has ended."],
    ["timecurve: already ended", "This sale was already ended onchain."],
    ["timecurve: not started", "The arena has not opened yet."],
    ["timearena: not started", "The arena has not opened yet."],
    ["timecurve: bad phase", "This action is not available in the current arena phase."],
    ["timearena: paused", "The arena is paused — buys are disabled until an operator resumes."],
    ["timecurve: self-referral", "You cannot use your own referral code."],
    ["timearena: self-referral", "You cannot use your own referral code."],
    ["timecurve: invalid referral", "That referral code is not registered."],
    ["timearena: invalid referral", "That referral code is not registered."],
    ["timecurve: referral disabled", "Referrals are not enabled for this deployment."],
    ["timecurve: referral amount", "This referral bonus no longer fits inside the selected charm size."],
    ["timecurve: not ended", "This action is only available after the sale ends."],
    ["timecurve: no charm weight", "This wallet has no charm weight to redeem."],
    ["timecurve: already redeemed", "This wallet already redeemed its charms."],
    ["timecurve: nothing to redeem", "There is nothing claimable for this wallet at current totals."],
    ["timearena: nothing to claim", "There is nothing claimable for this wallet at current totals."],
    ["timecurve: steal victim daily limit", "That victim already hit the daily steal cap unless you pay the bypass spend."],
    [
      "timecurve: steal attacker daily limit",
      "You already landed three steals today from this wallet unless you pay the bypass spend.",
    ],
    ["timearena: steal limit", "You already landed three steals today from this wallet unless you pay the bypass spend."],
    [
      "timearena: steal band",
      "Stealing requires positive Battle Points on your wallet and a victim with at least 1× your Battle Points (and at most 50× — see the steal preflight).",
    ],
    [
      "timecurve: steal 10x cap",
      "That victim’s Battle Points are too far above yours for a steal under the onchain 1×–50× band.",
    ],
    ["timecurve: bad victim", "Choose a real rival address instead of zero or your own wallet."],
    ["timearena: bad victim", "Choose a real rival address instead of zero or your own wallet."],
    ["timecurve: steal zero", "That steal would move zero Battle Points, so the contract rejected it."],
    ["timearena: steal zero", "That steal would move zero Battle Points, so the contract rejected it."],
    ["timecurve: not flag holder", "Only the wallet holding the planted flag can claim it."],
    ["timearena: not flag holder", "Only the wallet holding the planted flag can claim it."],
    ["timecurve: flag silence", "The silence timer has not finished, so the flag is not claimable yet."],
    ["timearena: flag silence", "The silence timer has not finished, so the flag is not claimable yet."],
    ["timecurve: revenge not pending", "There is no pending revenge target for this wallet."],
    ["timecurve: revenge expired", "The revenge window already expired."],
    ["timearena: revenge", "The revenge window already expired."],
    ["timecurve: revenge zero", "That revenge would move zero Battle Points, so it was rejected."],
    ["timearena: revenge zero", "That revenge would move zero Battle Points, so it was rejected."],
    ["timecurve: prizes done", "Prize distribution already ran for this round."],
    ["timearena: buy cooldown", "This wallet is still waiting for its next Arena move. Wait a moment and retry."],
    ["timearena: burst cooldown", "This wallet just spent an Arena move. Wait a few seconds and retry."],
    ["timearena: no buy charges", "This wallet has no Arena moves available yet. Wait for the next charge."],
    ["referralregistry: code taken", "That referral code is already taken."],
    ["referralregistry: already registered", "This wallet already registered a code."],
    ["referralregistry: invalid length", "Referral code must be 3–16 characters."],
    ["referralregistry: invalid charset", "Referral code may only use letters and digits."],
    ["user rejected", "Transaction was rejected in the wallet."],
    ["user denied", "Transaction was rejected in the wallet."],
    [
      "erc20insufficientallowance",
      "CL8Y allowance was short at inclusion—the curve charges the live price when the transaction lands. Retry once.",
    ],
    [
      "stf()",
      "The Kumbaya swap needed more pay-token than your max slippage allows—the linear CHARM price may have moved. Retry in a few seconds.",
    ],
    ["0x817275ab", "The Kumbaya swap needed more pay-token than your max slippage allows—the linear CHARM price may have moved. Retry in a few seconds."],
    ["timecurvebuyrouter__badsalephase", "Time Arena is not open for Kumbaya buys right now (not started, paused, or past the timer)."],
    [
      "timearenabuyrouter__badphase",
      "Arena buys are not open right now (pre-launch, paused, or past the timer).",
    ],
    ["timecurvebuyrouter__charmbounds", "CHARM size is outside the live min–max band. Nudge the amount or wait one block and retry."],
    ["timearenabuyrouter__charmbounds", "CHARM size is outside the live min–max band. Nudge the amount or wait one block and retry."],
    ["timecurvebuyrouter__badpath", "Kumbaya swap path is misconfigured for this chain. Contact support if this persists."],
    ["timearenabuyrouter__badpath", "Kumbaya swap path is misconfigured for this chain. Contact support if this persists."],
    ["timecurvebuyrouter__ethmode", "ETH pay mode requires a WETH-terminated swap path."],
    ["timecurvebuyrouter__stablemode", "USDM pay mode requires a stable-terminated swap path."],
    ["0x2be94f46", "Time Arena is not open for Kumbaya buys right now (not started, paused, or past the timer)."],
    ["0xa8130f38", "CHARM size is outside the live min–max band. Nudge the amount or wait one block and retry."],
    ["0xe5e8a567", "Kumbaya swap path is misconfigured for this chain. Contact support if this persists."],
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
  if (s.includes("timecurve:") || s.includes("timearena:")) return false;
  return (
    s.includes("execution reverted for an unknown reason") ||
    s.includes("execution reverted with no data") ||
    /^execution reverted\.?$/i.test(s.trim())
  );
}

export type FriendlyRevertOpts = {
  /** Use when catching from Time Arena buy / `buyViaKumbaya` submit ([GitLab #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)). */
  buySubmit?: boolean;
};

/** Prefer viem `BaseError` fields (`shortMessage`, `details`) when present. */
export function friendlyRevertFromUnknown(err: unknown, opts?: FriendlyRevertOpts): string {
  if (err instanceof GasSoftCapExceededError) {
    return `Gas estimate (${err.estimatedGas}) exceeds the safety cap (${err.softCapGas}) after the +30% buffer. Retry shortly or contact support if this persists.`;
  }
  let raw: string;
  if (err instanceof BaseError) {
    // Prefer viem's user-facing `shortMessage` to avoid duplication: `err.message` already
    // contains `shortMessage` plus a "Contract Call:" footer with metadata, so concatenating
    // all three fields produced repeated revert text and a leaked footer in the UI ([#183](https://gitlab.com/PlasticDigits/yieldomega/-/issues/183)).
    const details = "details" in err && typeof err.details === "string" ? err.details : "";
    raw = err.shortMessage || details || err.message;
  } else if (err instanceof Error) {
    raw = err.message;
  } else {
    raw = String(err);
  }
  raw = redactSensitiveUrlsInUserMessage(raw);
  const loweredFull = raw.toLowerCase();
  if (
    loweredFull.includes("connection.connector.getchainid is not a function") ||
    loweredFull.includes("connection.connector.getprovider is not a function")
  ) {
    return WALLET_WRITE_NOT_READY_MESSAGE;
  }
  if (
    loweredFull.includes(ERC20_INSUFFICIENT_ALLOWANCE_SELECTOR.slice(2).toLowerCase()) ||
    loweredFull.includes("erc20insufficientallowance")
  ) {
    return friendlyRevertMessage("ERC20InsufficientAllowance");
  }
  if (opts?.buySubmit && looksLikeBareExecutionRevert(raw)) {
    return BARE_BUY_CHARM_SHIFT_HINT;
  }
  return friendlyRevertMessage(raw);
}
