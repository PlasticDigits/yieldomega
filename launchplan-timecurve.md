# TimeCurve — Doubloon (DOUB) launch plan

**Goal:** Get from the current repo state to **first MegaETH devnet end-to-end**: official **CL8Y** as the **reserve / accepted asset**, DOUB as the **launched token** on TimeCurve, full sale lifecycle, **continuous simulations**, and **contract fuzzing** — with most **non–TimeCurve** product surfaces treated as **under construction** in the frontend (short placeholder copy only). **`/referrals`** is explicitly **not** under construction — it ships the full referrals UX at TGE ([§6](#6-under-construction-frontend), [GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)).

**Authoritative policy elsewhere:** Runtime fee **weights** (**30%** LP · **40%** CL8Y burned · **20%** podium · **0%** team · **10%** Rabbit) and governance intent are in [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md). Parameter checklist: [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md). Stage 2 smoke criteria: [`docs/testing/strategy.md`](docs/testing/strategy.md) and [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md).

---

## 1. Launch scope (what “done” means for devnet v1)

| Milestone | Definition |
|-----------|------------|
| **Contracts** | `TimeCurve.launchedToken` = **DOUB**; `totalTokensForSale` + DOUB pre-positioned on `TimeCurve`; `acceptedAsset` = **official devnet CL8Y**; `FeeRouter` + sinks wired per canonical bps; `RabbitTreasury` + `Doubloon` roles correct. |
| **Indexer** | Ingests devnet from empty DB; smoke txs visible; lag acceptable per runbook. |
| **Frontend** | **TimeCurve** path is the real launch UX. **`/referrals`** ships the **full** referrals registration + share-link surface at TGE ([`docs/product/referrals.md`](docs/product/referrals.md), [GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)), not an **`UnderConstruction`** stub ([GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)). Other non–TimeCurve routes: **Rabbit Treasury**, **NFT collection**, and **“Kumbaya” / “Sir”** pages show **under construction** messaging (what the feature will be), not full flows — unless explicitly pulled into this milestone. |
| **Simulations** | TimeCurve Monte Carlo + duration / raise studies run on a schedule (CI nightly or tagged releases) with saved JSON artifacts for regression comparison. |
| **Fuzzing** | Foundry invariant / fuzz suites green for TimeCurve + treasury paths touched by launch (`forge test`). |

---

## 2. Path to first devnet E2E (ordered workstreams)

### 2.1 Contracts & deploy

1. Resolve **devnet CL8Y** address from official artifacts (no informal mocks on devnet unless explicitly documented as test doubles).
2. **DOUB as launched token:** mint or transfer **`totalTokensForSale`** DOUB into **`TimeCurve`** before the **`TimeCurve`** owner calls **`startSaleAt(epoch)`** ([GitLab #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114); **`DeployDev`** uses **`startSaleAt(block.timestamp)`** after funding for local parity). Today only [`Doubloon`](contracts/src/tokens/Doubloon.sol) `MINTER_ROLE` can mint — typically held by `RabbitTreasury`; launch deploy must either temporarily grant minter to a deploy script / multisig, or mint via an agreed bootstrap path. Record the chosen pattern in [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md).
3. Align **genesis DOUB allocation** (Section 4) with `totalTokensForSale` and any multisig-held seed for LP / Sir / Rabbit.
4. Deploy via [`contracts/script/DeployDev.s.sol`](contracts/script/DeployDev.s.sol) pattern (or a devnet-specific script) with **`RESERVE_ASSET_ADDRESS` set** (or legacy `USDM_ADDRESS` for the same role); record commit + addresses in a dev registry JSON (same idea as [`contracts/deployments/stage2-anvil-registry.json`](contracts/deployments/stage2-anvil-registry.json)).
5. Run **`forge test`** (full suite) before pointing humans at devnet.

### 2.2 Indexer

1. Fresh Postgres; migrations; `ADDRESS_REGISTRY_PATH` (or equivalent) for devnet addresses.
2. Smoke: buy, deposit, optional NFT — match [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md) §§3–5.

### 2.3 Frontend

1. Env: `VITE_*` for devnet chain id, RPC, contract addresses, indexer URL.
2. **TimeCurve:** wallet connect, read sale state, buy, post-sale charm redemption when applicable.
3. **Non-TimeCurve placeholders (excluding referrals):** single-purpose **“Under construction”** copy describing future **Rabbit Treasury**, **Leprechaun NFTs** ( **`/collection`** ), **Kumbaya v3 DOUB/CL8Y liquidity**, and **Sir** (perps-style DEX) — no fake trading UIs. **`/referrals`** is **out of scope here** — it ships the real [`ReferralsPage`](frontend/src/pages/ReferralsPage.tsx) UX ([GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)).

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

## 4. DOUB supply: genesis allocation (canonical — 250M)

This section fixes **how many DOUB are minted at launch** and **where they go**, separate from **per-buy fee routing** (Section 5). Numbers are for CL8Y / ops sign-off; change only via governance and doc updates.

### 4.1 Total supply

| Constant | Value | Notes |
|----------|-------|-------|
| **DOUB genesis mint (policy)** | **250_000_000 DOUB** | `totalTokensForSale` on TimeCurve is **200M** of this; remainder is presale + V3 LP per below. |

### 4.2 Allocation

| Destination | DOUB (whole tokens) | Purpose |
|-------------|---------------------|---------|
| **TimeCurve sale** | **200_000_000** | `TimeCurve.totalTokensForSale`; `redeemCharms` pro-rata after `endSale`. |
| **Presale** | **21_500_000** | **30%** at `startVesting` · **70%** linear (default **180 days** in [`DoubPresaleVesting`](contracts/src/vesting/DoubPresaleVesting.sol), configurable duration) — fund contract, then owner `startVesting()`; document beneficiary addresses at deploy. |
| **V3 liquidity seed** | **28_500_000** | **DOUB/CL8Y** pool seeding aligned with [`DoubLPIncentives`](contracts/src/sinks/DoubLPIncentives.sol) / Kumbaya strategy. |

**Checksum:** 200 + 21.5 + 28.5 = **250M** whole tokens.

### 4.3 Wiring constraints

- TimeCurve **`totalTokensForSale`** must equal **200M** (in wei) at deploy when following this table.
- Presale and LP buckets need explicit recipient contracts or multisigs with **events** and **indexer** visibility.
- **Sir** / other product lines are **not** in this 250M table; fund separately if needed.

### 4.4 Final signoff before user-facing DOUB / CL8Y movement

Genesis wiring (Section 4) is not the same as **operational go-live** for **claims, redemption, and prize payouts**: see [`docs/operations/pause-and-final-signoff.md`](docs/operations/pause-and-final-signoff.md) ([GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)) for gated surfaces (`DoubPresaleVesting.claim`, `TimeCurve.redeemCharms`, `distributePrizes`, optional `buy` / fee routing) and a suggested mainnet order of operations. Update that doc + [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md) when onchain flags or timelock IDs are fixed.

---

## 5. Fee routing vs genesis (do not conflate)

| Mechanism | What moves | Canonical split |
|-----------|------------|-----------------|
| **Genesis mint** | One-time DOUB allocation | Section 4 |
| **TimeCurve buys** | **Accepted asset** (**CL8Y**) into `FeeRouter`, then to sinks | **30%** DoubLPIncentives · **40%** burned (`0x…dEaD` or governance burn sink) · **20%** PodiumPool · **0%** Team (`EcosystemTreasury` in dev) · **10%** RabbitTreasury — [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md) |

**Note:** `FeeRouter.distributeFees` splits **whatever ERC-20** TimeCurve sends (**CL8Y** at launch). The sale is already in CL8Y — the **40%** slice is **burned**, not marketed as a separate “buy-and-burn” step. **Referral** incentives are **CHARM weight**; the **full gross** still routes through the fee router. **DOUB/CL8Y LP** targets SIR / Kumbaya seeding (see fee doc for **1.275×** launch anchor and **0.8×–∞** Kumbaya band). **`TimeCurve.distributePrizes`** pays the **podium pool** in reserve across **four** categories — **last buy**, **WarBow**, **defended streak**, **time booster** ([`docs/product/primitives.md`](docs/product/primitives.md)). **DOUB** is for **`redeemCharms`** (sale allocation), not podium payouts.

---

## 6. Under construction (frontend)

**F-11 (launch UX flows):** At TGE, **`/rabbit-treasury`** and **`/collection`** use the **Under construction** banner ([`frontend/src/pages/UnderConstruction.tsx`](frontend/src/pages/UnderConstruction.tsx)). **`/referrals`** does **not** — it renders the full referrals product page ([`ReferralsPage`](frontend/src/pages/ReferralsPage.tsx), [`ReferralRegisterSection`](frontend/src/pages/referrals/ReferralRegisterSection.tsx)) with live registry reads, register + burn, and share links; this matches ongoing verification under [GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64). Spec/reality drift is resolved in [GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91).

**Thin alias:** [YO-DOUB-Launch-UX-Flows.md](YO-DOUB-Launch-UX-Flows.md) documents the same **F-11** row for readers searching the legacy filename.

**Third-party surfaces:** **`/kumbaya`** and **`/sir`** are **third-party DEXes**: disclaimer, **placeholder LP** readout (real values later), and an outbound link when **`VITE_KUMBAYA_DEX_URL`** / **`VITE_SIR_DEX_URL`** is set at build time ([`frontend/src/components/ThirdPartyDexPage.tsx`](frontend/src/components/ThirdPartyDexPage.tsx)). **`/`** and **`/timecurve`** carry the live TimeCurve launch UX.

**Presale vesting (F-10 / GitLab #92):** **`/vesting`** surfaces **`DoubPresaleVesting`** reads + **`claim`** for presale beneficiaries. The route is **omitted from the global header nav** (direct URL / share only — [issue #92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)). Local **`DeployDev`** deploys a dev vesting and stack scripts set **`VITE_DOUB_PRESALE_VESTING_ADDRESS`**. See [`docs/frontend/presale-vesting.md`](docs/frontend/presale-vesting.md).

---

## 7. Exit checklist (devnet E2E)

- [ ] CL8Y + DOUB addresses published for devnet.
- [ ] `totalTokensForSale` + genesis split match Section 4 (or updated signed table).
- [ ] `forge test` + simulation sweep green.
- [ ] Indexer smoke + optional frontend buy on devnet.
- [ ] Non-TimeCurve routes: Rabbit / Collection **under construction**; **`/referrals` full surface** ([`docs/product/referrals.md`](docs/product/referrals.md), [#64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64), [#91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)); **`/vesting`** presale vesting (**`DoubPresaleVesting`**, hidden nav — [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)); Kumbaya / Sir show third-party LP placeholder + DEX links when configured.

---

## 8. References

| Doc | Topic |
|-----|--------|
| [`YO-DOUB-Launch-UX-Flows.md`](YO-DOUB-Launch-UX-Flows.md) | **F-11** launch UX row (under construction vs **`/referrals`** shipped) — thin alias for legacy checklists; canonical: **§6** in this file ([GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)) |
| [`docs/product/primitives.md`](docs/product/primitives.md) | TimeCurve mechanics |
| [`docs/product/referrals.md`](docs/product/referrals.md) | Referrals mechanics + **`/referrals`** full surface ([GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)) |
| [`docs/onchain/fee-routing-and-governance.md`](docs/onchain/fee-routing-and-governance.md) | Fee sinks |
| [`contracts/PARAMETERS.md`](contracts/PARAMETERS.md) | Deploy parameters |
| [`docs/testing/strategy.md`](docs/testing/strategy.md) | Stages 1–3 |
| [`docs/operations/stage2-run-log.md`](docs/operations/stage2-run-log.md) | Recorded smoke |
| [`docs/operations/pause-and-final-signoff.md`](docs/operations/pause-and-final-signoff.md) | Pause/signoff before DOUB claims and CL8Y distribution (design inventory, [#55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)) |

**Agent phase:** align with [`docs/agent-phases.md`](docs/agent-phases.md) and contributor guardrails in [`.cursor/skills/yieldomega-guardrails/SKILL.md`](.cursor/skills/yieldomega-guardrails/SKILL.md).
