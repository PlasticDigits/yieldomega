# TimeCurve frontend — three-view split (Simple · Arena · Protocol)

> **Status:** v1 (issue #40). Authoritative behaviors live onchain in
> [`contracts/src/TimeCurve.sol`](../../contracts/src/TimeCurve.sol); this doc
> describes only how the frontend exposes those behaviors via three routes
> sharing one sub-navigation.

## TL;DR

`/timecurve` (the public landing page) is split into three routes that share a
single sub-nav (`<TimeCurveSubnav />`):

| Route                  | Component                | Audience               | Reads from      | Writes from |
|------------------------|--------------------------|------------------------|-----------------|-------------|
| `/timecurve`           | `TimeCurveSimplePage`    | New users / first run  | `useTimeCurveSaleSession` (RPC) + `TimeCurve.podium(category)` (RPC) + `fetchTimecurveBuys` (indexer, latest 3) | `useTimeCurveSaleSession.buy()` |
| `/timecurve/arena`     | `TimeCurvePage` (existing) | Power users / PvP    | Existing `wagmi` reads + indexer (battle feed, podiums, WarBow)             | Existing `TimeCurvePage` write paths (buy, claim, WarBow steal/guard/revenge/flag) |
| `/timecurve/protocol`  | `TimeCurveProtocolPage`  | Operators / auditors   | `useReadContracts` against TimeCurve, `LinearCharmPrice`, `FeeRouter`; optional **`fetchTimecurveWarbowRefreshCandidates`** (indexer) for governance reference | **WarBow** post-end **`finalizeWarbowPodium(first, second, third)`** ([GitLab #172](https://gitlab.com/PlasticDigits/yieldomega/-/issues/172)) with indexer **`refresh-candidates`** as operator tooling ([#160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160) / [#170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170)) |

Every other primitive (timer reset rule, four reserve podiums, fee routing,
WarBow rules, redemption maths) is unchanged: the contract is the source of
truth, the frontend just changes how the surface is composed.

## Why three views

Issue #40 (cl8y-ecosystem-qa) flagged that the old `/timecurve` opened
straight into the dense PvP / podium / battle feed surface, which made it
hard for a first-time visitor to answer the only two questions they actually
have at launch:

1. **How much time is left?**
2. **How do I spend CL8Y to get CHARM weight?**

The split keeps the existing dense view (now `Arena`) for power users while
moving the first-run path to a calmer focal column on `/timecurve`.

```mermaid
flowchart LR
  Launch[LaunchCountdownPage] --> Simple
  Simple["/timecurve\n(TimeCurveSimplePage)"]
  Arena["/timecurve/arena\n(TimeCurvePage)"]
  Proto["/timecurve/protocol\n(TimeCurveProtocolPage)"]
  Subnav[TimeCurveSubnav]
  Simple --- Subnav
  Arena --- Subnav
  Proto --- Subnav
```

## Single source of truth invariants

These invariants are guarded by code and tests; **do not** add a parallel
implementation in `TimeCurveSimplePage` or `TimeCurveProtocolPage`.

1. **Game logic stays onchain.** Min/max buy bounds, charm price, sale phase,
   redemption ratio, WarBow rules, and prize splits are read from the
   contracts (`TimeCurve`, `LinearCharmPrice`, `FeeRouter`). The frontend
   never recomputes a contract rule from cached indexer rows.
2. **One buy path.** `useTimeCurveSaleSession.buy(charmWad)` and
   `TimeCurvePage`'s buy handler ultimately call **the same** `TimeCurve.buy`
   write through `useWriteContract`. Approval handling, allowance checks, and
   referral plumbing live in one place per page surface but route to the
   same contract entrypoint with the same argument shape.
3. **`chainId` matches build target before wallet writes.** When connected and **`useChainId()`** ≠ [`configuredTargetChainId()`](../../frontend/src/lib/chain.ts) (`VITE_CHAIN_ID` / `VITE_RPC_URL`; default **Anvil** **31337**), Simple + Arena gated panels show **`ChainMismatchWriteBarrier`** and submit paths **`chainMismatchWriteMessage`** gates — [**Wrong network write gating (#95)**](#wrong-network-write-gating-issue-95); [wallet-connection.md § #95](wallet-connection.md#wrong-network-write-gating-issue-95). **Mid-flow drift:** multi-step **`submitBuy`** / Arena **`handleBuy`** also latch **`getAccount(wagmi)`** after sizing and abort when account or **`chainId`** changes between awaits — [**GitLab #144**](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144); [`wallet-connection.md` § #144](wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144); [`invariants` § #144](../testing/invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144).
4. **One phase machine + one clock for phase and hero timer.** Sale phase
   derivation (`saleStartPending`, `saleActive`, `saleExpiredAwaitingEnd`,
   `saleEnded`) lives in
   [`timeCurveSimplePhase.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts)
   as a pure function. `TimeCurveSimplePage` and `useTimeCurveSaleSession` route
   through `derivePhase()` for badge, narrative, and buy gating. The Arena view
   (`TimeCurvePage`) maps the same phase to its legacy booleans with
   `phaseFlags()`. The **“chain now”** fed into `derivePhase()` (and the
   simple-view pre-start window) is **`ledgerSecIntForPhase()`**: it **prefers**
   `useTimecurveHeroTimer`’s `chainNowSec` (indexer `/v1/timecurve/chain-timer`,
   wall–chain skew) when that snapshot exists, and **falls back** to
   `latestBlock` / wall time otherwise, so the phase strip cannot call the sale
   “pre-start” while the hero countdown is clearly in the live round — see
   [Chain time and sale phase (issue #48)](#chain-time-and-sale-phase-issue-48)
   and [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48).
5. **No new tokens, no new fee paths.** The Protocol view only displays
   what the contracts already expose. It never decodes JSON sink blobs or
   re-derives fee splits — it shows raw `bps` / addresses straight from
   `FeeRouter` and the routed top-level sinks. Human formatting uses
   `formatBpsAsPercent` / `formatCompactFromRaw` per
   [`design.md`](./design.md).

<a id="wrong-network-write-gating-issue-95"></a>

## Wrong network write gating (issue #95)

**Implementation:** **`ChainMismatchWriteBarrier`** overlays (Option C); primary CTAs additionally respect **`useWalletTargetChainMismatch()`** (Option A); **`chainMismatchWriteMessage`** rejects **`writeContract`** paths before assembling calldata. **`SwitchToTargetChainButton`** issues **`wallet_switchEthereumChain`** for [`configuredChain()`](../../frontend/src/lib/chain.ts).

**Targets:** `/timecurve` buy panel · `/timecurve/arena` buy hub, standings/post-end **`runVoid`** surface, **`WarbowSection`** · `/referrals` register · `/vesting` claim (not **`/protocol`**, **`/kumbaya`**, **`/sir`** navigational stubs).

Further reading: [`wallet-connection.md` — Wrong-network (#95)](wallet-connection.md#wrong-network-write-gating-issue-95), [`wallet-connection.md` — Session continuity (#144)](wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144), [`invariants` § #95](../testing/invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95), [`invariants` § #144](../testing/invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144), [play checklist](../testing/manual-qa-checklists.md#manual-qa-issue-95).

<a id="arena-buy-charm-wrong-chain-visual-gitlab-194"></a>

## Arena `Buy CHARM` wrong-chain visual (GitLab #194)

**Problem:** The Arena **arcade** primary CTA stayed **functionally** disabled on wrong **`chainId`**, but could still **look** “live” (gold gradient + motion) relative to **`btn-secondary`** settlement buttons in the standings panel.

**Fix:** When **`useWalletTargetChainMismatch()`** is true, **`TimeCurveArenaView`** adds **`timecurve-simple__cta--wrong-network`**, **`title={chainMismatchWriteMessage(walletChainId)}`**, **`data-testid="timecurve-arena-buy-charm-cta"`**, skips **`primaryButtonMotion`**, and uses scoped CSS for **stronger dimming**; the buy hub **`ChainMismatchWriteBarrier`** overlay gets a **higher `z-index`** so it stacks above z-indexed panel chrome.

**Map:** [`INV-FRONTEND-194-ARENA-BUY-CHAIN`](../testing/invariants-and-business-logic.md#arena-buy-charm-wrong-chain-visual-gitlab-194) · [manual QA (#194)](../testing/manual-qa-checklists.md#manual-qa-issue-194-arena-buy-chain-visual) · [`TimeCurveArenaView.tsx`](../../frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx) · [`index.css`](../../frontend/src/index.css).

## Chain time and sale phase (issue #48)

**What must not happen:** the **hero deadline countdown** (and urgency styling
driven from it) shows a **live** round, while the **state badge** or **Buy CHARM
CTA** still read **pre-start** or **“Loading sale state…”** because two code
paths used two different ideas of “chain now.”

**Fix (merged with [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48)):** [`ledgerSecIntForPhase()`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts) prefers
`useTimecurveHeroTimer`’s `chainNowSec` when the indexer has delivered
`/v1/timecurve/chain-timer`; `useTimeCurveSaleSession` and `TimeCurvePage` pass
the result into `derivePhase` and the simple-view pre-start window. On-chain
**authority** is unchanged: reads still use `TimeCurve.saleStart`, `deadline`,
`ended`, etc. This layer only picks a consistent **“now”** for comparing those
**timestamps** when the browser’s `latestBlock` can **lag** the same chain
the indexer (and bots) are using — common on local Anvil and multi-rail
setups.

<a id="inclusive-round-deadline-issue-136"></a>

**Inclusive round `deadline()` + WarBow cutoff ([issue #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136)):** **`TimeCurve`** lets **`buy` / `buyFor`**, **`claimWarBowFlag`**, and WarBow **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** succeed through **`block.timestamp == deadline()`**; they revert **`timer expired`** only when **`block.timestamp > deadline()`**. **`endSale`** succeeds only when **`block.timestamp > deadline()`**. **`derivePhase`** mirrors that: **`saleExpiredAwaitingEnd`** when **`ledgerSecInt > deadlineSec`**, not **`>=`**, so the hero/badge do not show “expired” until the block after the inclusive last countdown second. **`TimeCurveBuyRouter.buyViaKumbaya`** uses **`block.timestamp > deadline()`** for **`BadSalePhase`** past-round semantics.

**Participant play skills:** [`play-timecurve-doubloon/SKILL.md`](../../skills/play-timecurve-doubloon/SKILL.md) · [`play-timecurve-warbow/SKILL.md`](../../skills/play-timecurve-warbow/SKILL.md). Contributor map: [**invariants — #136**](../testing/invariants-and-business-logic.md#timecurve-round-deadline-inclusive-warbow-gitlab-136).

<a id="scheduled-sale-start-onsalestartsaleat-issue-114"></a>

**Scheduled on-chain starts ([issue #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)):** Operators use **`startSaleAt(epoch)`** so **`saleStart`** can be announced **ahead of wall/mempool drift**, with **`epoch >= block.timestamp`** at call time. Until **`saleStart` arrives on chain**, **`buy`** and WarBow CL8Y paths revert **`"TimeCurve: sale not live"`**; **`deadline`** is **`saleStart + initialTimerSec`** so the opening timer band is tied to **`epoch`**. Read-model CHARM/min-max/price snapshots follow **elapsed-from-live** (**0** until **`now ≥ saleStart`**). Frontend **`saleStartPending`** (see `derivePhase`) should mirror **`saleStart` vs the same indexer-anchored “now”** as [**issue #48**](#chain-time-and-sale-phase-issue-48); map: [**invariants — `startSaleAt` / #114**](../testing/invariants-and-business-logic.md#timecurve-startsaleat-issue-114).

<a id="pre-open-countdown-unified-issue-115"></a>

**Pre-open countdown — Simple + Arena unified ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)):** After **`startSaleAt`**, **`deadline = saleStart + initialTimerSec`**, so **`deadline − chainNow`** during **`saleStartPending`** includes the **live round window** and misleads as an “opens in” clock. **Simple** and **Arena** must both drive prominent hero digits from **`max(0, saleStartSec − floor(chainNow))`** in this phase, using the same **`chainNow`** skew as **`useTimecurveHeroTimer`** ([**#48**](#chain-time-and-sale-phase-issue-48)). Prefer **`sale_start_sec`** on **`GET /v1/timecurve/chain-timer`** (same head block as **`deadline_sec`**, indexer schema **≥ 1.11.0**) so **`saleStart`** and **`deadline`** targets stay co-snapshotted; fallback: RPC **`saleStart()`** when the field is absent. **Copy:** exact phrase **“TimeCurve Opens In”** on pre-start hero surfaces (page title / rail label / assistive labels). **Live** phases keep **`deadline − chainNow`**; **timer-cap / extension preview** math must use the **live** countdown only, not pre-open digits — see **`timecurveHeroDisplaySecondsRemaining`** in [`timeCurveSimplePhase.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts). Map: [**invariants — #115**](../testing/invariants-and-business-logic.md#timecurve-pre-open-hero-countdown-issue-115).

**Spec ↔ test:** [invariants — TimeCurve pre-open hero countdown (#115)](../testing/invariants-and-business-logic.md#timecurve-pre-open-hero-countdown-issue-115) ·
[`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts)
(`timecurveHeroDisplaySecondsRemaining`).

**Spec ↔ test:** [invariants and business — TimeCurve frontend: sale phase and hero timer](../testing/invariants-and-business-logic.md#timecurve-frontend-sale-phase-and-hero-timer) ·
[`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts)
(`ledgerSecIntForPhase`, `derivePhase`).

<a id="indexer-offline-ux-issue-96"></a>

## Indexer offline signal, backoff, and Simple empty states (issue #96)

When **`VITE_INDEXER_URL`** points at an indexer that becomes unreachable mid-session, the UI must **not** look identical to “healthy indexer, zero rows” ([issue #96](https://gitlab.com/PlasticDigits/yieldomega/-/issues/96)).

**Reachability + backoff**

- **`reportIndexerFetchAttempt(ok)`** (in [`indexerConnectivity.ts`](../../frontend/src/lib/indexerConnectivity.ts)) aggregates outcomes from **`IndexerConnectivityProvider`** (`fetchIndexerStatus`), **`useTimecurveHeroTimer`** (`/v1/timecurve/chain-timer`), **`fetchTimecurveBuys`** on Simple and Arena, and any future poll that opts in. Failures increment the streak **at most once per wall-clock second** so parallel pollers do not triple-count the same outage.
- After **three** such seconds with failures, **`isOffline`** becomes true: **`IndexerStatusBar`** shows **Indexer offline · retrying** (error-styled pill). Poll intervals back off **5s → 15s → 30s** (per fast baseline: 1s hero refresh, 3s status, 5s Simple buys) until the next **`true`** report resets the streak.
- **`getJson`** / **`fetchTimecurveChainTimer`** swallow network errors and return **`null`** so pollers get a clean **`false`** outcome without unhandled rejections.
- **Malformed JSON on HTTP 200:** both helpers **`await res.json()`** inside **`try`** so parse failures join the same **`null`** path as unreachable hosts — **`reportIndexerFetchAttempt(false)`** runs for buys / hero timer polls ([issue #111](https://gitlab.com/PlasticDigits/yieldomega/-/issues/111)).

**`/timecurve` (Simple)** hides the global footer ([`RootLayout`](../../frontend/src/layout/RootLayout.tsx)); the same **`IndexerStatusBar`** is rendered above **Recent buys**. **Recent buys** empty copy: **Waiting for the first buy of this round** only when the last buys poll **succeeded** with zero rows **and** connectivity is not offline; otherwise prefer **Cannot reach indexer · cached data may be stale** (and a stale hint above the list when cached rows exist).

**Spec ↔ test:** [invariants — indexer offline UX](../testing/invariants-and-business-logic.md#indexer-offline-ux-and-backoff-gitlab-96) · [invariants — indexer JSON parse (#111)](../testing/invariants-and-business-logic.md#indexer-http-json-parse-issue-111) · [`indexerConnectivity.test.ts`](../../frontend/src/lib/indexerConnectivity.test.ts) · [`indexerApi.test.ts`](../../frontend/src/lib/indexerApi.test.ts) · play checklist [`../testing/manual-qa-checklists.md#manual-qa-issue-96`](../testing/manual-qa-checklists.md#manual-qa-issue-96).

<a id="keyboard-focus-visible-issue-97"></a>

## Keyboard focus visible on TimeCurve (issue #97)

**`/timecurve`** was the reported repro for **invisible Tab focus** ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)): focus moved (`document.activeElement`) but **RainbowKit**’s **`[data-rk]`** reset applies **`outline: none`** with specificity that overrides unscoped **`button:focus-visible`**. **Fix:** global **`index.css`** mirrors the same **`:focus-visible`** selector list under **`[data-rk]`** and documents **`--yo-focus-ring`**.

**Spec ↔ test:** [invariants — keyboard focus visible](../testing/invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97) · [wallet-connection.md](./wallet-connection.md) · [design — Accessibility](./design.md#accessibility-and-ux) · play checklist [`../testing/manual-qa-checklists.md#manual-qa-issue-97`](../testing/manual-qa-checklists.md#manual-qa-issue-97).

## WarBow pending flag UI (issues #51, #63)

**Onchain + logs:** **`Buy.flagPlanted`** is **`true` iff** that transaction **opted in** to planting the WarBow pending flag (`plantWarBowFlag` on **`buy`** / **`buyFor`** / **`buyViaKumbaya`** — [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)). Indexer **`flag_planted`** mirrors the log. **Holder + silence** remain authoritative from **`warbowPendingFlagOwner`** / **`warbowPendingFlagPlantAt`** reads, not from “any recent buy row” ([issue #51](https://gitlab.com/PlasticDigits/yieldomega/-/issues/51)).

**Rules for the Arena / Simple UI:**

1. **Pending holder + silence** — Shown from **`warbowPendingFlagOwner`** / **`warbowPendingFlagPlantAt`** (wagmi), with seconds-until-silence-ends derived from the same **ledger “now”** as the hero timer / phase logic, **not** from the buy indexer.
2. **Per-buy highlights / feed tags** — **`flag_planted`** from indexer rows is now **meaningful per tx** (opt-in plant); still **do not** treat it as a substitute for live **`warbowPendingFlag*`** when showing **current** holder.
3. **Buy panels** — Expose an explicit **Plant WarBow flag** checkbox with **BP-loss risk** copy before confirmation; default **off** maps to **`buy(charmWad)`** only.
4. **Won vs destroyed** — **`WarBowFlagClaimed`** and **`WarBowFlagPenalized`** appear in the **rivalry feed** (`buildWarbowFeedNarrative`: **Flag won**, **Flag destroyed**).

**Spec ↔ test:** [invariants — WarBow flag plant opt-in](../testing/invariants-and-business-logic.md#timecurve-warbow-flag-plant-opt-in-issue-63) · [primitives — plant / claim flag](../product/primitives.md) · [`timeCurveUx.ts`](../../frontend/src/lib/timeCurveUx.ts) · [issue #51](https://gitlab.com/PlasticDigits/yieldomega/-/issues/51) · [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63).

<a id="arena-warbow-hero-actions-issue-101"></a>

## Arena WarBow hero actions (issue #101)

`/timecurve/arena` keeps the detailed [`WarbowSection`](../../frontend/src/pages/timecurve/TimeCurveSections.tsx)
below the fold, but the `PageHeroArcadeBanner` now exposes the live WarBow
decision surface directly through
[`WarbowHeroActions`](../../frontend/src/pages/timeCurveArena/WarbowHeroActions.tsx):

1. **Wallet context first:** the hero action area shows connect / connected
   state plus the viewer's live Battle Points before any PvP CTA.
2. **Steal without typing:** suggested steal targets come from the contract
   WarBow podium and indexed leaderboard, deduped by address and filtered
   client-side for the **2×–10×** BP band when the viewer BP read is available. Selecting
   a row writes the same `stealVictimInput` used by the detailed section, so the
   existing live contract reads (`battlePoints`, `stealsReceivedOnDay`) and
   `describeStealPreflight` remain the final eligibility preview.
3. **Guard + revenge are obvious:** guard is a visible hero CTA with burn and
   active-until copy; **revenge lists every open stealer** when the indexer is
   configured (`GET /v1/timecurve/warbow/pending-revenge`, reconciled from
   **`WarBowRevengeWindowOpened`** vs **`WarBowRevenge`** — [GitLab #135](https://gitlab.com/PlasticDigits/yieldomega/-/issues/135)). Onchain reads use
   **`warbowPendingRevengeExpiryExclusive(victim, stealer)`** and
   **`warbowPendingRevengeStealSeq(victim, stealer)`** per pair; each **Take
   revenge** CTA passes the **stealer** address to **`warbowRevenge(stealer)`**.
4. **Write barriers stay shared:** the hero WarBow cluster is inside the same
   `ChainMismatchWriteBarrier` pattern as the lower WarBow section, and the
   submit functions still preflight `chainMismatchWriteMessage` plus
   `buyFeeRoutingEnabled` before approval / writes.

Indexer rows are a discovery aid only. If candidate rows are stale, the selected
target still has to pass live onchain reads and wallet simulation. Empty
candidate state is explicit and points users to the detailed section's manual
address path.

**Spec ↔ test:** [invariants — Arena WarBow hero actions](../testing/invariants-and-business-logic.md#timecurve-arena-warbow-hero-actions-issue-101) · [invariants — per-stealer revenge (#135)](../testing/invariants-and-business-logic.md#warbow-per-stealer-revenge-windows-gitlab-135) · [product WarBow rules](../product/primitives.md#warbow-ladder-battle-points--pvp-and-reserve-slice) · [play skill](../../skills/play-timecurve-warbow/SKILL.md) · [issue #101](https://gitlab.com/PlasticDigits/yieldomega/-/issues/101).

<a id="arena-warbow-steal-victim-field-gitlab-195"></a>

## Arena WarBow — steal victim field validation (GitLab #195)

On **`/timecurve/arena`**, the detailed **`WarbowSection`** steal victim `<input>` uses shared helpers in [`warbowStealVictimInput.ts`](../../frontend/src/lib/warbowStealVictimInput.ts). **Invalid partial hex** and **Attempt steal** with no resolved victim surface **`StatusMessage variant="error"`** only **under that input** (`data-testid="warbow-steal-victim-form-status"`). They must **not** populate the hero / lower **`pvpErr`** strips for pure field validation, and **`warbowActionHint`** must **not** embed invalid-address validation (so a fresh load does not show steal-field errors above the form).

**Spec ↔ test:** [invariants — #195](../testing/invariants-and-business-logic.md#timecurve-arena-warbow-steal-victim-validation-gitlab-195) · [GitLab #195](https://gitlab.com/PlasticDigits/yieldomega/-/issues/195).

<a id="arena-warbow-indexer-leaderboard-feed-refresh-gitlab-182"></a>

## Arena WarBow indexer leaderboard + rivalry feed refresh (GitLab #182)

**Your WarBow rank**, the **chasing pack** (indexed leaderboard hints), and the **rivalry / battle feed** panels read **`GET /v1/timecurve/warbow/leaderboard`** and **`GET /v1/timecurve/warbow/battle-feed`**. Those responses must refresh when Battle Points change from **your** txs and eventually reflect **other** wallets’ activity without requiring a full page reload ([GitLab #182](https://gitlab.com/PlasticDigits/yieldomega/-/issues/182)).

**Behavior:** **`useTimeCurveArenaModel`** reloads both endpoints **after local writes succeed** (same **`refetchAll`** path as wagmi contract refetches — buys, WarBow actions, post-end **`runVoid`**), **on every BP-moving chain log** via **`useWarbowBpMovingEventWatch`**, **and** on a **~1.5s backoff** poll while Arena stays mounted when **`VITE_INDEXER_URL`** is set. Chasing-pack BP digits overlay live **`battlePoints(address)`** when reads succeed ([live WarBow podium](#live-warbow-podium-simple-arena)).

**Spec ↔ test:** [invariants §182](../testing/invariants-and-business-logic.md#timecurve-arena-warbow-indexer-refresh-gitlab-182) · [`useTimeCurveArenaModel.tsx`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx).

<a id="arena-warbow-chasing-pack-scroll-gitlab-189"></a>

## Arena WarBow Chasing pack — full ladder + scroll (GitLab #189)

**Chasing pack** (**`WarbowSection`**, beside **Top rivals**) lists wallets from the **same** indexed WarBow ladder response as **Your WarBow rank**. The UI must **not** truncate after **six** rows: **seventh+** entries render with **rank** continuity, and the list lives in **`.warbow-chasing-pack-scroll`** so a long ladder scrolls inside a **bounded height** instead of blowing up the **`.split-layout`** row ([GitLab #189](https://gitlab.com/PlasticDigits/yieldomega/-/issues/189)).

**Spec ↔ test:** [invariants §189](../testing/invariants-and-business-logic.md#timecurve-arena-warbow-chasing-pack-gitlab-189) · [`warbowChasingPackLeaderboard.ts`](../../frontend/src/pages/timeCurveArena/warbowChasingPackLeaderboard.ts) · [`WarbowSection` — `TimeCurveSections.tsx`](../../frontend/src/pages/timecurve/TimeCurveSections.tsx) · [manual QA (#189)](../testing/manual-qa-checklists.md#manual-qa-issue-189).

<a id="arena-settlement-panel-timer-expired-gitlab-188"></a>

## Arena settlement panel — timer expired vs `ended` (GitLab #188)

After **`deadline()`** the phase is **`saleExpiredAwaitingEnd`** until someone calls **`endSale()`** (**`ended`** flips **`true`**). **`redeemCharms`** and **`distributePrizes`** still **`require(ended)`** on **`TimeCurve`**.

**Arena UX:** the **Standings and prize chase** / **After sale actions** status panel treats **`saleExpiredAwaitingEnd` OR `saleEnded`** as the **settlement** layout: **End sale** is shown while **`ended` is false**; **Redeem charms** and **Distribute prizes** stay visible but **disabled** (with a **title** tooltip + helper copy) until **`ended`** is **`true`**, so participants always see the path that unlocks “claim” without hunting another route. Hooks: **`data-testid`s** **`timecurve-arena-end-sale`**, **`timecurve-arena-redeem-charms`**, **`timecurve-arena-distribute-prizes`**.

**Spec ↔ test:** [invariants §188](../testing/invariants-and-business-logic.md#timecurve-arena-settlement-panel-timer-expired-gitlab-188) · [`TimeCurveArenaView.tsx`](../../frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx) · [manual QA (#188)](../testing/manual-qa-checklists.md#manual-qa-issue-188) · [play skill](../../skills/play-timecurve-warbow/SKILL.md).

<a id="usd-equivalent-staleness-gitlab-192"></a>

## USD equivalent — staleness + basis (GitLab #192)

**Arena (`/timecurve/arena`, sale live):** the hero **TOTAL USD** line multiplies onchain **`totalRaised`** by a **fixed placeholder** (**`CL8Y_USD_PRICE_PLACEHOLDER = 1`**). A muted second line shows **when the CL8Y total last changed** (serialized `totalRaised` from the ~1s core read bundle) and states that **USD is illustrative**. Hover the block for the full **`title`** ([`ARENA_TOTAL_USD_EQUIV_TITLE`](../../frontend/src/lib/cl8yUsdEquivalentDisplay.ts)).

**Simple (`/timecurve`):** **Live reserve podiums** show **≈ $… USD** beside CL8Y prize hints using the app’s **static** **`fallbackPayTokenWeiForCl8y`** USDM-shaped rate (**0.98×** — not a live stablecoin quote). Each **≈** row exposes the same basis via **`title`**; the section footnote repeats the static-rate disclosure and, when a prize preview is present, **when the preview last changed**.

**Spec ↔ test:** [invariants §192](../testing/invariants-and-business-logic.md#usd-equivalent-staleness-affordance-gitlab-192) · [`cl8yUsdEquivalentDisplay.ts`](../../frontend/src/lib/cl8yUsdEquivalentDisplay.ts) · [`TimeCurveSimplePodiumSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.tsx) · [manual QA (#192)](../testing/manual-qa-checklists.md#manual-qa-issue-192) · [play skill — USD hints](../../skills/play-timecurve-doubloon/SKILL.md).

<a id="stats-charts-empty-states-gitlab-200"></a>

## Stats and charts — explicit empty states (GitLab #200)

**Problem:** A bare **em dash** in a stat tile or chart region reads like a rendering bug when the user is connected but data is still loading, wallet-gated, or legitimately empty.

**Surfaces:** Arena **`WhatMattersSection`** and secondary stats grid, **`StandingsVisuals`** (no indexed buy history), rate-board **DOUB-at-launch** / wallet balance rows, Simple **stake-at-launch** tiles and **live podium** prize preview, **`/referrals`** indexed CHARM totals banner.

**Implementation:** shared **`EmptyDataPlaceholder`** + **`statFromContractRead` / `statFromOptionalString`** ([`EmptyDataPlaceholder.tsx`](../../frontend/src/components/EmptyDataPlaceholder.tsx), [`statDisplayFromContractRead.tsx`](../../frontend/src/lib/statDisplayFromContractRead.tsx)).

**Follow-up (same issue):** Simple **Live reserve podiums** no longer show the **`PageSection`** header pill that alternated **“Indexer-backed snapshot”** and **“Refreshing podiums…”** — it read as internal stack jargon and could flicker when podium reads refetched ([**`INV-FRONTEND-200-NO-INDEXER-PILL`**](../testing/invariants-and-business-logic.md#frontend-stats-charts-empty-states-gitlab-200), [`TimeCurveSimplePodiumSection.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.tsx)).

**Spec ↔ test:** [invariants §200](../testing/invariants-and-business-logic.md#frontend-stats-charts-empty-states-gitlab-200) · [GitLab #200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200) · [`statDisplayFromContractRead.test.tsx`](../../frontend/src/lib/statDisplayFromContractRead.test.tsx) · [`TimeCurveSimplePodiumSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.test.tsx).

<a id="timecurve-responsive-layout-gitlab-201"></a>

## Responsive layout containment — mobile + tablet (GitLab #201)

**Problem:** On phone widths, the Simple buy panel could stay cramped because
desktop-only decorative coin-stack padding was still reserved after the hub
collapsed. On tablet widths, Arena WarBow action cards and the Home product-card
grid could inherit desktop tracks that exceeded iPad Mini / Air width. On mobile
Arena, the fixed Blockie Hills dock could visually sit over the buy hub when the
page was scrolled or deep-linked into the primary action, and long CL8Y totals
could become hard to read.

**Invariant:** **`INV-FRONTEND-201-RESPONSIVE-LAYOUT`** keeps TimeCurve surfaces
inside the viewport and card chrome at phone and tablet breakpoints: the
Simple buy panel hides the coin-stack cutout and collapses the slider layout at
≤520 px; the Home card grid uses two tablet columns before its three-column
desktop layout; Arena WarBow cards wrap headings / revenge rows and reduce
TimeCurve spotlight padding at ≤960 px; mobile TimeCurve routes add top
clearance under the fixed audio dock; and hero / buy-panel numeric values wrap
inside their card rather than forcing horizontal scroll.

**Spec ↔ test:** [invariants §201](../testing/invariants-and-business-logic.md#timecurve-responsive-layout-gitlab-201) · [manual QA #201](../testing/manual-qa-checklists.md#manual-qa-issue-201) · [`timeCurveResponsiveLayoutCss.test.ts`](../../frontend/src/lib/timeCurveResponsiveLayoutCss.test.ts) · [`timecurve.spec.ts`](../../frontend/e2e/timecurve.spec.ts) · [GitLab #201](https://gitlab.com/PlasticDigits/yieldomega/-/issues/201).

<a id="warbow-ladder-podium-snapshot-mismatch-issue-129"></a>

## WarBow ladder snapshot mismatch vs live Battle Points (#129)

`/timecurve/arena` **`WarbowSection` → Top rivals** renders **`warbowLadderPodium()`** (same snapshot as the WarBow **`podium(CAT_WARBOW)`** winners list). During the sale those values can lag **`battlePoints(address)`** reads until the next state-changing WarBow / buy interaction; **GitLab #172** removed permissionless onchain podium repair — post-**`endSale`**, the owner **`finalizeWarbowPodium(first, second, third)`** latches the ladder for **`distributePrizes`** when the pool balance is positive ([GitLab #129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129)).

<a id="live-warbow-podium-simple-arena"></a>

### Live WarBow podium — Simple + Arena (`INV-FRONTEND-WARBOW-PODIUM-LIVE`)

While **`sale_ended`** is **false**, the **Simple** reserve **WarBow** card and **Arena** chasing-pack ladder must stay aligned with **live Battle Points**, not only the most recent **`Buy`** row in the live feed:

1. **Ranking source:** **`GET /v1/timecurve/podiums`** (WarBow row) and **`GET /v1/timecurve/warbow/leaderboard`** — indexer **`WARBOW_BP_OBSERVATIONS_UNION`** (buys + steal + revenge + flag claim/penalty).
2. **Immediate invalidation:** **`useWarbowBpMovingEventWatch`** watches **`Buy`**, **`WarBowSteal`**, **`WarBowRevenge`**, **`WarBowFlagClaimed`**, and **`WarBowFlagPenalized`** — invalidates **`TIMECURVE_PODIUMS_QUERY_KEY`** and refetches Arena WarBow aggregates on **every** BP-moving log (not **`WarBowGuardActivated`** — guard does not mutate BP).
3. **Displayed BP digits:** overlay on-chain **`battlePoints(address)`** reads for the top-3 Simple WarBow winners and for Arena chasing-pack rows when all per-row reads succeed — ranking order stays indexer-driven; numbers match chain truth.
4. **Poll cadence:** Simple podiums **~1s**; Arena WarBow leaderboard/feed **~1.5s** backoff while mounted.

**Spec ↔ test:** [invariants § live WarBow podium](../testing/invariants-and-business-logic.md#live-warbow-podium-simple-arena-gitlab-warbow-podium-live) · [`usePodiumReads.ts`](../../frontend/src/pages/timecurve/usePodiumReads.ts) · [`warbowPodiumLive.ts`](../../frontend/src/pages/timecurve/warbowPodiumLive.ts) · [`warbowPodiumLive.test.ts`](../../frontend/src/pages/timecurve/warbowPodiumLive.test.ts).

1. **Arena (sale live):** there is **no** public “refresh snapshot” write path — compare **`warbowLadderPodium()`** vs live **`battlePoints`** reads when interpreting standings.
2. **Operators / post-end:** use **`/timecurve/protocol` → WarBow podium (governance)** to load **`GET /v1/timecurve/warbow/refresh-candidates`** (indexer, schema ≥ 1.15.1; post-end hint omission + **`sale_ended`** field — [GitLab #170](https://gitlab.com/PlasticDigits/yieldomega/-/issues/170); **unbounded DISTINCT** — [GitLab #172](https://gitlab.com/PlasticDigits/yieldomega/-/issues/172)) as a **reference** while composing **`finalizeWarbowPodium(first, second, third)`** calldata ([GitLab #160](https://gitlab.com/PlasticDigits/yieldomega/-/issues/160)).
3. **`distributePrizes`** with a **non-zero** pool requires **`reservePodiumPayoutsEnabled`** and **`warbowPodiumFinalized`** (`TimeCurve.sol`; **zero** pool still early-returns). **`finalizeWarbowPodium`** is **owner-only** and **post-end** — it is the sole onchain path to set **`warbowPodiumFinalized`** after **#172** (**[GitLab #149](https://gitlab.com/PlasticDigits/yieldomega/-/issues/149)** stack hardening remains for indexer/SQL/Arena polling — [invariants §149](../testing/invariants-and-business-logic.md#gitlab-149-warbow-arena-indexer-hardening)).
4. **Agents / scripts:** see [invariants §129](../testing/invariants-and-business-logic.md#warbow-podium-snapshot-drifts-gitlab-129); Anvil Part2 and [`verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) call **`finalizeWarbowPodium`** before **`distributePrizes`**.

<a id="warbow-refresh-candidates-ui-pagination-guard-gitlab-174"></a>

## WarBow refresh-candidates UI pagination guard (GitLab #174)

**`/timecurve/protocol` → WarBow podium (governance)** loads indexer **`refresh-candidates`** in pages. The client caps total pages (**`50`** × **`500`** rows per request — [`warbowRefreshCandidatesPagination.ts`](../../frontend/src/lib/warbowRefreshCandidatesPagination.ts)). If that ceiling is hit while the API still returns **`next_offset`**, the panel shows a **non-fatal warning** (`StatusMessage` **`warning`**) so operators know the checksum list may omit wallets; a **full** natural page-through (**`next_offset === null`**) shows **no** warning ([GitLab #174](https://gitlab.com/PlasticDigits/yieldomega/-/issues/174), **`INV-FRONTEND-174-WARBOW-REFRESH-GUARD`** in [invariants §174](../testing/invariants-and-business-logic.md#gitlab-174-warbow-refresh-pagination-guard)).

**Spec ↔ test:** [invariants §129](../testing/invariants-and-business-logic.md#warbow-podium-snapshot-drifts-gitlab-129) · [invariants §149](../testing/invariants-and-business-logic.md#gitlab-149-warbow-arena-indexer-hardening) · [invariants §174](../testing/invariants-and-business-logic.md#gitlab-174-warbow-refresh-pagination-guard) · [`timeCurveWarbowSnapshotClaim.test.ts`](../../frontend/src/lib/timeCurveWarbowSnapshotClaim.test.ts) · [`warbowRefreshCandidatesPagination.test.ts`](../../frontend/src/lib/warbowRefreshCandidatesPagination.test.ts) · [play skill](../../skills/play-timecurve-warbow/SKILL.md).

<a id="arena-sniper-shark-cutout-issue-80"></a>

## Arena sniper-shark cutout (issue #80)

The sniper-shark pack is intentionally **not** a new global mascot. Arena uses a
single `sniper-shark-peek-scope.png` decoration on the **Buy CHARM** panel,
replacing the previous sneak-bunny cutout rather than adding another character
to the card. The rationale is narrow: the Arena buy card is where timing,
price pressure, and optional WarBow flag planting already create the "hunter /
sniper" mood. Simple, global chrome, and neutral operator surfaces stay shark
free.

**UI invariants**

1. **Sparse placement:** one shark asset on `/timecurve/arena`; no shark in the
   header, root layout, Simple first-run sale path, or Protocol read-only page.
2. **Decorative accessibility:** the placement uses `CutoutDecoration` with the
   default empty `alt`, so it is `aria-hidden` and does not add screen-reader
   noise.
3. **Motion restraint:** the cutout uses the existing `peek-loop` animation,
   which is suppressed by the global `prefers-reduced-motion` rule.
4. **Asset accounting:** runtime consumers are listed in
   [`frontend/public/art/README.md`](../../frontend/public/art/README.md), and
   the remaining shark variants stay staged until a surface has a specific
   narrative fit.

**Spec ↔ test:** [invariants — Arena sniper-shark cutout](../testing/invariants-and-business-logic.md#timecurve-arena-sniper-shark-cutout-issue-80) · [issue #80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80) · [visual QA skill](../testing/manual-qa-checklists.md#manual-qa-issue-80).

<a id="buy-quote-refresh-kumbaya-issue-56"></a>

## Buy quote refresh (Kumbaya, issue #56)

When **Pay with** is **ETH** or **USDM**, [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) reads the Kumbaya **`quoteExactOutput`** for the **current** CL8Y `amountOut` implied by the slider. TanStack Query v5 sets **`isFetching`** on **background refetches** even when **`isPending`** is false (cached row from the previous amount), so the hook treats **`isPending || isFetching`** while the quote query is enabled as **quote in flight**.

**UI invariants**

1. **Primary CTA** on [`TimeCurveSimplePage`](../../frontend/src/pages/TimeCurveSimplePage.tsx) shows **Refreshing quote…** and stays **disabled** until the quoter read settles for the current target — same window as `swapQuoteLoading` driving `nonCl8yBlocked`.
2. **`submitBuy`** still performs a fresh `readContract` quote immediately before building the swap tx; the CTA gate prevents rapid slider + click against a **visually** stale line item while RPC catches up (follow-up to the Anvil E2E race in [issue #52](https://gitlab.com/PlasticDigits/yieldomega/-/issues/52)).

**Spec ↔ test:** [invariants — Kumbaya quote refresh](../testing/invariants-and-business-logic.md#timecurve-simple-kumbaya-quote-refresh-issue-56) · [integrations/kumbaya.md](../integrations/kumbaya.md) · [issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56).

<a id="buy-charm-submit-fresh-bounds-issue-82"></a>

## Buy CHARM — fresh bounds at submit (issue #82)

On a **live block clock**, `TimeCurve.currentCharmBoundsWad()` can **shift** (max **tightens**, min **rises**) between the moment the slider last rendered and the block where **`buy` / `buyViaKumbaya`** executes. The UI must not ship **stale `charmWad`** (or a CL8Y `amountOut` that no longer matches a valid `charmWad` at tx time).

**Invariants**

1. **Re-read before sign:** [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts) and [`useTimeCurveArenaModel`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx) call [`readFreshTimeCurveBuySizing`](../../frontend/src/lib/timeCurveBuySubmitSizing.ts) immediately before building swap / `buy` calldata — same path for **CL8Y**, **two-step Kumbaya + `buy`**, and **single-tx `buyViaKumbaya`**.
2. **Clamp below live max:** sizing uses an effective CHARM ceiling of **99.5%** of the freshly read `maxCharmWad` (`CHARM_SUBMIT_UPPER_SLACK_BPS = 50`) so drift toward a lower **max** is unlikely to revert the bound check.
3. **Floor above live min:** sizing uses an effective CHARM floor of **100.5%** of the freshly read `minCharmWad` (`CHARM_SUBMIT_LOWER_HEADROOM_BPS = 50`) so drift toward a higher **min** is less likely at the lower band edge ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)).
4. **CHARM from CL8Y is floored:** [`finalizeCharmSpendForBuy`](../../frontend/src/lib/timeCurveBuyAmount.ts) uses integer division for CHARM wei (never rounds **up** past the band).
5. **Bare revert copy:** buy submit catches pass `{ buySubmit: true }` into [`friendlyRevertFromUnknown`](../../frontend/src/lib/revertMessage.ts) so generic **“execution reverted for an unknown reason”** maps to guidance about the band moving ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)). Rare residual failures at the edge may succeed on **retry** after one block or a small slider nudge.

**Spec ↔ test:** [invariants — submit-time CHARM sizing](../testing/invariants-and-business-logic.md#timecurve-buy-charm-submit-fresh-bounds-issue-82) · [integrations/kumbaya.md — single-tx](../integrations/kumbaya.md#issue-65-single-tx-router) · [play checklist](../testing/manual-qa-checklists.md#manual-qa-issue-82) · [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82).

<a id="timecurve-buy-hub-numeric-display-gitlab-191"></a>

## TimeCurve buy hub — derived numeric display (GitLab #191)

**Simple** (`/timecurve`) and **Arena** (`/timecurve/arena`) share one policy for **derived** amounts shown together in the buy checkout: **live CL8Y band** (min–max), **routed pay-token band** hints, **CHARM preview**, **CL8Y-at-launch projection** (“Worth at launch ≈”), **Arena buy summary chips**, and matching **recent-buy** CL8Y / CHARM columns on Simple — all use **`formatBuyHubDerivedCompact`** (**four significant figures**, [`timeCurveBuyHubFormat.ts`](../../frontend/src/lib/timeCurveBuyHubFormat.ts)).

**Intentionally different** (unchanged):

- **Hero “price now / 1 CHARM at launch”** tiles keep **fixed fractional digits** (`formatPriceFixed6` for CL8Y / USDM, `formatEthRateHero` for ETH) so per-block **ticks stay visible** — same rationale as the inline comment on `TimeCurveSimplePage`.
- **DOUB per CHARM at launch** on the rate board stays **five** significant figures (redemption density; unchanged from pre-#191).
- **CL8Y spend** in **CL8Y** mode remains the participant’s **typed decimal string** (full precision while editing); **ETH / USDM** quoted spend uses **`AmountDisplay`**.

**Spec ↔ test:** [invariants — #191](../testing/invariants-and-business-logic.md#timecurve-buy-hub-derived-numeric-display-gitlab-191) · [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191) · [manual QA (#191)](../testing/manual-qa-checklists.md#manual-qa-issue-191) · [skills index](../../skills/README.md).

<a id="erc20-approval-sizing-gitlab-143"></a>

## ERC-20 approval sizing — CL8Y → TimeCurve (GitLab #143)

TimeCurve **Simple** and **Arena** buy panels include **`Cl8yTimeCurveUnlimitedApprovalFieldset`**: default **exact** **`approve(TimeCurve, grossCl8yForTx)`** for **`buy`** and shared WarBow CL8Y pulls; optional checkbox stores **`yieldomega.erc20.cl8yTimeCurveUnlimited.v1`** and restores **`type(uint256).max`** for fewer repeat approvals (disclosure links **H-01** + [wallet-connection §143](wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143)). Kumbaya legs approve **slippage-bounded `maxIn`** to routers only. **`/referrals`** register approves the onchain burn amount exactly.

**Spec ↔ test:** [invariants — #143](../testing/invariants-and-business-logic.md#frontend-erc20-approval-sizing-gitlab-143) · [`cl8yTimeCurveApprovalPreference.test.ts`](../../frontend/src/lib/cl8yTimeCurveApprovalPreference.test.ts) · [GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143).

<a id="kumbaya-swap-deadline-chain-time-issue-83"></a>

## Kumbaya swap deadline — chain time (issue #83)

For **ETH / USDM** entry, **`exactOutput`** and **`TimeCurveBuyRouter.buyViaKumbaya`** carry a **`swapDeadline`** that routers validate against **`block.timestamp`**. After **`anvil_increaseTime`** (e.g. **`anvil_rich_state.sh`**), chain time can be **minutes ahead** of the browser; deadlines must therefore use **`getBlock({ blockTag: 'latest' }).timestamp + buffer`** ([`fetchSwapDeadlineUnixSec`](../../frontend/src/lib/timeCurveKumbayaSwap.ts)), fetched **immediately before** the swap (two-step: after wrap/approve) or **`buyViaKumbaya`** write (single-tx: after any USDM approve). **Spec ↔ test:** [invariants — issue #83](../testing/invariants-and-business-logic.md#timecurve-kumbaya-swap-deadline-chain-time-issue-83) · [kumbaya.md — QA time warp](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83) · [issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83).

<a id="timecurve-simple-audio-issue-68"></a>

## TimeCurve Simple — layered audio (issue #68)

The global **Web Audio** stack (BGM bus + SFX bus) unlocks on first user interaction; **TimeCurve Simple** wires **`coin_hit_shallow`** at **`TimeCurve.buy` / `buyViaKumbaya` submit** (hash returned from the wallet), **`charmed_confirm`** on receipt; **Arena** wires **`warbow_twang`** for **indexed‑ladder podium** moments only (**`warbowRankSfxPolicy`** · **`useArenaWarbowRankSfx`**; throttled in **`WebAudioMixer`**). **`kumbaya_whoosh`** for pay‑mode routing is **not** wired yet ([#68 maintainer note](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68)). **Indexer peer buys** + **timer heartbeats** use `useTimeCurveSimplePageSfx` (throttled; timer cues respect **`prefers-reduced-motion`**). **Album 1 BGM** persists **track + playback offset** across refresh ([issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71); verification [**`manual-qa-issue-71`**](../testing/manual-qa-checklists.md#manual-qa-issue-71)). **Narrow viewports:** **`INV-AUDIO-103`** clears the floating **`AlbumPlayerBar`** from **`RootLayout`**’s bordered nav ([GitLab #103](https://gitlab.com/PlasticDigits/yieldomega/-/work_items/103), [invariants §103](../testing/invariants-and-business-logic.md#mobile-album-dock-layout-issue-103)). Product mapping and accessibility notes: [sound-effects-recommendations.md §8](sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) · [invariants — frontend audio](../testing/invariants-and-business-logic.md#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68) · [issue #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68).
## `TimeCurveSimplePage` layout contract

Page leads with **action**: the sale hub sits at the very top, the
`PageHero` (title + lede + chain-time deadline) follows below as a context
strip. This intentionally inverts the usual hero-on-top pattern so first-run
visitors see the timer + buy CTA before they read marketing copy. The hub
itself is a CSS-container-query grid (`container-type: inline-size`) — it
collapses to a single column when its rendered width drops below ~880 px,
which works inside narrow viewports, side panes, and embedded contexts where
viewport-keyed media queries would not fire. See `.timecurve-simple__hub`
in `frontend/src/index.css`.

Above-the-fold **sale hub** (two columns on wide containers, one column on
narrow):

1. **Timer panel** (left of the hub): hero countdown rendered through the
   shared
   [`TimeCurveTimerHero`](../../frontend/src/pages/timecurve/TimeCurveTimerHero.tsx)
   component, which mirrors the standalone
   [`LaunchCountdownPage`](../../frontend/src/pages/LaunchCountdownPage.tsx)
   design pattern so both timers read as siblings:
   - **Backplate scene art** (`/art/scenes/timecurve-simple.jpg`) at low
     opacity behind the digits, sitting on a deep green gradient with a
     bottom-glow stage.
   - **Animated rising sparks** that switch from yellow → red and slow → fast
     when the timer enters the `timer-hero--critical` urgency window
     (`timerUrgencyClass`, ≤ 5 minutes remaining). Animation is suppressed
     under `prefers-reduced-motion: reduce`.
   - **Days chip + tabular digits**: long durations split into a bordered
     gold `Nd` chip + `HH:MM:SS` clock via the shared `formatLaunchCountdown`
     helper (so 24h+ never renders as a confusing `48:13:07`); both digit
     tracks use `font-variant-numeric: tabular-nums` so per-second updates
     don't reflow the line.
   - **Urgency-aware glow + pulse** on the digits: gold text-shadow under
     `timer-hero--warning` (≤ 1h), red glow plus a subtle scale-pulse under
     `timer-hero--critical` (≤ 5m).
   The timer panel still uses `useTimecurveHeroTimer` for the underlying
   wall ↔ chain skew so Simple and Arena countdowns stay in lock-step. The
   panel header (driven by `PageSection`) carries the one-sentence
   narrative from `phaseNarrative()`, and a phase-aware foot line (e.g.
   "Every buy adds 2 minutes; clutch buys hard-reset the clock.") sits
   beneath the digits inside the hero.
2. **Buy panel** (right of the hub):
   - **Live rate board** at the top — the **single most-important number on
     the page** is "1 CHARM costs right now" rendered with fixed 6-decimal
     precision (`formatPriceFixed6` on `pricePerCharmWad`) so per-block ticks
     of ~1e-5 CL8Y are visibly obvious. Underneath, the at-launch chain
     "1 CHARM = N DOUB = M CL8Y" gives participants the full math: DOUB
     comes from `doubPerCharmAtLaunchWad(totalTokensForSale, totalCharmWeight)`
     and CL8Y from `participantLaunchValueCl8yWei` (the canonical 1.275×
     anchor). Both refresh via the hook's wagmi `refetchInterval: 1000` and
     `useBlock({ watch: true })` so they update on every new block / buy.
   - Inline min–max pill, slider + numeric input, two-line preview
     (**"You add ≈ X CHARM"** + **"Worth at launch ≈ Y CL8Y"**, hidden when
     the wallet holds no CHARM yet), single CTA labeled **Buy CHARM** (or
     **Refreshing quote…** when a Kumbaya quoter read is in flight for ETH/USDM
     pay mode — [Buy quote refresh](#buy-quote-refresh-kumbaya-issue-56)).
   - Pay-with (CL8Y/ETH/USDM), slippage, wallet balance, and referral
     controls live behind a collapsed `<details>` "Advanced" disclosure so
     first-run buyers see the rate board + slider + CTA + launch projection
     only. Cooldown / error state appear _below_ the CTA as compact
     secondary status.
   - When no wallet is connected, the panel renders a "Connect a wallet to
     buy CHARM…" prompt with the **shared** `<WalletConnectButton />`
     (`frontend/src/components/WalletConnectButton.tsx`) — same
     `wallet-action wallet-action--connect wallet-action--priority` style as
     the header so the connect CTA is visually consistent across the app.

Below the hub:

3. **`PageHero`** with `stateBadge` (`Pre-launch` / `Sale live` /
   `Sale ended`), the action-led lede ("Buy CHARM with CL8Y to lock in your
   share of the DOUB launch. Your CHARM only grows in CL8Y value as the sale
   heats up — the timer is the only thing in your way."), and chain-time
   deadline. The hero owns the sale-phase badge so the visual status
   indicator is shared with Arena / Protocol via `phaseBadge()`.
4. **"Your stake at launch" panel** (only when wallet connected and a sale is
   active or ended): two big-number tiles — your CHARM count and the
   projected **CL8Y at launch** computed from
   [`participantLaunchValueCl8yWei`](../../frontend/src/lib/timeCurvePodiumMath.ts)
   (the **launch-anchor invariant**: `1.275 × per-CHARM clearing price`,
   enforced by `DoubLPIncentives` and pinned by the
   [`launch-anchor invariant`](../testing/invariants-and-business-logic.md)
   test in `timeCurvePodiumMath.test.ts`). During the sale the **personal DOUB
   count for wallet holdings** stays **hidden** — DOUB-per-CHARM dilutes as
   `totalCharmWeight` grows, while CL8Y-at-launch only stays flat or rises.
   After **`redeemCharms`** (`charmsRedeemed` true), the panel adds **Redeemed
   DOUB**, **Settled** header chrome, and strikes through the CL8Y projection
   ([§ Stake-at-launch after redeemCharms](#timecurve-simple-stake-redeemed-issue-90)).
   (DOUB as a *rate* stays on the buy-panel rate board during the sale.) UX
   guarantee: if a participant only watches one number during the sale, CL8Y-at-launch is the right stress-free projection.
5. **Live reserve podiums ([issue #113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113))** —
   a compact Simple-only `PageSection` immediately above **Recent buys** shows
   all four fixed v1 reserve categories (`Last Buy`, `WarBow`,
   `Defended Streak`, `Time Booster`) with 1st / 2nd / 3rd rows. With
   **`VITE_INDEXER_URL`**, `usePodiumReads` consumes **`GET /v1/timecurve/podiums`**, which serves **Postgres-derived live predictions** for every category while **`sale_ended`** is **false** (**`INV-INDEXER-PODIUM-PREDICT-LIVE`**, schema **≥ 1.20.0**), then mirrors head **`podium(category)`** after the sale ends. Without the indexer URL, the hook falls back to direct **`podium()`** RPC (WarBow may stay empty until **`finalizeWarbowPodium`**). Prize CL8Y hints remain a client projection from **`PodiumPool`** balance. It reuses the shared ranking row chrome, category copy, blockie +
   explorer address display, and marks the connected wallet with the same
   `ranking-list__item--you` treatment as Arena. A `Buy` log refetches
   podium reads immediately. **Empty winner slots** use a neutral **em dash**, not wallet-connect copy (**`INV-FRONTEND-113-PODIUM-FALLBACK`**).
   This is read-only UI: **payout authority** stays onchain (`distributePrizes`); the indexer prediction is a **best-effort live leaderboard** for the sale window.
6. **Recent buys** — last 3 buys (wallet · amount · `+Xs` extension or
   `hard reset`) sourced from `fetchTimecurveBuys` (indexer). Falls back to
   a calm placeholder if the indexer is offline; never blocks the buy CTA.

Cross-page navigation to Arena / Protocol lives **only** in the persistent
`TimeCurveSubnav` at the top of every TimeCurve route — the simple view does
not duplicate those links inline. UX rationale: the subnav is already on
screen, an in-page tile row added vertical scroll for no new information.

The global app footer (`IndexerStatusBar` + `Canonical fee sinks` panel)
rendered by `RootLayout` is also **hidden on `/timecurve` only**. It stays
visible on Home, `/timecurve/arena`, `/timecurve/protocol`, and every other
route — the operator / power-user surfaces benefit from the indexer health
pill and the live fee-sink table, but on the Simple first-run path those
panels swamp the page with secondary information that distracts from the
single primary action. The `showFooter` toggle in
[`RootLayout.tsx`](../../frontend/src/layout/RootLayout.tsx) is keyed on
`location.pathname === "/timecurve"`.

<a id="timecurve-presale-charm-header-hint"></a>

### Presale CHARM +15% weight boost (`/timecurve*`)

The **+15%** extra **`charmWeight`** line is **onchain only** (`TimeCurve.doubPresaleVesting`, `PRESALE_CHARM_WEIGHT_BPS`, `setDoubPresaleVesting`). **When both** **`PresaleCharmBeneficiaryRegistry`** and **`DoubPresaleVesting`** deploy, **`TimeCurve`** may point **`doubPresaleVesting`** at the **registry** for **`isBeneficiary`** while **`/vesting`** still uses the vesting proxy address. Players verify membership with **`isBeneficiary(connectedWallet)`** on the contract **`TimeCurve`** reads — not from a global header badge. Map: [`INV-TC-PRESALE-CHARM-BOOST`](../testing/invariants-and-business-logic.md#timecurve-presale-charm-weight-boost). Contributor QA checklist: [manual-qa — GitLab #202](../testing/manual-qa-checklists.md#manual-qa-issue-202-presale-charm-registry).

<a id="global-footer-fee-sinks-mobile-issue-93"></a>

### Global footer — fee sinks on narrow viewports ([issue #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93))

[`FeeTransparency`](../../frontend/src/components/FeeTransparency.tsx) renders live `FeeRouter` sink destinations plus optional indexer history. **Addresses** use [`MegaScannerAddressLink`](../../frontend/src/components/MegaScannerAddressLink.tsx): outbound URLs match [`explorerAddressUrl`](../../frontend/src/lib/explorer.ts) — **`{base}/address/{addr}`** with **`base`** from **`VITE_EXPLORER_BASE_URL`** (default **`https://mega.etherscan.io`**, same as **tx** links), **abbreviated** to **four** leading + **four** trailing glyphs at **≤479px** so rows do not clip in the footer panel. **`TimeCurveProtocolPage`** wired-contract and FeeRouter sink rows use the same component; KV `<dt>` labels use [`humanizeKvLabel`](../../frontend/src/lib/humanizeIdentifier.ts) so `WARBOW_*`, `camelCase`, and similar identifiers read as spaced words (**Manual QA:** [`../testing/manual-qa-checklists.md#manual-qa-issue-93`](../testing/manual-qa-checklists.md#manual-qa-issue-93)). Participant identities elsewhere use [`AddressInline`](../../frontend/src/components/AddressInline.tsx) ([GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)).

Below-the-fold dense sections (WarBow action ladder, payout preview accordion,
full battle feed, `RawDataAccordion`) are **deliberately omitted**. They live on
`Arena` and `Protocol` respectively. Simple keeps only the compact live reserve
podium snapshot added for [issue #113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113).

<a id="timecurve-simple-stake-redeemed-issue-90"></a>

## Stake-at-launch after `redeemCharms` (issue #90)

When **`charmsRedeemed(wallet)`** is **true** ([issue #90](https://gitlab.com/PlasticDigits/yieldomega/-/issues/90)), the Simple panel [`TimeCurveStakeAtLaunchSection`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.tsx):

1. Shows **Redeemed · X DOUB** using the same allocation ratio as **`redeemCharms`** (`expectedTokenFromCharms` in [`useTimeCurveSaleSession`](../../frontend/src/pages/timecurve/useTimeCurveSaleSession.ts)).
2. **Dims + strikes through** the **Worth at launch ≈** CL8Y figure (historical projection), with **(redeemed)** on the label — **option B rejected**: do **not** replace that CL8Y line with DOUB-only “worth” (misleading across CL8Y / ETH / USDM entry rails).
3. Adds **Settled** chrome (green check + badge) in the section header **`actions`** slot.

**Spec ↔ test:** [invariants — stake panel redeemed](../testing/invariants-and-business-logic.md#timecurve-simple-stake-redeemed-issue-90) · [`TimeCurveStakeAtLaunchSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveStakeAtLaunchSection.test.tsx).

## `TimeCurveProtocolPage` layout

A read-only surface for operators:

- Sale state: phase, deadline, current charm price, total CHARM minted,
  total reserve raised, ended flag.
- Immutable parameters: launched token, accepted asset, min/max buy,
  podium / FeeRouter sinks (top-level `bps`).
- Linear charm price parameters (slope, intercept, resets).
- FeeRouter sinks for the accepted asset (LP / burn / podium / treasury / team).

All values come from `useReadContracts` (one batched RPC roundtrip per
contract) and are formatted with the existing `AmountDisplay` /
`UnixTimestampDisplay` / `formatBpsAsPercent` helpers. **KV `<dt>` labels**
use [`humanizeKvLabel`](../../frontend/src/lib/humanizeIdentifier.ts) for
Solidity-style identifiers (**`WARBOW_*`**, **`camelCase`** getters, etc.).
**Contract addresses** use [`MegaScannerAddressLink`](../../frontend/src/components/MegaScannerAddressLink.tsx) for the same **narrow-viewport** abbreviation + **explorer base URL** (`VITE_EXPLORER_BASE_URL`, default MegaETH Etherscan) as tx links and [`AddressInline`](../../frontend/src/components/AddressInline.tsx) ([§ Global footer — fee sinks](#global-footer-fee-sinks-mobile-issue-93), [GitLab #93](https://gitlab.com/PlasticDigits/yieldomega/-/issues/93), [GitLab #98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)). There is no write
surface.

## Sub-navigation contract

`TimeCurveSubnav` is the **only** way to switch between the three views and
must be rendered at the top of each TimeCurve route with the matching
`active` prop. It uses `<NavLink>` from `react-router-dom`, so the active
state stays consistent with the URL even after a hard refresh or deep link.

```ts
<TimeCurveSubnav active="simple" | "arena" | "protocol" />
```

The sub-nav advertises one-line hints per tab so users know what they're
clicking into without having to navigate first.

<a id="launchcountdown--simple-handoff"></a>

## LaunchCountdown → Simple handoff

`LaunchGate.tsx` controls the pre-launch / post-launch routing. The contract
is:

- **Pre-launch (`now < VITE_LAUNCH_TIMESTAMP`):** every route renders
  `LaunchCountdownPage` (the marketing countdown). The TimeCurve sub-routes
  are still registered but gated.
- **At launch (`now >= VITE_LAUNCH_TIMESTAMP`):** the gate releases and the
  default `/` route lands on `TimeCurveSimplePage`. Direct links to
  `/timecurve/arena` or `/timecurve/protocol` continue to work; the simple
  view is just the friendly default.
- **No countdown configured (`VITE_LAUNCH_TIMESTAMP` unset / `0`):** the
  gate is a no-op and `/timecurve` immediately renders `TimeCurveSimplePage`.
  **`/`** is the canonical marketing hub (`HomePage`); **`/home`** is registered
  as the **same** hub surface so direct links do not render an empty
  `<Outlet />` ([GitLab #199](https://gitlab.com/PlasticDigits/yieldomega/-/issues/199),
  [`INV-FRONTEND-199-HOME-ROUTE`](../testing/invariants-and-business-logic.md#launchgate-home-route--no-env-parity-gitlab-199)).

For QA you can simulate the pre-launch state with the
`LAUNCH_OFFSET_SEC` knob in `scripts/start-local-anvil-stack.sh` (see the
QA checklist item C8). It writes `VITE_LAUNCH_TIMESTAMP=$now+offset` to
`frontend/.env.local`, so the next Vite restart hits the countdown and you
can watch it flip into the simple view live.

## Testing

- **Pure logic:**
  [`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts)
  covers `derivePhase`, `ledgerSecIntForPhase` (hero vs block clock — [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48)),
  `phaseBadge`, and `phaseNarrative` for all five
  phases (`loading` → `saleStartPending` → `saleActive` →
  `saleExpiredAwaitingEnd` → `saleEnded`).
- **Sub-nav:**
  [`TimeCurveSubnav.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSubnav.test.tsx)
  uses `renderToStaticMarkup` to assert the three tabs render in the right
  order with `aria-current="page"` on the active tab.
- **Simple podiums:** [`TimeCurveSimplePodiumSection.test.tsx`](../../frontend/src/pages/timecurve/TimeCurveSimplePodiumSection.test.tsx)
  asserts all four v1 categories, three placements, viewer highlighting, and
  empty onchain slot copy ([issue #113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113)).
- **e2e:** `frontend/e2e/timecurve.spec.ts` asserts the simple view is the
  default `/timecurve` landing, shows the compact podium summary above Recent
  buys without reintroducing dense Arena sections above the fold,
  routes correctly through the sub-nav, and stays usable at a 390×844 mobile
  viewport. `frontend/e2e/launch-countdown.spec.ts` covers the pre-launch
  gate and its handoff.

Run order (after `bash scripts/start-local-anvil-stack.sh
SKIP_ANVIL_RICH_STATE=1 START_BOT_SWARM=1`):

```bash
cd frontend
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=5
```

## Files

- New: `frontend/src/pages/TimeCurveSimplePage.tsx`
- New: `frontend/src/pages/TimeCurveProtocolPage.tsx`
- New: `frontend/src/pages/timecurve/TimeCurveSubnav.tsx`
- New: `frontend/src/pages/timecurve/TimeCurveSubnav.test.tsx`
- New: `frontend/src/pages/timecurve/useTimeCurveSaleSession.ts`
- New: `frontend/src/pages/timecurve/timeCurveSimplePhase.ts`
- New: `frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts`
- Edited: `frontend/src/pages/TimeCurvePage.tsx` (sub-nav + Arena framing only)
- Edited: `frontend/src/app/LaunchGate.tsx` (three routes + simple as default)
- Edited: `frontend/src/index.css` (`timecurve-simple-*`, `timecurve-subnav*` styles)
- Edited: `scripts/start-local-anvil-stack.sh` (`LAUNCH_OFFSET_SEC`)
- Edited: `frontend/.env.example` (`VITE_LAUNCH_TIMESTAMP` guidance)
- Edited: `frontend/e2e/timecurve.spec.ts`
- Edited: `frontend/vite.config.ts` (vitest now picks up `*.test.tsx`)

---

**Related:** [testing — invariants (TimeCurve frontend phase)](../testing/invariants-and-business-logic.md#timecurve-frontend-sale-phase-and-hero-timer) · [testing — Simple live reserve podiums](../testing/invariants-and-business-logic.md#timecurve-simple-live-reserve-podiums-issue-113) · [testing — WarBow pending flag / `Buy.flagPlanted`](../testing/invariants-and-business-logic.md#timecurve-frontend-warbow-pending-flag-and-buyflagplanted-issue-51) · [testing — WarBow flag plant opt-in (issue #63)](../testing/invariants-and-business-logic.md#timecurve-warbow-flag-plant-opt-in-issue-63) · [testing — Arena WarBow hero actions](../testing/invariants-and-business-logic.md#timecurve-arena-warbow-hero-actions-issue-101) · [testing — Arena sniper-shark cutout](../testing/invariants-and-business-logic.md#timecurve-arena-sniper-shark-cutout-issue-80) · [testing — Kumbaya quote refresh (Simple buy CTA)](../testing/invariants-and-business-logic.md#timecurve-simple-kumbaya-quote-refresh-issue-56) · [testing — Buy CHARM submit-time sizing (issue #82)](../testing/invariants-and-business-logic.md#timecurve-buy-charm-submit-fresh-bounds-issue-82) · [testing — Buy hub derived numeric display (GitLab #191)](../testing/invariants-and-business-logic.md#timecurve-buy-hub-derived-numeric-display-gitlab-191) · [testing — Kumbaya swap deadline vs Anvil warp (issue #83)](../testing/invariants-and-business-logic.md#timecurve-kumbaya-swap-deadline-chain-time-issue-83) · [testing — Album 1 BGM + SFX bus](../testing/invariants-and-business-logic.md#timecurve-frontend-album-1-bgm-and-sfx-bus-issue-68) · [YO-TimeCurve-QA-Checklist](../qa/YO-TimeCurve-QA-Checklist.md) (C1, C12) · [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48) · [issue #51](https://gitlab.com/PlasticDigits/yieldomega/-/issues/51) · [issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56) · [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63) · [issue #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68) · [issue #80](https://gitlab.com/PlasticDigits/yieldomega/-/issues/80) · [issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82) · [issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83) · [issue #101](https://gitlab.com/PlasticDigits/yieldomega/-/issues/101) · [issue #113](https://gitlab.com/PlasticDigits/yieldomega/-/issues/113) · [GitLab #191](https://gitlab.com/PlasticDigits/yieldomega/-/issues/191)

**Agent phase:** [Phase 13 — Frontend design (Vite static)](../agent-phases.md#phase-13)
