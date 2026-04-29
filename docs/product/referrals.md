# Referral program (TimeCurve)

## Purpose

Let users **register a short referral code** by paying a **fixed CL8Y burn**, then share links so **new buyers** can be attributed onchain. Rewards are enforced in **`TimeCurve`** on qualifying buys—**not** by the indexer or local browser storage.

See also: [fee routing](../onchain/fee-routing-and-governance.md) (full **gross** buy is routed through `FeeRouter`; referral incentives are **CHARM weight**, documented below). **Launch UX / F-11:** **`/referrals`** is **not** an **`UnderConstruction`** stub — it ships the full referrals surface at TGE ([`launchplan-timecurve.md`](../../launchplan-timecurve.md#6-under-construction-frontend), [GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)).

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

## Client link capture (frontend)

<a id="referral-browser-storage-keys"></a>

- **Search:** `?ref={code}` — when present, must normalize to a valid code (3–16, `a-z0-9` after lowercasing) or it is ignored.
- **Path (under TimeCurve):** `/timecurve/{code}` when the second segment is **not** a fixed sub-route such as `arena` or `protocol` (or another reserved name; mirror list in `frontend/src/lib/referralPathReserved.ts` until a governance on-chain set exists).
- **Not exposed as a top-level public route:** a bare `/{code}` is not used in the app shell, because a dynamic first segment can collide with real routes (e.g. post-launch `/home`). Use `?ref=` and `/timecurve/{code}` instead.
- **Precedence:** If both a valid `?ref=` and a path-based code are present, **`?ref=` wins** (query overrides path).
- **Browser storage (two keys; implementation in `frontend/src/lib/referralStorage.ts`):** neither store is authoritative for code ownership — the chain is. Users can clear entries in devtools.

| Purpose | Storage | Key | JSON payload |
|---------|---------|-----|----------------|
| **Pending** referral (captured from `?ref=` or allowed path before a buy) | **`localStorage` and `sessionStorage`** (same key in both) | `yieldomega.ref.v1` | `{ "code": "<normalized>", "ts": <ms> }` — `code` is the pending slug for `codeHash` preview / apply on buy. |
| **Registered “my code”** UX cache (plaintext for share links after a successful `registerCode`) | **`localStorage` only** | `yieldomega.myrefcode.v1.<walletLowercase>` | `{ "code": "<normalized>", "ts": <ms> }` — one key per connected wallet (hex address lowercased). |

Spec / QA alignment: [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85) (do not assume a single `yieldomega.ref.v1` row covers post-register “my code”; that row is **pending capture** only).

- The **TimeCurve** buy UI reads the pending code for preview and for `codeHash` on `buy` when the user leaves “apply referral” enabled.

## Attribution (TimeCurve buys)

- The buyer calls **`buy(charmWad, codeHash, plantWarBowFlag)`** with a **non-zero** `codeHash` only when using a referral. If `codeHash` is zero, behavior matches **`buy(charmWad)`** / **`buy(charmWad, plantWarBowFlag)`** (no referral split). `plantWarBowFlag` is the WarBow opt-in from [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63).
- **Referrer** is `ReferralRegistry.ownerOfCode(codeHash)`. If `codeHash` is non-zero but unregistered, the transaction **reverts**.
- **Self-referral** (`referrer == buyer`) **reverts**.
- **Binding:** Referral is applied **per transaction** from the **provided `codeHash`**; there is no persistent “bound referrer” in the registry for the buyer (the UI may cache a pending code for UX only).

## Reward math (TimeCurve, canonical)

On a referred buy, let **`charmWad`** be the buyer’s CHARM quantity (WAD) and **`amount`** the **gross accepted-asset spend** = `charmWad × pricePerCharmWad / 1e18` (see [primitives](primitives.md)).

- **`FeeRouter` path:** the **entire** **`amount`** is transferred to **`FeeRouter.distributeFees`** (canonical **five-sink** split — see [fee routing](../onchain/fee-routing-and-governance.md)).
- **CHARM (referral):** **`refEach = charmWad × 500 / 10_000`** (5% of `charmWad` each). **Referrer** and **buyer** each receive **`refEach`** as additional **`charmWeight`**. No **reserve-asset** transfer is made to them on the referral path.
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
- `TimeCurve` — optional `IReferralRegistry`; `buy(charmWad, codeHash, plantWarBowFlag)` applies splits.

## Automated checks (frontend)

Playwright maps the **YO Referrals visual verification** checklist ([GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)): shell + `?ref=` in [`frontend/e2e/referrals-surface.spec.ts`](../frontend/e2e/referrals-surface.spec.ts); register + share links + clipboard with **Anvil + DeployDev** in [`frontend/e2e/anvil-referrals.spec.ts`](../frontend/e2e/anvil-referrals.spec.ts) (`bash scripts/e2e-anvil.sh`). **Copy confirmation** (visible banner + error path when clipboard is unavailable) is specified in [GitLab #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86). Invariant table: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#referrals-page-visual-issue-64). Third-party agents walking the checklist: [`skills/verify-yo-referrals-surface/SKILL.md`](../../skills/verify-yo-referrals-surface/SKILL.md). Storage key names for R4 vs R7: [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85).

---

**Agent phase:** product / implementation (referrals)
