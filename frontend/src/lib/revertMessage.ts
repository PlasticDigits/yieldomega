// SPDX-License-Identifier: AGPL-3.0-only

/** Map common revert strings to short UI copy (still show raw tail if unknown). */
export function friendlyRevertMessage(raw: string): string {
  const s = raw.toLowerCase();
  const map: [string, string][] = [
    ["timecurve: below min buy", "Amount is below the current minimum buy."],
    ["timecurve: above cap", "Amount exceeds the per-transaction cap."],
    ["timecurve: timer expired", "The sale timer has expired."],
    ["timecurve: ended", "This sale has ended."],
    ["timecurve: not started", "The sale has not started yet."],
    ["timecurve: self-referral", "You cannot use your own referral code."],
    ["timecurve: invalid referral", "That referral code is not registered."],
    ["timecurve: referral disabled", "Referrals are not enabled for this deployment."],
    ["timecurve: not ended", "This action is only available after the sale ends."],
    ["referralregistry: code taken", "That referral code is already taken."],
    ["referralregistry: already registered", "This wallet already registered a code."],
    ["referralregistry: invalid length", "Referral code must be 3–16 characters."],
    ["referralregistry: invalid charset", "Referral code may only use letters and digits."],
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
