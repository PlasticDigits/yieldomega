# YieldOmega — TimeCurve QA checklist (local + release-oriented)

> **Scope:** Manual and semi-automated verification for TimeCurve, aligned with this repository.  
> **Canonical mechanics:** [`docs/product/primitives.md`](../product/primitives.md), [`contracts/src/TimeCurve.sol`](../../contracts/src/TimeCurve.sol), [`docs/onchain/fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md), [`contracts/PARAMETERS.md`](../../contracts/PARAMETERS.md). **DOUB genesis / FDV anchor / calibration:** [GitLab #53](https://gitlab.com/PlasticDigits/yieldomega/-/issues/53), [`docs/simulations/README.md`](../simulations/README.md), [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#doub-genesis-fdv-anchor-and-sale-economics-gitlab-53).

---

## Delta vs PlasticDigits/cl8y-ecosystem-qa (GitLab spec v2.0)

The external [YO-TimeCurve-Verification-Spec.md v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) and [YO-TimeCurve-Release-Checklist.md v1.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Release-Checklist.md) are **partly outdated** for:

1. **Podium categories (exactly four, reserve-funded):** Canonical v1 tracks match [`docs/product/primitives.md`](../product/primitives.md) — **last buy**, **WarBow** (top-3 Battle Points / `warbowLadderPodium()` ≡ `podium(CAT_WARBOW)`), **defended streak** (best under-window streak), **time booster** (most effective deadline seconds added). **`distributePrizes`** pays these from **`PodiumPool`** in the **accepted reserve asset (CL8Y at launch)** after `endSale`. **DOUB** is **only** for **`redeemCharms`** (pro-rata by charm weight), **not** podium payouts. Legacy ecosystem-qa category sets (e.g. opening/closing-window podiums) are **removed**.

   | Category | Share of **podium pool** | Share of **gross raise** (podium slice = **20%** of each buy) |
   |----------|--------------------------|----------------------------------------------------------------|
   | Last buy | **40%** | **8%** |
   | WarBow (top BP) | **25%** | **5%** |
   | Defended streak | **20%** | **4%** |
   | Time booster | **15%** | **3%** |

2. **`distributePrizes` internals:** At call time, splits the **accepted asset** balance held by **`PodiumPool`** **40% / 25% / 20% / 15%** across the four rows above (see `TimeCurve.distributePrizes()`). Equivalently **8% / 5% / 4% / 3%** of **gross raise** while the podium **`FeeRouter`** sink remains **20%**. **Within** each category, **1st : 2nd : 3rd** uses **4∶2∶1**. This layer is **not** the same as **buy-time** `FeeRouter` top-level routing ([`docs/onchain/fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md)).

3. **Buy-time fee routing** (canonical launch default, **full gross** per buy through `FeeRouter`): **30%** DOUB/CL8Y locked LP · **40%** CL8Y burned · **20%** podium pool (**reserve** prizes; **podium-internal** splits in the table above) · **0%** team · **10%** Rabbit Treasury — **10 000 bps** (**3000 / 4000 / 2000 / 0 / 1000**). Do not conflate these **top-level** percentages with **podium-internal** **40/25/20/15** or placement **4∶2∶1**.

---

## A. Local full stack (Anvil + indexer + frontend + bots)

**Prerequisites:** Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+. On **PEP 668** systems, install `bots/timecurve` deps via venv (or the README `--user --break-system-packages` fallback) before the stack runs the bot swarm — see [`bots/timecurve/README.md`](../../bots/timecurve/README.md).

- [ ] **A1** — From repo root: `bash scripts/start-local-anvil-stack.sh` — Postgres, Anvil, deploy, indexer, `frontend/.env.local` written.
- [ ] **A1a** — From repo root: `make check-frontend-env` — validates merged `frontend/.env` + `frontend/.env.local` (`VITE_TIMECURVE_ADDRESS`, `VITE_FEE_ROUTER_ADDRESS`, siblings, RPC, chain id).
- [ ] **A2** — Optional: `SKIP_ANVIL_RICH_STATE=1` for live sale + default swarm (see script header) — sale stays active for bots/UI; `START_BOT_SWARM=0` to skip bots.
- [ ] **A3** — `cd frontend && npm ci && npm run dev` — app at `http://127.0.0.1:5173` (or configured port). Restart Vite if dev was started before `frontend/.env.local` existed.
- [ ] **A4** — `bash scripts/sync-bot-env-from-frontend.sh` — `bots/timecurve/.env.local` aligned with `VITE_*`.
- [ ] **A5** — `cd bots/timecurve && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"` (or PEP 668 fallback in that README) — `timecurve-bot` / `import web3` works (`start-local-anvil-stack.sh` preflights this when `START_BOT_SWARM=1`).
- [ ] **A6** — QA wallet: add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=<0x...>`** to `bots/timecurve/.env.local` (**addresses only**); re-run swarm or stack so one-shot funding includes your wallet — same 10k ETH + mock CL8Y mint as swarm bots (Anvil **31337** + `--allow-anvil-funding` only).
- [ ] **A7** — Connect browser wallet with the **same** account as A6 — can submit buys / WarBow txs from UI.
- [ ] **A8** — Smoke indexer: `curl -s http://127.0.0.1:<INDEXER_PORT>/v1/timecurve/buys?limit=5` — JSON rows after activity.

---

## B. TimeCurve behavior (contract-aligned)

- [ ] **B1** — Sale lifecycle: buys extend timer; hard reset when remaining &lt; 13 min — match `TIMER_RESET_*` in `TimeCurve.sol`.
- [ ] **B2** — Four podium categories — **WarBow** is reserve-funded from `PodiumPool`; see [primitives.md](../product/primitives.md).
- [ ] **B3** — `distributePrizes`: **40/25/20/15** of **podium pool** balance — not FeeRouter top-level percentages.
- [ ] **B4** — `redeemCharms` after `endSale` — pro-rata DOUB per charm weight.
- [ ] **B5** — WarBow: steal, revenge, guard, flag — gated by `!ended` where applicable — confirm post-end behavior in `TimeCurve.sol` for deployment.

---

## C. Frontend (TimeCurve page)

- [ ] **C1** — Timer countdown and urgency styling; with **`VITE_INDEXER_URL`**, phase badge + Buy gating must **not** show pre-start / “Loading sale state…” while the hero shows a **live** round (same chain clock: `ledgerSecIntForPhase` + hero timer — [timecurve-views — issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48), [docs/frontend/timecurve-views.md](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48)).
- [ ] **C2** — CHARM bounds and price display consistent with contract reads.
- [ ] **C3** — Podium / leaderboard panels for **four** reserve categories — verify on **`/timecurve/arena`**.
- [ ] **C4** — WarBow stats + battle feed (indexer-backed where wired) — verify on **`/timecurve/arena`**.
- [ ] **C5** — Fee sink display matches deployment **FeeRouter**; cross-check `FeeRouter` on chain if labels drift.
- [ ] **C6** — Redeem path after sale end (when stack uses ended state).
- [ ] **C7** — `/timecurve` lands on the **Simple** view: state badge + hero countdown + single buy card + ticker + "Want more?" tiles are visible **above the fold**, while WarBow / podiums / battle feed / raw accordion are **not** visible (they live on Arena / Protocol). Mobile (390×844) layout collapses cleanly. See [`docs/frontend/timecurve-views.md`](../frontend/timecurve-views.md).
- [ ] **C8** — Sub-nav (`TimeCurveSubnav`) routes correctly between `/timecurve` (Simple), `/timecurve/arena` (PvP / podiums / battle feed), and `/timecurve/protocol` (raw `TimeCurve` / `LinearCharmPrice` / `FeeRouter` reads). The active tab gets `aria-current="page"`. Direct deep links to each route render the right page on a hard refresh.
- [ ] **C9** — Launch-countdown handoff: relaunch the stack with `LAUNCH_OFFSET_SEC=90 bash scripts/start-local-anvil-stack.sh START_BOT_SWARM=1`, restart Vite, and confirm `LaunchCountdownPage` renders during the offset window and **flips into `TimeCurveSimplePage`** (not the dense Arena view) when the countdown hits zero. Buy CTA becomes interactive immediately after the flip.
- [ ] **C10** — **Bot swarm + Simple ticker (issue #40, Acceptance B5):** `START_BOT_SWARM=1 bash scripts/start-local-anvil-stack.sh` (optionally `SKIP_ANVIL_RICH_STATE=1` for a faster loop). With indexer up and `VITE_INDEXER_URL` pointing at it, open `/timecurve` on the Simple view. Confirm **Recent buys** lists the last few buys (buyer short address, CL8Y amount, `+Ns` timer extension or **hard reset**, tx link). No console errors. When your wallet is on cooldown after a buy, the buy card should still show spend preview / disabled CTA consistent with `nextBuyAllowedAt` (Arena uses the same reads).
- [ ] **C11** — **First-time “I want DOUB” heuristic (issue #40, Recommendations §6):** As a disconnected visitor, read top-to-bottom once: you should see **TimeCurve sale** → **Time left** (what the timer means in foot copy) → **Recent buys** (social proof) → **Buy CHARM** with “Connect a wallet…” → **Want more?** linking Arena / Protocol. You should *not* need WarBow or podiums to understand “buy CHARM now, redeem DOUB later.” After connecting, the primary action should remain **Buy CHARM** with an explicit ≈CHARM preview before submit.
- [ ] **C12** — **Phase vs RPC (issue #48):** On local stack with indexer + optional `SKIP_ANVIL_RICH_STATE=1` + bot swarm, open `/timecurve` and `/timecurve/arena` during an **active** sale. The **state badge** (Simple) and Arena sale strip must agree with a **live** round when `saleStart` is in the past and the sale is not ended — not *Pre-launch* / *COMING SOON* while the **hero** countdown is clearly counting down a live timer. If something mismatches, confirm wallet RPC and `VITE_INDEXER_URL` target the same chain; see [timecurve-views — Chain time and sale phase](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48).

---

## References

- [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#doub-genesis-fdv-anchor-and-sale-economics-gitlab-53) — DOUB FDV + sale economics checklist (issue #53)
- [`docs/frontend/timecurve-views.md`](../frontend/timecurve-views.md) — three-view split, sale-phase + hero clock (issue #48)
- [`docs/testing/e2e-anvil.md`](../testing/e2e-anvil.md) — `VITE_*` contract + Playwright
- [`scripts/check-frontend-vite-env.sh`](../../scripts/check-frontend-vite-env.sh) — `make check-frontend-env`
- [`bots/timecurve/README.md`](../../bots/timecurve/README.md) — swarm, env vars
