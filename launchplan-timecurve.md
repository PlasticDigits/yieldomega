# TimeCurve — Doubloon (DOUB) launch plan

**Goal:** Get from the current repo state to **first MegaETH devnet end-to-end**: real USDm, DOUB as the **launched token** on TimeCurve, full sale lifecycle, **continuous simulations**, and **contract fuzzing** — with **non–TimeCurve** product surfaces treated as **under construction** in the frontend (short placeholder copy only).

**Authoritative policy elsewhere:** Runtime fee **weights** (30 / 20 / 35 / 15) and governance intent are in [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md). Parameter checklist: [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md). Stage 2 smoke criteria: [`docs/testing/strategy.md`](docs/testing/strategy.md) and [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md).

---

## 1. Launch scope (what “done” means for devnet v1)

| Milestone | Definition |
|-----------|------------|
| **Contracts** | `TimeCurve.launchedToken` = **DOUB**; `totalTokensForSale` + DOUB pre-positioned on `TimeCurve`; `acceptedAsset` = **official devnet USDm**; `FeeRouter` + sinks wired per canonical bps; `RabbitTreasury` + `Doubloon` roles correct. |
| **Indexer** | Ingests devnet from empty DB; smoke txs visible; lag acceptable per runbook. |
| **Frontend** | **TimeCurve** path is the real launch UX. **Rabbit Treasury, NFT collection, and any “Kumbaya” / “Sir” pages** show **under construction** messaging (what the feature will be), not full flows — unless explicitly pulled into this milestone. |
| **Simulations** | TimeCurve Monte Carlo + duration / raise studies run on a schedule (CI nightly or tagged releases) with saved JSON artifacts for regression comparison. |
| **Fuzzing** | Foundry invariant / fuzz suites green for TimeCurve + treasury paths touched by launch (`forge test`). |

---

## 2. Path to first devnet E2E (ordered workstreams)

### 2.1 Contracts & deploy

1. Resolve **devnet USDm** address from MegaETH artifacts (no informal mocks on devnet unless explicitly documented as test doubles).
2. **DOUB as launched token:** mint or transfer **`totalTokensForSale`** DOUB into `TimeCurve` before `startSale`. Today only [`Doubloon`](contracts/src/tokens/Doubloon.sol) `MINTER_ROLE` can mint — typically held by `RabbitTreasury`; launch deploy must either temporarily grant minter to a deploy script / multisig, or mint via an agreed bootstrap path. Record the chosen pattern in [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md).
3. Align **genesis DOUB allocation** (Section 4) with `totalTokensForSale` and any multisig-held seed for LP / Sir / Rabbit.
4. Deploy via [`contracts/script/DeployDev.s.sol`](contracts/script/DeployDev.s.sol) pattern (or a devnet-specific script) with **`USDM_ADDRESS` set**; record commit + addresses in a dev registry JSON (same idea as [`contracts/deployments/stage2-anvil-registry.json`](contracts/deployments/stage2-anvil-registry.json)).
5. Run **`forge test`** (full suite) before pointing humans at devnet.

### 2.2 Indexer

1. Fresh Postgres; migrations; `ADDRESS_REGISTRY_PATH` (or equivalent) for devnet addresses.
2. Smoke: buy, deposit, optional NFT — match [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md) §§3–5.

### 2.3 Frontend

1. Env: `VITE_*` for devnet chain id, RPC, contract addresses, indexer URL.
2. **TimeCurve:** wallet connect, read sale state, buy, post-sale charm redemption when applicable.
3. **Everything else:** single-purpose **“Under construction”** copy describing future **Rabbit Treasury**, **Leprechaun NFTs**, **Kumbaya v3 DOUB/USDM liquidity**, and **Sir** (perps-style DEX) — no fake trading UIs.

### 2.4 Local E2E before devnet (sanity)

- [`scripts/e2e-anvil.sh`](scripts/e2e-anvil.sh) / [`docs/testing/e2e-anvil.md`](docs/testing/e2e-anvil.md): Anvil + DeployDev + Playwright. **Not** a substitute for MegaETH devnet (gas model differs — see e2e-anvil doc).

---

## 3. Simulations & fuzzing (running “full TimeCurve” over time)

### 3.1 Python (offchain, not consensus)

From [`simulations/README.md`](simulations/README.md):

| Command | Role |
|---------|------|
| `python3 -m timecurve_sim --seeds N ...` | Monte Carlo sweep — concentration / Gini-style metrics; tune arrival and budgets. |
| `python3 -m timecurve_sim.duration_study` | Wall-clock sale duration distributions. |
| `python3 -m timecurve_sim.raise_milestone_report` | Raise milestones and sale-end timing. |
| `python3 -m timecurve_sim.raise_milestone_sim` | 30-day daily curves + JSON for charts. |

**Cadence:** run full sweep on **every release candidate** and **nightly** on `main` once stable; archive JSON under `simulations/output/` (gitignored) or CI artifacts. Compare against prior runs for regressions when changing timer, growth, or cap params.

**Unit tests:** `PYTHONPATH=. python3 -m unittest discover -s simulations/tests -v` (see root CI).

### 3.2 Foundry (onchain fuzz / invariants)

- TimeCurve: timer, caps, referral, fee splits — see [`contracts/test/TimeCurve.t.sol`](contracts/test/TimeCurve.t.sol), [`TimeCurveInvariant.t.sol`](contracts/test/TimeCurveInvariant.t.sol), etc.
- Rabbit + DOUB: [`RabbitTreasuryInvariant.t.sol`](contracts/test/RabbitTreasuryInvariant.t.sol).

**Bar:** `forge test` clean on the launch branch before devnet promotion.

---

## 4. DOUB supply: genesis allocation (canonical proposal)

This section fixes **how many DOUB are minted at launch** and **where they go**, separate from **per-buy fee routing** (Section 5). Numbers are a **starting proposal** for CL8Y / ops sign-off; change only via governance and doc updates.

### 4.1 Total supply

| Constant | Proposed value | Notes |
|----------|----------------|-------|
| **DOUB max supply (genesis mint)** | **1_000_000_000 DOUB** (1e9 × 1e18 wei) | Round; easy to reason in bps. If you prefer 21M or 10B, scale the table proportionally. |

### 4.2 Four-way genesis split (matches your buckets)

All percentages are **of total genesis mint**.

| Destination | Share | DOUB (whole tokens, 18-decimal ERC-20) | Purpose |
|-------------|-------|------------------------------------------|---------|
| **A — TimeCurve sale** | **45%** | **450_000_000** | Locked in `TimeCurve` as `totalTokensForSale`; redeemed via `redeemCharms` pro-rata to charm weight after `endSale`. |
| **B — Rabbit Treasury (Burrow)** | **15%** | **150_000_000** | **Treasury-controlled DOUB** for Burrow incentives, bootstrap liquidity with USDm reserves, or slow-release programs — **not** the same as player DOUB minted 1:1 on deposit (that remains `RabbitTreasury` mint rules). Exact use is ops/governance. |
| **C — Kumbaya v3 LP (DOUB / USDm)** | **25%** | **250_000_000** | Seed **Uniswap v3** (or MegaETH-native concentrated liquidity) **DOUB/USDm** pool + **ongoing LP incentive compatibility** with [`DoubLPIncentives`](contracts/src/sinks/DoubLPIncentives.sol). Pair with matching **USDm** from treasury or raise proceeds per pool strategy. |
| **D — Sir (perps-style DEX)** | **15%** | **150_000_000** | Insurance fund, liquidity / maker incentives, and bootstrap for the **Sir** derivatives venue — **off-chain or future contracts** until that product ships; hold in **multisig / vesting** so it cannot be confused with TimeCurve or Burrow balances. |

**Checksum:** 45 + 15 + 25 + 15 = **100%**.

### 4.3 Wiring constraints

- **A** must equal `TimeCurve.totalTokensForSale` at deploy (or the sale cap is wrong).
- **B / C / D** are minted to named addresses (treasury, LP manager, Sir multisig) in the same tx tree as supply cap establishment, with **events** and **indexer** visibility.
- If **B** is 0 by policy (all Burrow DOUB only from deposits), shift **15%** to **C** or **D** and document.

---

## 5. Fee routing vs genesis (do not conflate)

| Mechanism | What moves | Canonical split |
|-----------|------------|-----------------|
| **Genesis mint** | One-time DOUB allocation | Section 4 |
| **TimeCurve buys** | **Accepted asset** (USDm) into `FeeRouter`, then to sinks | **30%** DoubLPIncentives · **20%** RabbitTreasury · **35%** Prizes · **15%** CL8Y — [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md) |

**Note:** `FeeRouter.distributeFees` splits **whatever ERC-20** TimeCurve sends (today USDm). The **30% “DOUB LP”** row is a **policy name** for the LP incentive sink; routing **USDm** there is still valid (buy DOUB off market, seed pool, or operate incentives). If governance routes **prizes** in DOUB, that requires swap / mint policy — see fee doc “team preference” for prizes in DOUB.

---

## 6. Under construction (frontend)

Routes **`/rabbit-treasury`**, **`/collection`**, **`/referrals`** use the **Under construction** banner ([`frontend/src/pages/UnderConstruction.tsx`](frontend/src/pages/UnderConstruction.tsx)). **`/kumbaya`** and **`/sir`** are **third-party DEXes**: disclaimer, **placeholder LP** readout (real values later), and an outbound link when **`VITE_KUMBAYA_DEX_URL`** / **`VITE_SIR_DEX_URL`** is set at build time ([`frontend/src/components/ThirdPartyDexPage.tsx`](frontend/src/components/ThirdPartyDexPage.tsx)). **`/`** and **`/timecurve`** carry the live launch UX.

---

## 7. Exit checklist (devnet E2E)

- [ ] USDm + DOUB addresses published for devnet.
- [ ] `totalTokensForSale` + genesis split match Section 4 (or updated signed table).
- [ ] `forge test` + simulation sweep green.
- [ ] Indexer smoke + optional frontend buy on devnet.
- [ ] Non-TimeCurve routes: Rabbit / Collection / Referrals under construction; Kumbaya / Sir show third-party LP placeholder + DEX links when configured.

---

## 8. References

| Doc | Topic |
|-----|--------|
| [`docs/product/primitives.md`](docs/product/primitives.md) | TimeCurve mechanics |
| [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md) | Fee sinks |
| [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md) | Deploy parameters |
| [`docs/testing/strategy.md`](docs/testing/strategy.md) | Stages 1–3 |
| [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md) | Recorded smoke |

**Agent phase:** align with [`docs/agent-phases.md`](docs/agent-phases.md) and contributor guardrails in [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md).
