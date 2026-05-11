# Internal Full-Stack Security Audit

Audit file: `audits/audit_full_security_20260511.md`  
Date: 2026-05-11  
Reviewer: Cursor agent, internal review  
Commit reviewed: `5ad24bac78c9c7c6d2e8c5d7981c6f18d032a850`  
Working tree at start of report write: clean  

**Scope:** Smart contracts (`contracts/src`), Rust indexer (`indexer/`), Vite frontend (`frontend/`), cross-layer trust boundaries, historical exploit parallels, Yieldomega-specific game and routing surfaces, and **test coverage vs attack vectors**.  

**Trust assumption (per maintainer):** Governance/admin/UUPS upgrade authority is **trusted**. This report does **not** treat intended privileged power as a vulnerability by itself. It still flags **implementation bugs**, **misconfiguration hazards**, **user-harm via UX/offchain layers**, and **economic/game vectors** that do not require compromising governance keys.

---

## Executive Summary

No **Critical** unprivileged path was identified that would let an arbitrary attacker **drain core protocol custody** (TimeCurve CL8Y reserve paths, FeeRouter splits governed by allowlist, RabbitTreasury backing math as implemented, vesting collateral, or buy-router CL8Y to TimeCurve) under standard **non-rebasing ERC20** assumptions and correct deployment configuration.

The system has **material onchain hardening** aligned with prior internal audits and GitLab-tracked invariants: ERC20 **balance-delta ingress** parity on sensitive pulls, **TimeCurveBuyRouter** sale-phase fail-fast, **snapshot-based** ETH/stable refunds (no pre-seeded router subsidy), **post-end gates** (#55), **empty PodiumPool** settlement semantics (#133), **per-category residual forwarding** when podiums are empty/partial (#116), WarBow **burn-sink caller** guards (#123), and **AccessControl zero-admin** rejection at deploy (#120).

**Highest residual risks** are cross-layer and operational:

1. **Offchain deception** — Malicious or misconfigured **RPC**, **indexer**, or **static frontend host** can mislead timing, leaderboards, and operator hints without moving chain state; users who trust the UI alone may **mis-time** buys, WarBow actions, or governance ops.
2. **Fee routing vs Rabbit accounting** — If `FeeRouter` sink #5 is the **RabbitTreasury proxy** itself, CL8Y can arrive **without** `receiveFee` booking (documented eco-strategy risk); metrics and Burrow events diverge from user narrative.
3. **Default gas-estimate fallback** — `writeContractWithGasBuffer` can submit without a buffered `gas` override when public `estimateContractGas` fails, shifting burden to the **wallet estimator** (blind-signing class risk for affected call sites).
4. **Accepted onchain game economics** — MEV, same-block ordering, referral **front-running**, **sybil packs**, and WarBow **predation** are inherent to the design; tests and docs mitigate misunderstanding more than “blocking” the behavior.

**Automated verification run for this report**

| Suite | Command | Result |
|--------|---------|--------|
| Contracts | `cd contracts && FOUNDRY_PROFILE=ci FOUNDRY_OUT=/tmp/yo-f-full FOUNDRY_CACHE_PATH=/tmp/yo-fc-full forge test` | **317 passed**, 0 failed |
| Indexer | `cd indexer && cargo test` | **40** crate unit tests + **3** `integration_stage2` Postgres tests passed |
| Frontend | `cd frontend && npm test -- --run` | **316** Vitest tests passed |

`cargo clippy -D warnings` was **not** re-run for this report; CI is expected to enforce it per `docs/testing/strategy.md`.

---

## Methodology: Historical Incidents And Checklist Mapping

Each layer below lists **representative industry failures** (not exhaustive) and how they map to **concrete questions** asked of this repo.

### Smart contracts

| Incident class | Example | Mapped checks in this repo |
|----------------|---------|------------------------------|
| Reentrancy / unexpected external call ordering | Curve/Vyper-style pools (2023) | `nonReentrant` on buys, WarBow, redeem, vesting claim, buy router; CEI around swap → `buyFor` → approvals |
| Accounting invariant / donation-style breaks | Euler (2023) | `totalRaised` vs measured CL8Y ingress; Rabbit backing vs `totalReserves`; fee splits; prize slices vs `PodiumPool` drain |
| Rounding / tick or state-machine desync | KyberSwap Elastic (2023) | WAD mulDiv in pricing; podium share floors; redemption integer division |
| Oracle / price manipulation | Various lending protocols | Mostly N/A: core sale pricing is onchain curve; Kumbaya leg is AMM MEV surface not a single-oracle read |
| Non-standard ERC20 | Fee-on-transfer, rebasing | `#123` parity reverts in TimeCurve, ReferralRegistry, Rabbit ingress, buy-router stable pull |
| Approval / spender blast radius | Token approval drainer patterns | Contracts avoid pulling arbitrary allowances except user `msg.sender` paths; **frontend** unlimited CL8Y opt-in documented |

### Indexer and data layer

| Incident class | Example | Mapped checks in this repo |
|----------------|---------|------------------------------|
| Stale or wrong RPC / indexer truth | Kelp-style RPC trust, Polymarket/Goldsky outage narratives | `chain_timer` snapshot, `/v1/status` liveness, ingestion timeouts (#168), production registry fail-closed (#156) |
| Reorg beyond assumptions | “Indexer lying” writeups | `MAX_REORG_DEPTH` 128 + manual reindex path; `rollback_after` table list |
| Decoder drift / partial ingest | Schema mismatch | Transactional per-block ingest (#140); integration tests |
| API abuse / disclosure | Rate limits, error bodies | `clamp_limit`, `PUBLIC_INTERNAL_DB_ERROR` (#157), address validation on sensitive routes |

### Frontend and wallet

| Incident class | Example | Mapped checks in this repo |
|----------------|---------|------------------------------|
| Malicious approvals / injected spender | BadgerDAO (2021) | Exact approvals by default; unlimited CL8Y opt-in with disclosure (#143) |
| DNS / domain hijack | Balancer (2023) | Out of repo — recommend hosting controls + user education |
| Supply-chain npm compromise | Ledger Connect Kit (2023) | Lockfiles, CI pinning; no runtime fix in app code alone |
| Wallet/account drift mid-flow | UX TOCTOU | `walletBuySessionGuard` on buys (#144) and referral register (#155) |
| Blind signing / failed simulation | Various wallet drainer flows | `writeContractWithGasBuffer` default `onEstimateRevert: "submit-without-override"` |

---

## Assumptions And Trust Boundaries

### Trusted

- Governance multisig/EOAs holding `DEFAULT_ADMIN_ROLE`, `GOVERNOR_ROLE`, UUPS upgrade rights, TimeCurve owner gates, and deploy scripts operating in good faith.
- Canonical **ERC1967 proxy** addresses in registry and frontend env (not implementation rows from `run-latest.json`).
- Kumbaya router/quoter addresses match integrator expectations for the target chain.
- CL8Y and other configured assets are **standard non-rebasing** ERC20s at launch.

### Untrusted / adversarial

- Other users competing in TimeCurve/WarBow (MEV, ordering, sybil wallets).
- Public mempool observers for referral code registration.
- RPC providers, indexer hosts, CDN/DNS, npm supply chain, and browser extensions.
- Any party who can convince a user to load a **wrong** frontend or approve a **wrong** spender.

---

## Review Checklist

### Smart contracts (sampled end-to-end)

- `contracts/src/TimeCurve.sol` — buys, referral/presale weight, WarBow, flags, sale end, redemption, prizes, unredeemed sweep, gates.
- `contracts/src/TimeCurveBuyRouter.sol` — Kumbaya path, refunds, rescue.
- `contracts/src/FeeRouter.sol` — allowlist, `distributeFees`, rescue.
- `contracts/src/RabbitTreasury.sol` — deposit/withdraw/fee/epoch math.
- `contracts/src/ReferralRegistry.sol`, `contracts/src/vesting/DoubPresaleVesting.sol`, `contracts/src/tokens/Doubloon.sol`, sinks, pricing, math libs, NFT.

### Indexer

- `indexer/src/ingestion.rs`, `reorg.rs`, `decoder.rs`, `persist.rs`, `api.rs`, `config.rs`, `cors_config.rs`, `rpc_http.rs`, `chain_timer.rs`, migrations vs `rollback_after`.

### Frontend

- `frontend/src/pages/timecurve/useTimeCurveSaleSession.ts`, Arena model, Kumbaya libs, `walletBuySessionGuard.ts`, `chainMismatchWriteGuard.ts`, referral register, vesting, `indexerApi.ts`, `addresses.ts`, `wagmi-config.ts`, `writeContractWithGasBuffer.ts`.

### Configuration and docs

- `docs/onchain/security-and-threat-model.md`, `docs/testing/invariants-and-business-logic.md`, `docs/onchain/fee-routing-and-governance.md`, prior audits under `audits/`.

---

## Yieldomega-Specific Attack Vectors

These are **not all vulnerabilities**; many are **by-design game mechanics** or **accepted DeFi realities**. They are listed so tests and disclosures stay aligned.

| Vector | Description | Layer | Typical mitigation |
|--------|-------------|-------|---------------------|
| Last-buy / timer MEV | Same-block ordering decides extensions and last-buy podiums | Onchain + UX | Document; optional private bundles; no pure code “fix” |
| 300-day wall + inclusive `deadline` | Hard cap vs round timer edge semantics | Contracts + UI | Invariants; `timeCurveSimplePhase` / hero timer |
| WarBow steal/revenge/guard | Ordering, daily caps, 2× rule, guard discount, per-stealer revenge slots | Onchain | Extensive Forge coverage; Arena/indexer refresh |
| WarBow ends with sale | `warbowSteal` / `revenge` / `guard` require `!ended` | Contracts | Align any prose docs with bytecode |
| Referral `registerCode` front-run | Plaintext code; first inclusion wins | Onchain product | Disclosure (#121); optional commit-reveal if policy changes |
| Referral + presale CHARM weight | Unpaid weight dilutes redemption density vs no-bonus path | Economics | Product docs; UI separation of “paid CHARM” vs bonuses |
| Kumbaya `exactOutput` sandwich | Classic AMM MEV on input leg | Onchain market | Slippage caps; user RPC choice |
| Buy-router path validation | Packed path must match CL8Y terminal and pay token | Contracts | `_validatePath` + tests |
| Indexer-anchored hero timer | Phase UX prefers indexer clock when configured | Frontend + indexer | Offline/stale UX (#96); chain timer 503 paths |
| `refresh-candidates` | Operator superset, not consensus | Indexer + protocol UI | Pagination guard (#174); compare to onchain BP before finalize |
| Rabbit fee sink direct transfer | FeeRouter `safeTransfer` bypasses `receiveFee` if sink is Rabbit proxy | Ops + contracts | Adapter or explicit deployment policy |
| Launch-anchor / CL8Y-at-launch copy | UX projection vs onchain redemption mechanics | Frontend | `timeCurvePodiumMath`, issue #90 / #158 docs |

---

## Severity Findings

### Critical

_No Critical findings for unprivileged fund extraction from core protocol contracts under the stated assumptions._

---

### High

_No new High-severity **unprivileged smart contract** vulnerabilities identified in this pass beyond governance trust._

**H-note (governance / ops misconfiguration — not a code bug):** If production configures `FeeRouter` sink #5 as the **RabbitTreasury** contract address, routed CL8Y increases **token balance** without flowing through `RabbitTreasury.receiveFee`, so Burrow accounting and health events may **not** reflect the advertised 10% support. See prior eco-strategy audit and `docs/onchain/fee-routing-and-governance.md`. **Mitigation:** use a small adapter sink, route via `receiveFee`, or document explicit reconciliation. **Severity if governance is compromised or mistaken:** High impact on **truthfulness of metrics**; not an arbitrary-user drain.

---

### Medium

#### M-01: Gas estimation failure falls through to wallet default gas (`writeContractWithGasBuffer`)

**Affected code**

- `frontend/src/lib/writeContractWithGasBuffer.ts` — default `onEstimateRevert: "submit-without-override"`.

**Issue**

When public `estimateContractGas` fails (RPC flake, transient revert, or malicious RPC), the helper may still call `writeContractAsync` **without** a buffered `gas` override. Wallets then use their own estimator. That is standard but matches a **blind-signing** risk class if the wallet’s estimator is weak or the user confirms without simulation.

**Recommendation**

- Audit each value-moving call site: prefer `"rethrow"` for first-time user flows or gate submission behind an explicit user acknowledgment when estimate fails.
- Optionally add per-flow `softCapGas` where safe.

**Test gap**

- Vitest covers helper branches; **no E2E** asserting wallet behavior across failing RPC estimate (not practical without wallet harness).

---

#### M-02: Non-production indexer registry / chain mismatch can warn instead of failing closed

**Affected code**

- `indexer/src/config.rs` (production-only strict checks per `INDEXER_PRODUCTION=1`).

**Issue**

In dev/staging, a wrong `CHAIN_ID` vs `ADDRESS_REGISTRY` can yield a **partial or wrong-chain read model** while the stack still runs. That is acceptable for local iteration but can cause **false confidence** if the same binary is pointed at shared staging without production flags.

**Recommendation**

- Runbook: always enable production-equivalent validation for any URL reachable by non-developers.
- Optional: stricter “staging” profile distinct from `INDEXER_PRODUCTION`.

**Tests**

- Integration tests cover transactional ingest and rollback; **not** every misconfiguration permutation.

---

### Low

#### L-01: Deep reorgs beyond `MAX_REORG_DEPTH` require manual reindex

**Affected code**

- `indexer/src/reorg.rs` — `MAX_REORG_DEPTH = 128`.

**Impact**

Availability / consistency: indexer bails with an error path requiring operator intervention. Fast chains make deep reorgs unlikely but non-zero.

**Mitigation**

Monitoring on ingestion errors; documented operator recovery.

---

#### L-02: Referral code squatting / mempool front-running remains a product tradeoff

**Affected code**

- `contracts/src/ReferralRegistry.sol` — `registerCode`.

**Impact**

Griefing or squatting on desirable codes; no protocol reserve drain.

**Mitigation**

Disclosure (#121); optional commit-reveal or private tx if policy changes later.

**Tests**

- Product + UX tests; mempool races not deterministic in Forge.

---

#### L-03: `warbowRevenge` requires live sale (`!ended`) — verify docs match bytecode

**Affected code**

- `contracts/src/TimeCurve.sol` — `warbowRevenge` uses `require(saleStart > 0 && !ended, ...)`.

**Impact**

If any external doc still describes post-end revenge, operators could be misled. Not a fund bug.

**Mitigation**

Doc sweep for consistency with deployed behavior.

---

### Informational

#### I-01: Leprechaun NFT mutable `baseURI`

Governance can change offchain JSON behind `tokenURI` while onchain traits remain authoritative. Documented in threat model / product docs.

#### I-02: Indexer and `GET /v1/status` expose operational metadata

Useful for ops; could aid reconnaissance. Acceptable for a public indexer; restrict via network policy if needed.

#### I-03: MegaEVM bytecode and gas semantics differ from vanilla Anvil

See `docs/contracts/foundry-and-megaeth.md` and guardrails. Testnet soak remains important.

---

## Prior Internal Audits — Regression Status

| Prior item (see `audits/audit_smartcontract_1777813071.md` and `audits/audit_full_1777967937.md`) | Status on `5ad24ba` |
|----------------------------------|----------------------|
| Buy-router pre-seeded WETH/stable refunds (old M-02) | **Addressed** — snapshot refunds + rescue (#117); tests in `TimeCurveBuyRouter.t.sol` |
| Buy-router future sale gas waste (old L-01) | **Addressed** — `block.timestamp < saleStart` fail-fast (#118) |
| `distributePrizes` stranded category slices (old M-01) | **Addressed** — `_forwardCategoryPrizes` + residual recipient (#116); empty pool path (#133) |
| Referral register wallet drift (full audit M-01) | **Addressed** — `captureWalletBuySession` / `assertWalletBuySessionUnchanged` in `ReferralRegisterSection.tsx` (#155) |
| Public API echoing raw DB errors | **Addressed** — `PUBLIC_INTERNAL_DB_ERROR` + tests in `api.rs` (#157) |
| AccessControl zero admin at deploy | **Addressed** — `AccessControlZeroAdmin.t.sol` + contract requires (#120) |
| Rabbit sink direct transfer accounting (eco H-01) | **Operational / design** — still relevant if misconfigured |

---

## Test Coverage Vs Attack Vectors

Legend: **C** covered, **P** partial, **N** not covered by automated tests, **X** not practical to fully automate.

### Smart contracts

| Attack vector | Coverage | Notes / gaps |
|---------------|----------|--------------|
| Reentrancy on user paths | **C** | `nonReentrant` + external call ordering reviewed; Forge suite |
| ERC20 fee-on-transfer / always-revert / blocked sink | **C** | `NonStandardERC20.t.sol`, fee router / sinks tests |
| Rebasing reserve desync | **P** | Documented as discouraged; `MockERC20Rebasing` highlights desync risk |
| WarBow CL8Y burn + burn-sink caller | **C** | `TimeCurveWarBowCl8yBurns.t.sol` |
| Timer / deadline / max sale elapsed | **C** | `TimeCurve.t.sol`, `TimeMath.t.sol`, invariants |
| Prize distribution / empty pool / residual | **C** | `TimeCurve.t.sol` scenarios per #116/#133 |
| Kumbaya router path + stable ingress + refunds | **C** | `TimeCurveBuyRouter.t.sol` |
| Rabbit treasury invariants | **C** | `RabbitTreasuryInvariant.t.sol`, `RabbitTreasury.t.sol` |
| FeeRouter invariants | **C** | `FeeRouterInvariant.t.sol`, `FeeRouter.t.sol` |
| Fork / mainnet RPC smoke | **N** | `TimeCurveFork.t.sol` optional behind `FORK_URL` |
| MegaEVM gas dimension stress | **X** | Requires target RPC + soak |
| Same-block multi-tx ordering / MEV | **P** | Some Forge ordering tests; full builder behavior **X** |

### Indexer

| Attack vector | Coverage | Notes / gaps |
|---------------|----------|--------------|
| Per-block all-or-nothing ingest | **C** | `integration_stage2.rs` GitLab #140 / #146 |
| Reorg rollback deletes all `idx_*` | **C** | `postgres_stage2_persist_all_events_and_rollback_after` |
| Referrer leaderboard SQL shape | **P** | Dense-rank test (#177); malicious **RPC** feeding bad logs **X** |
| API address validation | **P** | WarBow / wallet routes; audit any new routes for parity |
| Malicious RPC for `chain_timer` | **N** | Trust model; mitigate with TLS + trusted providers + client-side RPC cross-check for critical ops |

### Frontend

| Attack vector | Coverage | Notes / gaps |
|---------------|----------|--------------|
| Wrong-chain write barrier | **C** | `chainMismatchWriteGuard.test.ts`, related components |
| Wallet session drift (buy + referral) | **C** | `walletBuySessionGuard.test.ts`, `referralRegisterWalletSession.test.ts` |
| CHARM submit sizing slack | **C** | `timeCurveBuySubmitSizing.test.ts` |
| Kumbaya router env vs onchain | **P** | Route resolution tests; full single-tx swap **N** without Anvil Kumbaya stack |
| Indexer offline / JSON parse | **P** | `indexerApi.test.ts`, connectivity hooks; browser MITM **X** |
| Unlimited CL8Y approval disclosure | **C** | `cl8yTimeCurveApprovalPreference.test.ts` |
| Phishing / DNS / npm supply chain | **X** | Policy + monitoring, not Vitest |
| EIP-7702 delegated account phishing | **X** | Wallet ecosystem risk; document user guidance |

### Recommended new tests (backlog)

1. **Fork or scripted multi-tx same-block** buys and WarBow actions with asserted log ordering when `FORK_URL` is available in CI (optional job).
2. **Frontend integration** (Playwright + `e2e-anvil.sh`): assert `onEstimateRevert: "rethrow"` paths if adopted for any high-value write.
3. **Indexer**: optional test that `rollback_after` table list matches **union of all migration-created `idx_%` tables** (static codegen or snapshot test) to prevent future migration drift.
4. **Docs test**: link check or codegen ensuring `docs/product/primitives.md` WarBow post-end language matches `TimeCurve.sol`.

---

## Positive Observations

- Strong alignment between **docs/testing/invariants-and-business-logic.md** and regression tests for high-churn areas (Kumbaya router, WarBow, referral indexer rows, buy session guards).
- `TimeCurve.distributePrizes` now encodes explicit **economic destination** for otherwise stranded category slices via **residual forwarding**, addressing a historically serious operational trap.
- Indexer **500** responses avoid echoing raw SQL/driver strings.

---

## Recommended Next Steps

1. External audit + bug bounty before mainnet value-at-risk.
2. Decide and document **RabbitTreasury** fee path: adapter vs direct transfer vs explicit offchain reconciliation.
3. Review `writeContractWithGasBuffer` call sites for estimate-failure behavior on **irreversible** flows.
4. Add optional CI jobs: `FORK_URL` smoke, indexer migration vs `rollback_after` drift guard.
5. Continue treating **indexer + RPC** as untrusted for any irreversible human decision without onchain confirmation.

---

**Agent phase reference:** `docs/agent-phases.md` Phase 10 — Security and threat model.
