# YieldOmega — TimeCurve QA checklist (local + release-oriented)

> **Scope:** Manual and semi-automated verification for TimeCurve, aligned with this repository.  
> **Canonical mechanics:** [`docs/product/primitives.md`](../product/primitives.md), [`contracts/src/TimeCurve.sol`](../../contracts/src/TimeCurve.sol), [`docs/onchain/fee-routing-and-governance.md`](../onchain/fee-routing-and-governance.md), [`contracts/PARAMETERS.md`](../../contracts/PARAMETERS.md).

---

## Delta vs PlasticDigits/cl8y-ecosystem-qa (GitLab spec v2.0)

The external [YO-TimeCurve-Verification-Spec.md v2.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Verification-Spec.md) and [YO-TimeCurve-Release-Checklist.md v1.0](https://gitlab.com/PlasticDigits/cl8y-ecosystem-qa/-/blob/main/specs/YO-TimeCurve-Release-Checklist.md) are **partly outdated** for:

1. **Podium categories:** There are **three** reserve podium categories in `TimeCurve` (**last buy**, **time booster**, **defended streak**). **WarBow** is **Battle Points / PvP** and **not** a fourth reserve prize slice. The **WarBow Ladder** top-3 is display-only (`warbowLadderPodium()`), not paid from `PodiumPool`.
2. **`distributePrizes`:** Splits the **accepted asset balance** held by **`PodiumPool`** at call time: **50% / 25% / 25%** across those three categories (see `TimeCurve.distributePrizes()`), with **4∶2∶1** within each category. This is **not** the same as **buy-time** `FeeRouter` routing (see fee-routing doc).
3. **Buy-time fee routing** (canonical launch default): **25%** DOUB locked LP · **35%** CL8Y burn · **20%** podium pool · **0%** team · **20%** Rabbit Treasury — **10 000 bps** total. Do not conflate these percentages with **podium internal** splits.

---

## A. Local full stack (Anvil + indexer + frontend + bots)

**Prerequisites:** Docker, Foundry (`anvil`, `forge`, `cast`), `jq`, `curl`, Node/npm, Python 3.11+.

- [ ] **A1** — From repo root: `bash scripts/start-local-anvil-stack.sh` — Postgres, Anvil, deploy, indexer, `frontend/.env.local` written.
- [ ] **A2** — Optional: `SKIP_ANVIL_RICH_STATE=1` for live sale + default swarm (see script header) — sale stays active for bots/UI; `START_BOT_SWARM=0` to skip bots.
- [ ] **A3** — `cd frontend && npm ci && npm run dev` — app at `http://127.0.0.1:5173` (or configured port).
- [ ] **A4** — `bash scripts/sync-bot-env-from-frontend.sh` — `bots/timecurve/.env.local` aligned with `VITE_*`.
- [ ] **A5** — `cd bots/timecurve && pip install -e ".[dev]"` (or use `.venv`) — `timecurve-bot` available.
- [ ] **A6** — QA wallet: add **`YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES=<0x...>`** to `bots/timecurve/.env.local` (**addresses only**); re-run swarm or stack so one-shot funding includes your wallet — same 10k ETH + mock CL8Y mint as swarm bots (Anvil **31337** + `--allow-anvil-funding` only).
- [ ] **A7** — Connect browser wallet with the **same** account as A6 — can submit buys / WarBow txs from UI.
- [ ] **A8** — Smoke indexer: `curl -s http://127.0.0.1:<INDEXER_PORT>/v1/timecurve/buys?limit=5` — JSON rows after activity.

---

## B. TimeCurve behavior (contract-aligned)

- [ ] **B1** — Sale lifecycle: buys extend timer; hard reset when remaining &lt; 13 min — match `TIMER_RESET_*` in `TimeCurve.sol`.
- [ ] **B2** — Three podium categories only; **WarBow** BP separate from reserve prizes — see [primitives.md](../product/primitives.md).
- [ ] **B3** — `distributePrizes`: 50/25/25 of **podium pool** balance — not FeeRouter percentages.
- [ ] **B4** — `redeemCharms` after `endSale` — pro-rata DOUB per charm weight.
- [ ] **B5** — WarBow: steal, revenge, guard, flag — gated by `!ended` where applicable — confirm post-end behavior in `TimeCurve.sol` for deployment.

---

## C. Frontend (TimeCurve page)

- [ ] **C1** — Timer countdown and urgency styling.
- [ ] **C2** — CHARM bounds and price display consistent with contract reads.
- [ ] **C3** — Podium / leaderboard panels for **three** reserve categories.
- [ ] **C4** — WarBow stats + battle feed (indexer-backed where wired).
- [ ] **C5** — Fee sink display matches deployment **FeeRouter**; cross-check `FeeRouter` on chain if labels drift.
- [ ] **C6** — Redeem path after sale end (when stack uses ended state).

---

## D. Indexer

- [ ] **D1** — Migrations applied; API responds on `/v1/timecurve/*` routes used by frontend.
- [ ] **D2** — Buy and WarBow events decode; no reliance on guessed ambush/streak fields — use `Buy` event fields.

---

## E. Automation gates (before release candidate)

Run per [`docs/testing/strategy.md`](../testing/strategy.md):

- [ ] **E1** — Contracts: `cd contracts && forge test` — all green.
- [ ] **E2** — Indexer: `cd indexer && cargo test --lib` (and clippy if required by CI).
- [ ] **E3** — Frontend unit: `cd frontend && npm run test` / `vitest` per project scripts.
- [ ] **E4** — Anvil E2E (optional): `bash scripts/e2e-anvil.sh` (Foundry + Playwright).

---

## F. Production-oriented (release checklist, condensed)

- [ ] **F1** — Addresses finalized in [`contracts/PARAMETERS.md`](../../contracts/PARAMETERS.md).
- [ ] **F2** — Governance roles verified (admin, params, pauser) per deployment runbook.
- [ ] **F3** — **FeeRouter** weights and destinations match [fee-routing doc](../onchain/fee-routing-and-governance.md).
- [ ] **F4** — Operations: documented deploy path; rollback/pause contacts; monitor timer, indexer lag, first-buy fee routing.

---

## References

- [`docs/testing/e2e-anvil.md`](../testing/e2e-anvil.md) — `VITE_*` table, Playwright
- [`bots/timecurve/README.md`](../../bots/timecurve/README.md) — swarm, env vars
- [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) — stack env toggles
