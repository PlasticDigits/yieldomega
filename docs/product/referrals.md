# Referral program (TimeArena / ReferralRegistry)

## Arena v2 (live)

<a id="arena-v2-live"></a>

Arena v2 **`TimeArena`** buys attribute referrers via **`ReferralCredApplied`**: on each referred **DOUB** buy, **5 CRED** mints to referrer and **5 CRED** to buyer — **not** CHARM weight, independent of the **35 CRED** epoch pool ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272)). Registration still burns **1 CL8Y** per code for continuity. Full rules: [time-arena.md § Referrals](time-arena.md#referrals) · [GitLab #240](https://gitlab.com/PlasticDigits/yieldomega/-/issues/240) · baseline [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253).

### Code ownership continuity ([GitLab #253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253))

| Scenario | `codeHash → owner` |
|----------|-------------------|
| **UUPS implementation upgrade** (`ReferralRegistry` proxy unchanged) | **Preserved** — `codeOwner` / `ownerCode` live in proxy storage |
| **Fresh `ReferralRegistry` proxy deploy** (Arena v2 greenfield) | **Empty** — guides must **`registerCode`** again (same normalized slug → same `codeHash`) |
| **Production migration from v1 registry** | Export **`ReferralCodeRegistered`** rows from indexer or chain; governance batch **`registerCode`** from each owner wallet (or merkle-gated import script — not shipped in-repo; track as ops runbook) |

Onchain identity remains **`keccak256(bytes(normalizedCode))`** — unchanged from v1. Indexer table: **`idx_referral_code_registered`**.

### Arena v2 reward math ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272))

On a referred **DOUB** buy with **`REFERRAL_CRED_FLAT_WAD = 5e18`**:

- **`refEach = REFERRAL_CRED_FLAT_WAD`** (= **5 CRED** per side; **not** tied to **`CRED_PER_BUY`** epoch pool)
- **`playCred.mint(referrer, refEach)`** and **`playCred.mint(buyer, refEach)`**
- **`charmWeight`** accrues **only** the purchased **`charmWad`** — no referral CHARM bonus
- **`buyWithCred`** has **no** referral path (no `codeHash` param)
- **Self-referral** (`referrer == buyer`) **reverts** (`TimeArena: self-referral`)

Forge: [`TimeArena.t.sol::test_referred_buy_mints_cred_not_charm`](../../contracts/test/TimeArena.t.sol), [`test_self_referral_reverts`](../../contracts/test/TimeArena.t.sol). Indexer: **`idx_arena_referral_cred`** ← **`ReferralCredApplied`**. HTTP: **`GET /v1/referrals/applied`**, **`referrer-leaderboard`**, **`wallet-cred-summary`** (schema **≥ 2.3.0**).

---

## Legacy (TimeCurve — retired)

v1 **TimeCurve** referral CHARM-weight boosts and presale-attached attribution were removed with the launchpad ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). **`ReferralRegistry`** code registration (1 CL8Y burn) and Arena v2 **`ReferralCredApplied`** on DOUB buys remain live — see [Arena v2 (live)](#arena-v2-live) above.

<a id="referrals-dashboard-issue-94"></a>

## `/referrals` dashboard — leaderboards and earnings ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94))

The frontend may surface **derived** referral metrics for UX. They must map to **measurable indexer fields** or **direct contract views** — never invented scores.

| Surface | Authority | Indexer / RPC |
|--------|-----------|---------------|
| **Referrer leaderboard** | **Σ `referrer_cred`** per referrer from indexed **`ReferralCredApplied`** (`idx_arena_referral_cred`), plus **onchain code registrations** from **`ReferralCodeRegistered`** so guides appear before the first qualifying buy ([GitLab #204](https://gitlab.com/PlasticDigits/yieldomega/-/issues/204), [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)) | `GET /v1/referrals/referrer-leaderboard?limit=&offset=` (schema **≥ 2.3.0** for CRED fields; global summary **≥ 1.25.0** — [GitLab #225](https://gitlab.com/PlasticDigits/yieldomega/-/issues/225)) — distinct **`referrer`** keys = **`UNION(owner_address from idx_referral_code_registered, referrer from idx_arena_referral_cred)`**; **`codes_registered_count`** counts registry rows per owner; **`referred_buy_count`** / CRED totals from **`idx_arena_referral_cred`**; response includes **`total_codes_registered`**, **`total_referred_buys`**, **`total_referrer_cred_wad`**, and **`total`**; row order **`Σ CRED DESC, referrer ASC`** |
| **Wallet CRED summary** | Same log fields, filtered by wallet | `GET /v1/referrals/wallet-cred-summary?wallet=0x…` — **`referrer_cred_wad`** = Σ `referrer_cred` where `referrer = wallet`; **`buyer_cred_wad`** = Σ `buyer_cred` where `buyer = wallet`. Legacy alias **`/wallet-charm-summary`** returns the same CRED JSON (schema **≥ 2.3.0**). |
| **Applied rows** | Per-buy CRED split | `GET /v1/referrals/applied?limit=&offset=` — **`referrer_cred`**, **`buyer_cred`** from **`idx_arena_referral_cred`** |

Indexer implementation keeps **`buyer` / `referrer`** as **lowercase** hex at insert; HTTP handlers bind lowercase addresses and use **bare equality** in SQL so btree indexes apply ([GitLab #165](https://gitlab.com/PlasticDigits/yieldomega/-/issues/165)).

**Wagmi** currently exposes **one active address**; the “Connected wallet” panel documents that multi-account wallets still switch one address at a time.

## Automated checks (frontend)

Playwright maps the **YO Referrals visual verification** checklist ([GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)): shell + `?ref=` in [`frontend/e2e/referrals-surface.spec.ts`](../frontend/e2e/referrals-surface.spec.ts); register + share links + clipboard with **Anvil + DeployDev** in [`frontend/e2e/anvil-referrals.spec.ts`](../frontend/e2e/anvil-referrals.spec.ts) (`bash scripts/e2e-anvil.sh`). **Copy confirmation** (visible banner + error path when clipboard is unavailable) is specified in [GitLab #86](https://gitlab.com/PlasticDigits/yieldomega/-/issues/86). **Leaderboard + earnings** ([GitLab #94](https://gitlab.com/PlasticDigits/yieldomega/-/issues/94), CRED fields [#253](https://gitlab.com/PlasticDigits/yieldomega/-/issues/253)): indexer routes **`/v1/referrals/referrer-leaderboard`** and **`/v1/referrals/wallet-cred-summary`** — see [§ Dashboard](#referrals-dashboard-issue-94) above. Manual QA: [`docs/testing/manual-qa-checklists.md`](../testing/manual-qa-checklists.md#manual-qa-issue-64). Third-party agents: [`skills/play-time-arena-doub/SKILL.md`](../../skills/play-time-arena-doub/SKILL.md) · [`docs/testing/manual-qa-checklists.md#manual-qa-issue-253`](../testing/manual-qa-checklists.md#manual-qa-issue-253).

---

**Agent phase:** product / implementation (referrals)
