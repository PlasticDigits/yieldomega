---
name: play-timecurve-doubloon
description: Play the TimeCurve sale primitive and understand Doubloon (DOUB) fee routing. Use when helping a human buy, track timers, charms, prizes, or fee sinks—not when editing Solidity.
---

# Play TimeCurve and DOUB routing

## Scope

**Audience:** **Players** and **agents assisting players** with reading rules, wallets, and onchain calls — **not** contributors shipping this repository unless the user explicitly opens a **Phase 18** / merge-request workflow.

You are helping a **participant** use **TimeCurve** (token launch / sale primitive) and understand how **DOUB** and other sinks receive fees. You are **not** implementing contracts; read [`docs/product/primitives.md`](../../docs/product/primitives.md) and [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).

**Hard rule:** Do **not** propose edits to `frontend/`, `contracts/`, `indexer/`, or CI here. **Contributors** use [Phase 18](../../docs/agent-phases.md#phase-18) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate.

### Optional local automation

For **TypeScript / Python** scripts against **deployed** contracts (env hygiene, CHARM bounds, cooldowns, timing near sale end), see [`script-with-timecurve-local/SKILL.md`](../script-with-timecurve-local/SKILL.md).

## Core ideas

- **CHARM min/max band** (exponential envelope, canonical **~20%/day** unless deployment differs) rises over time, separately from **per-CHARM price** (default linear-in-time DOUB module); each buy has **min/max** CHARM bounds; **timer** extends on buys up to a **cap**; **`initialTimerSec`** may be shorter than the cap so early activity can still grow remaining time (see deployed parameters).
- **Per-wallet buy cooldown:** onchain **`buyCooldownSec`** (often **5 minutes** on production deploys; **local `DeployDev`** may use **1** s when **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** — [issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88), [`../docs/testing/manual-qa-checklists.md#manual-qa-issue-88`](../docs/testing/manual-qa-checklists.md#manual-qa-issue-88)) enforces **`nextBuyAllowedAt`** after each successful buy; the UI shows a **secondary countdown** (aligned with the hero timer’s wall-vs-chain skew) and **disables** the buy action until the wallet may buy again. Bots should read **`nextBuyAllowedAt(account)`** and wait for **`block.timestamp`** before sending another buy.
- **Timer defaults (documented in [`docs/product/primitives.md`](../../docs/product/primitives.md); verify deployment):** per-buy extension **`timerExtensionSec`** canonical **120s**; **remaining-time cap** **`timerCapSec`** canonical **96 hours**; **pre-first-buy countdown** **`initialTimerSec`** canonical **24 hours**; **hard reset** when remaining before buy is **strictly below 13 minutes** → deadline moves toward **15 minutes** remaining (still subject to cap). **Scheduled `saleStart`:** before the sale is live on chain, UIs count down to **`saleStart`** (not **`deadline`**) with **“TimeCurve Opens In”** copy on Simple + Arena — [GitLab #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115), [`docs/frontend/timecurve-views.md` §115](../../docs/frontend/timecurve-views.md#pre-open-countdown-unified-issue-115). See also [`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md) for WarBow-specific timer/BP detail.
- **CHARM weight** (including referral bonuses) sets **pro-rata DOUB** after the sale via `redeemCharms` (**denominator `totalCharmWeight`**). **Podium** payouts are **reserve-asset** from **`PodiumPool`** after `endSale` via **`distributePrizes`**, separate from DOUB redemption.
- **ETH / USDm → CL8Y (Kumbaya) on the Simple UI:** Optional pay modes run an **`exactOutput`** swap into CL8Y before `TimeCurve.buy`. The primary **Buy** control shows **Refreshing quote…** and stays **disabled** while the quoter read is in flight for the current slider amount (including background refetches), so participants do not click through a stale preview — [integrations/kumbaya.md](../../docs/integrations/kumbaya.md), [timecurve-views — Buy quote refresh](../../docs/frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56) ([issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56)).
- **Go-live gates (issue #55):** Onchain `onlyOwner` flags: **`buyFeeRoutingEnabled`** blocks **sale `buy` → `FeeRouter` and WarBow CL8Y burns** (steal / revenge / guard) until enabled; **`charmRedemptionEnabled`** / **`reservePodiumPayoutsEnabled`** for DOUB `redeemCharms` and **CL8Y reserve** `distributePrizes`; presale **`claimsEnabled`**. Read flags on the deployment — [final signoff runbook](../../docs/operations/final-signoff-and-value-movement.md). **Dev/local scripts** may turn post-end flags on for E2E; mainnet order is a human runbook concern.
- **Redemption shape (docs):** **DOUB per CHARM** typically **falls** as the sale runs (more `charmWeight` sharing a fixed sale pool), while **implied CL8Y per DOUB** from **`totalRaised / totalTokensForSale`** **rises** with each buy. **Excluding referral** CHARM, the **CL8Y value of DOUB per CHARM** is documented as **non-decreasing** — [primitives — redemption economics](../../docs/product/primitives.md#timecurve-redemption-cl8y-density-no-referral).
- **Launch-anchor invariant (1.2× rule):** `DoubLPIncentives` seeds **DOUB/CL8Y locked liquidity** at **1.2× the per-CHARM clearing price**, so a participant's CHARM is projected to be worth **`charmWeight × pricePerCharm × 1.2 / 1e18`** CL8Y at launch — independent of the DOUB count it redeems for. **Worked example:** if the final buyer pays `2 CL8Y` for `1 CHARM` and `1 CHARM` redeems for `100 DOUB`, those `100 DOUB` are worth **`2 × 1.2 = 2.4 CL8Y`** at launch. The number is **non-decreasing** during the sale because the per-CHARM price (e.g. `LinearCharmPrice`) is non-decreasing in elapsed time, so when surfacing this to participants prefer **CL8Y-at-launch** over **projected DOUB count** (the latter dilutes as `totalCharmWeight` grows). Helpers: [`launchLiquidityAnchorWad`](../../frontend/src/lib/timeCurvePodiumMath.ts), [`participantLaunchValueCl8yWei`](../../frontend/src/lib/timeCurvePodiumMath.ts); test: `frontend/src/lib/timeCurvePodiumMath.test.ts` (`launch-anchor invariant: launch price = final per-CHARM price × 1.2`); policy: [`launchplan-timecurve.md`](../../launchplan-timecurve.md), [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md), [`contracts/src/sinks/DoubLPIncentives.sol`](../../contracts/src/sinks/DoubLPIncentives.sol), [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md) (Launch-anchor 1.2× rule).
- **Fees:** full **gross** reserve per buy routes through **`FeeRouter`** (five sink slots: **30%** DOUB/CL8Y locked LP · **40%** CL8Y burned · **20%** podium pool · **0%** team/reserved · **10%** Rabbit Treasury at documented launch default) per [fee routing](../../docs/onchain/fee-routing-and-governance.md)—**verify** live `FeeRouter` on the target chain.

### TimeCurve reserve podium (onchain v1 — **four** categories)

Authoritative rules: [`docs/product/primitives.md`](../../docs/product/primitives.md) (podium + timer + defended streak + WarBow). **Do not** describe legacy ideas (most-buys / biggest-buy / cumulative-CHARM podiums, or opening/closing-window categories); they are **not** in v1.

**How this relates to “podiums” and WarBow:** The **fee-routed prize pool** (`PodiumPool`) funds **four** prize **categories**: **last buy**, **WarBow** (top-3 Battle Points — `warbowLadderPodium` / `podium(CAT_WARBOW)`), **defended streak**, **time booster**. Each category pays **1st / 2nd / 3rd** in **reserve** (not DOUB). For WarBow **PvP** rules (steal, guard, etc.), use **[`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md)** and onchain `battlePoints`.

Plain language for participants:

- **Last buy:** compete to be the last person to buy before the sale ends.
- **WarBow:** top Battle Points wallets when **`distributePrizes`** runs (PvP actions move BP during the sale).
- **Time booster:** most **actual** seconds added to the sale end across your buys (after cap clipping), tracked onchain.
- **Defended streak:** how many times the **same** wallet extends the timer while remaining time **before** the buy is **strictly under 15 minutes**; another buyer under that window **breaks** the active streak (**`bestDefendedStreak`** is what the podium uses).

**Allocations (documented defaults; verify deployment):**

- **Into `PodiumPool` from each buy:** **20%** of the **gross** routed fee (launch default **five** `FeeRouter` sinks — see [fee routing](../../docs/onchain/fee-routing-and-governance.md)).
- **Across the four categories** (shares of that podium pool): **40%** last buy · **25%** WarBow · **20%** defended streak · **15%** time booster (i.e. **8%** · **5%** · **4%** · **3%** of gross raise).
- **Within each category** (1st : 2nd : 3rd): weights **4∶2∶1** (documented in primitives and fee routing).

Reserve podium split from **`PodiumPool`** after the sale follows **`distributePrizes`** on the deployment — verify onchain.

When helping someone interpret standings, prefer **contract reads** (`podium(category)`, per-wallet mappings) and **`Buy` events** over indexer summaries unless the user only needs approximate history. The Simple frontend route now includes a compact **Live reserve podiums** card above Recent buys ([issue #113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113)); treat it as a convenience view of the same onchain `podium(category)` reads, not as a separate source of truth.

## Success function (non-financial)

**Success** means the user understands **sale state**, **timing constraints**, **fee routing** as **documented and verified onchain**, and **risks**—with **honest uncertainty** where RPC, indexers, or docs disagree—so they can decide **whether** to act. Technical accuracy (correct addresses, parameters, reads) **supports** that outcome.

## Return

When answering, make outputs explicit:

- **Sale state** — `ended`, `deadline`, `saleStart`, **`currentMinBuyAmount`**, and any **pause** flags from **chain reads** (not memory).
- **Timer / charm context** — Remaining time, caps, charm weight mechanics as **published** in primitives + **deployment**; cite **which** contract fields you used.
- **Fee routing snapshot** — Sinks and weights **per verified** `FeeRouter` / deployment for this chain, cross-checked with [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).
- **Risks (disclosure)** — Deadline pressure, MEV, oracle/indexer lag, referral rules in [`docs/product/referrals.md`](../../docs/product/referrals.md)—as **information**, not pressure.
- **Next actions permitted under deployed contracts and published rules** — e.g. buy within min/max if sale open; redeem charms after sale—**informational options**, not “you should.”
- **Uncertainty** — indexer vs chain, **versioned** docs vs live deployment, ambiguous **network** (wrong chain).
- **Confidence** (high / medium / low) with **evidence pointers** (contract fields, tx, events, doc links).

## Canonical evidence (priority order)

Resolve truth in this order; **indexers must not override** onchain state for **balances, winners, or sale outcome**.

1. **Deployed contracts** — `TimeCurve` / `FeeRouter` (and related) **addresses** and **reads** for the target chain.
2. **Relevant events** — e.g. **`SaleStarted(startTimestamp=epoch, …)`** (owner **`startSaleAt(epoch)`** at sale open — [GitLab #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114), [`docs/testing/invariants-and-business-logic.md` §114](../../docs/testing/invariants-and-business-logic.md#timecurve-startsaleat-issue-114)), `Buy`, `SaleEnded`, `CharmsRedeemed`, `PrizesDistributed`, `ReferralApplied`, `PodiumPaid` as emitted per [`docs/product/primitives.md`](../../docs/product/primitives.md) and deployment.
3. **Product docs** — [`docs/product/primitives.md`](../../docs/product/primitives.md), [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).
4. **Indexers / frontend** — **discovery only**; **flag** if they disagree with RPC.

## What you should do

1. Read **primitives** and **fee routing** docs above; quote **contract addresses** and **parameters** from RPC for the target chain, not from memory.
2. Explain **risks**: **deadline pressure** and last-minute activity around the sale timer (auction-like dynamics), MEV, oracle/indexer lag, referral rules in [`docs/product/referrals.md`](../../docs/product/referrals.md)—as **disclosure**, not encouragement to chase timers.
3. Prefer **`currentMinBuyAmount`**, **`deadline`**, **`saleStart`**, **`ended`** from chain reads when advising timing.
4. Connect **DOUB** to the ecosystem loop: liquidity and incentives as **productive sinks**, not a separate governance token for the whole ecosystem by default ([`docs/product/vision.md`](../../docs/product/vision.md)).

## What you must not do

- Do not treat the **indexer** or **frontend** as authoritative for balances or winners.
- Do not promise returns or “win” strategies; encourage **testnet** practice.
- Do not equate **actions permitted under deployed contracts and published rules** with **lawful** in a **legal** sense—**jurisdiction and ToS** are separate (see [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md) Safety).

## Related play skills

- [`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md) — WarBow Ladder PvP (BP, steal/guard/revenge/flag).
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)
