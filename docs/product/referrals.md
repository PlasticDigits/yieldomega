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

<a id="referral-registration-ordering-issue-121"></a>

### Registration ordering and mempool visibility (audit L-02; [GitLab #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121))

- **Winner rule:** `ReferralRegistry` assigns a code to the **first address whose `registerCode` succeeds** for that normalized slug. Later attempts revert with **`ReferralRegistry: code taken`**. There is **no** protocol-level reservation keyed on “I submitted first” or a pending public-mempool transaction.
- **Calldata on public mempools:** The **plaintext code** is in `registerCode` calldata **before execution**. Anyone who observes a pending registration may broadcast a competing transaction with the **same normalized code**; **miner/builder ordering, gas price, and inclusion rules** decide which executes first ([audit L-02](../../audits/audit_smartcontract_1777813071.md#l-02-referral-code-registration-is-front-runnable)).
- **Burn as an economic barrier, not FIFO fairness:** **`registrationBurnAmount`** CL8Y is transferred **only after** uniqueness checks succeed ([CL8Y token §](#cl8y-token)). The **successful** claimant pays the burn to the irreversible sink; **failed / reverted** attempts **do not** spend that registration burn ([`ReferralRegistry.sol`](../../contracts/src/ReferralRegistry.sol)).
- **Product stance (v1):** Treat ordering as **transparent and onchain** — disclosure in product docs + register UX; **no** commit‑reveal, signed offchain reservations, or private‑mempool‑only flows in this work item ([issue #121](https://gitlab.com/PlasticDigits/yieldomega/-/issues/121)).

Invariant + test-strategy notes: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#referral-registration-ordering-issue-121) · Contributor checklist: [`docs/testing/manual-qa-checklists.md`](../testing/manual-qa-checklists.md#manual-qa-issue-121-referrals-register-disclosure).

## Related contracts

- `ReferralRegistry` — code ownership and CL8Y burn.
- `TimeCurve` — optional `IReferralRegistry`; `buy(charmWad, codeHash, plantWarBowFlag)` applies splits.

<a id="referrals-dashboard-issue-94"></a>

## `/referrals` dashboard — leaderboards and earnings ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94))

The frontend may surface **derived** referral metrics for UX. They must map to **measurable indexer fields** or **direct contract views** — never invented scores.

| Surface | Authority | Indexer / RPC |
|--------|-----------|---------------|
| **Referrer leaderboard** | **Σ `referrerCharmAdded`** per referrer from indexed **`ReferralApplied`**, plus **onchain code registrations** from **`ReferralCodeRegistered`** so guides appear before the first qualifying buy ([GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204)) | `GET /v1/referrals/referrer-leaderboard?limit=&offset=` (schema **≥ 1.19.0**) — distinct **`referrer`** keys = **`UNION(owner_address from idx_referral_code_registered, referrer from idx_timecurve_referral_applied)`**; **`codes_registered_count`** counts registry rows per owner; **`referred_buy_count`** / CHARM totals remain **`ReferralApplied`** aggregates; ordering uses dense **`RANK()`** over Σ CHARM then **`referrer ASC`** ([GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170), [GitLab #177](https://gitlab.com/PlasticDigits/yieldomega/-/issues/177)). |
| **Wallet CHARM summary** | Same log fields, filtered by wallet | `GET /v1/referrals/wallet-charm-summary?wallet=0x…` — **`referrer_charm_wad`** = Σ `referrer_amount` where `referrer = wallet`; **`referee_charm_wad`** = Σ `referee_amount` where `buyer = wallet`; counts are indexed referral buy rows (not total sale CHARM weight). |
| **CL8Y / pay-asset “notional” on `/referrals`** | Illustrative only | Uses live **`currentPricePerCharmWad`** × combined indexed referral CHARM for **spot CL8Y** at the current sale curve; **USDM** / **ETH** hints reuse the same **static fallback** multipliers as other pay-mode labels (`frontend/src/lib/kumbayaDisplayFallback.ts`), not live DEX quotes. |

Indexer implementation keeps **`buyer` / `referrer`** as **lowercase** hex at insert; HTTP handlers bind lowercase addresses and use **bare equality** in SQL so btree indexes apply (**[`INV-INDEXER-165`](../testing/invariants-and-business-logic.md#indexer-referral-applied-address-predicates-gitlab-165)**, [GitLab #165](https://gitlab.com/PlasticDigits/yieldomega/-/issues/165)).

**Wagmi** currently exposes **one active address**; the “Connected wallet” panel documents that multi-account wallets still switch one address at a time.

## Automated checks (frontend)

Playwright maps the **YO Referrals visual verification** checklist ([GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)): shell + `?ref=` in [`frontend/e2e/referrals-surface.spec.ts`](../frontend/e2e/referrals-surface.spec.ts); register + share links + clipboard with **Anvil + DeployDev** in [`frontend/e2e/anvil-referrals.spec.ts`](../frontend/e2e/anvil-referrals.spec.ts) (`bash scripts/e2e-anvil.sh`). **Copy confirmation** (visible banner + error path when clipboard is unavailable) is specified in [GitLab #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86). **Leaderboard + earnings** ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94)): indexer routes **`/v1/referrals/referrer-leaderboard`** and **`/v1/referrals/wallet-charm-summary`** — see [§ Dashboard](#referrals-dashboard-issue-94) above. Invariant table: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#referrals-page-visual-issue-64). Third-party agents walking the checklist: [`../testing/manual-qa-checklists.md#manual-qa-issue-64`](../testing/manual-qa-checklists.md#manual-qa-issue-64). Storage key names for R4 vs R7: [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85).

---

**Agent phase:** product / implementation (referrals)
