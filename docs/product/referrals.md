# Referral program (TimeCurve)

## Purpose

Let users **register a short referral code** by paying a **fixed CL8Y burn**, then share links so **new buyers** can be attributed onchain. Rewards are enforced in **`TimeCurve`** on qualifying buys—**not** by the indexer or local browser storage.

See also: [fee routing](../onchain/fee-routing-and-governance.md) (full **gross** buy is routed through `FeeRouter`; referral incentives are **CHARM weight**, documented below).

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

- **`FeeRouter` path:** the **entire** `amount` is transferred to **`FeeRouter.distributeFees`** (canonical **five-sink** split — see [fee routing](../onchain/fee-routing-and-governance.md)).
- **CHARM (referral):** **Referrer** and **referee** each receive **10%** of `amount` (`1000` bps each) as additional **`charmWeight`** (same units as spend-based CHARM). No **reserve-asset** transfer is made to them on the referral path.
- **`totalRaised`:** still increases by **`amount`** (gross) for sale accounting.
- **`totalCharmWeight`:** increases by **`amount + 2 × (amount × 1000 / 10000)`** on a referred buy (buyer’s weight includes base spend plus referee bonus; referrer’s weight includes referrer bonus).
- **DOUB redemption:** `redeemCharms` clears against **`totalCharmWeight`** in the denominator: `totalTokensForSale * charmWeight[user] / totalCharmWeight`.

**Podiums:** last-buy / most-buys / biggest-buy / cumulative CHARM podiums still key off **per-buy `amount`** and onchain counters as implemented in **`TimeCurve`** (referral CHARM bonuses affect **cumulative CHARM** and redemption shares).

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
