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

- The buyer calls **`buy(charmWad, codeHash)`** with a **non-zero** `codeHash` only when using a referral. If `codeHash` is zero, behavior matches **`buy(charmWad)`** (no referral split).
- **Referrer** is `ReferralRegistry.ownerOfCode(codeHash)`. If `codeHash` is non-zero but unregistered, the transaction **reverts**.
- **Self-referral** (`referrer == buyer`) **reverts**.
- **Binding:** Referral is applied **per transaction** from the **provided `codeHash`**; there is no persistent “bound referrer” in the registry for the buyer (the UI may cache a pending code for UX only).

## Reward math (TimeCurve, canonical)

On a referred buy, let **`charmWad`** be the buyer’s CHARM quantity (WAD) and **`amount`** the **gross accepted-asset spend** = `charmWad × pricePerCharmWad / 1e18` (see [primitives](primitives.md)).

- **`FeeRouter` path:** the **entire** **`amount`** is transferred to **`FeeRouter.distributeFees`** (canonical **five-sink** split — see [fee routing](../onchain/fee-routing-and-governance.md)).
- **CHARM (referral):** **`refEach = charmWad × 1000 / 10_000`** (10% of `charmWad` each). **Referrer** and **buyer** each receive **`refEach`** as additional **`charmWeight`**. No **reserve-asset** transfer is made to them on the referral path.
- **`totalRaised`:** increases by **`amount`** (gross) for sale accounting.
- **`charmWeight` / `totalCharmWeight`:** buyer accrues **`charmWad + refEach`**; referrer accrues **`refEach`**; **`totalCharmWeight`** increases by **`charmWad + 2 × refEach`**.
- **DOUB redemption:** `redeemCharms` uses **`totalCharmWeight`** in the denominator: `totalTokensForSale * charmWeight[user] / totalCharmWeight`.

**Reserve podiums:** Onchain **prize** categories are **last buy**, **WarBow** (top Battle Points), **defended streak**, and **time booster** ([primitives](primitives.md)). Referral splits affect **`charmWeight`** and thus **redemption**; they do **not** pay reserve to referrer/referee and are unrelated to podium scoring except indirectly through participation patterns.

**Min buy and cap:** Enforced on **`charmWad`** within **`currentCharmBoundsWad`** and implied gross spend via **`currentMinBuyAmount` / `currentMaxBuyAmount`**.

## Anti-abuse

- **Burn** on registration reduces code squatting.
- **Self-referral** blocked onchain.
- **Invalid or unregistered codes** revert (no silent fallback).

## Related contracts

- `ReferralRegistry` — code ownership and CL8Y burn.
- `TimeCurve` — optional `IReferralRegistry`; `buy(charmWad, codeHash)` applies splits.

---

**Agent phase:** product / implementation (referrals)
