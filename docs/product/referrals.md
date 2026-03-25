# Referral program (TimeCurve)

## Purpose

Let users **register a short referral code** by paying a **fixed CL8Y burn**, then share links so **new buyers** can be attributed onchain. Rewards are enforced in **`TimeCurve`** on qualifying buys—**not** by the indexer or local browser storage.

See also: [fee routing](../onchain/fee-routing-and-governance.md) (canonical TimeCurve sink split is unchanged in policy; referral carve is an explicit **per-buy** adjustment documented below).

## CL8Y token

- **Registration** burns **1 CL8Y** (`1e18` if 18 decimals) per successful registration.
- The **CL8Y ERC-20** used for registration is **not** [`CL8YProtocolTreasury`](../onchain/treasury-contracts.md) (that contract is a **fee sink**). Production uses the **governance-approved CL8Y token address** wired at deploy. Dev/test may use a **mock burnable ERC-20** with a faucet for local testing.

## Referral codes

| Rule | Value |
|------|--------|
| Length | **3–16** characters |
| Charset | **ASCII lowercase letters `a–z` and digits `0–9`** (input may be uppercased; canonical storage uses **normalized lowercase)** |
| Uniqueness | **One code per address**; each code **at most one owner** |
| Onchain identity | `bytes32 codeHash = keccak256(bytes(normalizedCode))` |

## Attribution (TimeCurve buys)

- The buyer calls `buy(amount, codeHash)` with a **non-zero** `codeHash` only when using a referral. If `codeHash` is zero, behavior matches `buy(amount)` (no referral split).
- **Referrer** is `ReferralRegistry.ownerOfCode(codeHash)`. If `codeHash` is non-zero but unregistered, the transaction **reverts**.
- **Self-referral** (`referrer == buyer`) **reverts**.
- **Binding:** Referral is applied **per transaction** from the **provided `codeHash`**; there is no persistent “bound referrer” in the registry for the buyer (the UI may cache a pending code for UX only).

## Reward math (TimeCurve, canonical)

On a referred buy of **gross** `amount` (accepted asset units):

- **Referrer** receives **10%** of `amount` (`1000` bps).
- **Referee** (buyer) receives **10%** of `amount` as an immediate rebate (`1000` bps).
- **Remaining 80%** of `amount` is routed through the existing **`FeeRouter.distributeFees`** path (canonical sink weights apply to **this** routed amount).

**Allocation and podiums:** `totalRaised`, `userSpend`, and prize tracking use the **full** `amount` (gross spend), consistent with the product rule that participation is measured on the **stated** buy size.

**Min buy and cap:** Checks use the **full** `amount` against `currentMinBuy` and per-transaction cap.

## Anti-abuse

- **Burn** on registration reduces code squatting.
- **Self-referral** blocked onchain.
- **Invalid or unregistered codes** revert (no silent fallback).

## Related contracts

- `ReferralRegistry` — code ownership and CL8Y burn.
- `TimeCurve` — optional `IReferralRegistry`; `buy(amount, codeHash)` applies splits.

---

**Agent phase:** product / implementation (referrals)
