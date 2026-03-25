# Agent phases and copy-paste prompts

This file is the **implementation roadmap for AI agents** (and humans driving agents). Each **phase** corresponds to one clean documentation section. Complete phases **in order** when bootstrapping from zero; otherwise jump to the phase that matches your task.

**Rules for every phase**

- Default license for new repo code: **AGPL-3.0**; respect [licensing.md](licensing.md).
- **Game rules and fund flows** stay **onchain**; indexer and frontend are read models and UX.
- Before writing code, re-read the linked doc and [glossary.md](glossary.md).
- After substantive work, align with [testing/strategy.md](testing/strategy.md) (unit → devnet integration → testnet → deployment).

**Two tracks (do not confuse them)**

- **Build / fork the repo** — Phases **1–19** plus [`.cursor/skills`](../.cursor/skills/README.md) **guardrails**: licensing, architecture, tests, small diffs. This is for contributors shipping code, docs, and infra.
- **Play / participate in the ecosystem** — [Phase 20 — Play the ecosystem](#phase-20) plus the root [`skills/`](../skills/README.md) **play skills**: how to read onchain rules, operate as an agent alongside a human, and enjoy **TimeCurve**, **Rabbit Treasury / DOUB**, and **Leprechaun** collections. These skills matter for agents (and humans) who want to **use** the system, not only mirror or modify the repository.

---

<a id="phase-1"></a>

## Phase 1 — Glossary and shared vocabulary

**Doc:** [glossary.md](glossary.md)

**Goal:** Align all subsequent work with shared definitions (CL8Y, TimeCurve, Rabbit Treasury, USDm, agents).

**Agent prompt (copy-paste):**

```text
You are working on the yieldomega monorepo (MegaETH-native, fully onchain gamefi). Read docs/glossary.md end-to-end. Do not write code. Produce a one-page summary listing: (1) the distinction between CL8Y treasury and Rabbit Treasury, (2) what “fully onchain” means in this project, (3) that documentation uses **USDm** only for the native stable name, (4) three ambiguities you would resolve before implementing contracts. Wait for human confirmation on those ambiguities before implementing.
```

---

<a id="phase-2"></a>

## Phase 2 — Licensing and compliance posture

**Doc:** [licensing.md](licensing.md)

**Goal:** Ensure AGPL-3.0 intent is clear for code and for operating network services (indexer/API).

**Agent prompt (copy-paste):**

```text
Read docs/licensing.md and the root LICENSE (AGPL-3.0). Explain in plain language what obligations apply if someone modifies and publicly runs the indexer. Propose a minimal CONTRIBUTING.md outline (sections only, no fluff) that preserves AGPL compliance. Do not change the license text unless the maintainer asks.
```

---

<a id="phase-3"></a>

## Phase 3 — Architecture overview and trust boundaries

**Doc:** [architecture/overview.md](architecture/overview.md)

**Goal:** Lock trust boundaries: contracts authoritative; indexer/frontend derived.

**Agent prompt (copy-paste):**

```text
Read docs/architecture/overview.md. Draw (in text/mermaid) the data flow for: a user claiming a TimeCurve prize, and a user depositing into Rabbit Treasury. For each step, label whether state is authoritative onchain or derived offchain. List failure modes if the indexer is wrong or stale. No code.
```

---

<a id="phase-4"></a>

## Phase 4 — Repository layout and package boundaries

**Doc:** [architecture/repository-layout.md](architecture/repository-layout.md)

**Goal:** Scaffold the monorepo directories without blurring responsibilities.

**Agent prompt (copy-paste):**

```text
Read docs/architecture/repository-layout.md. Create only empty top-level directories contracts/, indexer/, frontend/ and a root README stub if missing—do not add application logic yet. Add a .gitignore appropriate for Foundry, Rust, and Node/Vite once those toolchains exist (use standard patterns). Ensure docs remain the source of architectural truth.
```

---

<a id="phase-5"></a>

## Phase 5 — Product vision

**Doc:** [product/vision.md](product/vision.md)

**Goal:** Preserve mission: consumer economy, joy/status/participation, fees → treasuries, CL8Y governance.

**Agent prompt (copy-paste):**

```text
Read docs/product/vision.md. Write a short “non-goals” list (what this ecosystem explicitly refuses to optimize for) suitable for a README. Ensure governance emphasis stays on CL8Y rather than a TimeCurve token DAO. No code.
```

---

<a id="phase-6"></a>

## Phase 6 — TimeCurve primitive requirements

**Doc:** [product/primitives.md](product/primitives.md)

**Goal:** Translate TimeCurve mechanics into implementable requirements and open parameters.

**Agent prompt (copy-paste):**

```text
Read docs/product/primitives.md and docs/glossary.md. Produce a requirements checklist for a Foundry implementation: state variables, events, and edge cases (timer cap, minimum buy growth, max purchase multiple, sale end). Flag any underspecified numeric policy (for example per-category prize weights inside the prizes fee bucket) as TODOs needing human parameters. Do not write Solidity yet unless asked.
```

---

<a id="phase-7"></a>

## Phase 7 — Rabbit Treasury design goals

**Doc:** [product/rabbit-treasury.md](product/rabbit-treasury.md)

**Goal:** Internal accounting and health-linked repricing without pretending unsustainable yield.

**Agent prompt (copy-paste):**

```text
Read docs/product/rabbit-treasury.md. Summarize the honest sustainability story in 5 bullet points. Propose onchain-visible metrics (names only) that an indexer could chart for “reserve health” without inventing secret logic. Identify conflicts with “fully onchain” if external oracles are used, and suggest mitigation patterns (still design-level, no code).
```

---

<a id="phase-8"></a>

## Phase 8 — Leprechaun NFTs and onchain metadata schema

**Doc:** [product/leprechaun-nfts.md](product/leprechaun-nfts.md)

**Goal:** Machine-readable traits for gameplay and agents.

**Agent prompt (copy-paste):**

```text
Read docs/product/leprechaun-nfts.md. Draft a versioned JSON schema outline for onchain metadata fields (trait keys, types, allowed ranges). Include set, faction, bonus, synergy tags, and agent skill flags. Explain how upgrades or seasonal series would bump schema version. No Solidity until parameters are approved.
```

---

<a id="phase-9"></a>

## Phase 9 — Fee routing and governance

**Doc:** [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md) — [Fee sinks](onchain/fee-routing-and-governance.md#fee-sinks), [governance](onchain/fee-routing-and-governance.md#governance-actors), [post-update invariants](onchain/fee-routing-and-governance.md#post-update-invariants)

**Goal:** Define where fees may flow and who controls parameter changes.

**Agent prompt (copy-paste):**

```text
Read docs/onchain/fee-routing-and-governance.md. List every fee sink and the governance actor allowed to change its weight or destination. Propose invariant checks (plain English) that should hold after any parameter update (e.g. weights sum to 100%). No code.
```

---

<a id="phase-10"></a>

## Phase 10 — Security and threat model

**Doc:** [onchain/security-and-threat-model.md](onchain/security-and-threat-model.md)

**Goal:** Anticipate abuse before implementation.

**Agent prompt (copy-paste):**

```text
Read docs/onchain/security-and-threat-model.md. For TimeCurve and Rabbit Treasury separately, list top 5 threats and mitigations (design-level). Include MEV on timer/buys and indexer reorg confusion. Output a test plan mapping each threat to unit vs integration vs testnet validation.
```

---

<a id="phase-11"></a>

## Phase 11 — Foundry on MegaEVM

**Doc:** [contracts/foundry-and-megaeth.md](contracts/foundry-and-megaeth.md)

**Goal:** Toolchain and MegaEVM constraints (gas, sizes) inform contract modularization.

**Agent prompt (copy-paste):**

```text
Read docs/contracts/foundry-and-megaeth.md and docs/research/megaeth.md. Initialize a Foundry project under contracts/ with remappings and CI-friendly forge test. Document in contracts/README.md how to run against MegaETH RPC (testnet/mainnet) and note multidimensional gas pitfalls. Follow AGPL for new files.
```

---

<a id="phase-12"></a>

## Phase 12 — Indexer design (Rust + Postgres)

**Doc:** [indexer/design.md](indexer/design.md)

**Goal:** Event-sourced sync, reorg handling, API for UI/agents.

**Agent prompt (copy-paste):**

```text
Read docs/indexer/design.md. Scaffold a Rust binary/crate under indexer/ with: Postgres migration layout (empty SQL or placeholder), config for RPC URL and chain id, and a design note on reorg strategy for 1s blocks. Do not claim semantic completeness until contract ABIs exist; stub interfaces clearly.
```

---

<a id="phase-13"></a>

## Phase 13 — Frontend design (Vite static)

**Doc:** [frontend/design.md](frontend/design.md)

**Goal:** Static site, wallet flows, data from indexer/RPC only.

**Agent prompt (copy-paste):**

```text
Read docs/frontend/design.md. Scaffold a Vite + TypeScript app under frontend/ with routes placeholders for TimeCurve, Rabbit Treasury, and Collection. Integrate wallet connect pattern (library choice per maintainer). No hidden env secrets; use .env.example only. AGPL for new app source.
```

---

<a id="phase-14"></a>

## Phase 14 — Testing strategy (three stages)

**Doc:** [testing/strategy.md](testing/strategy.md)

**Goal:** Unit → devnet integration → testnet → production gates.

**Agent prompt (copy-paste):**

```text
Read docs/testing/strategy.md. Add CI documentation (docs or root README) describing required checks per stage. If CI files are allowed, propose a minimal workflow that runs forge test and cargo test only (no secrets). Define exit criteria for devnet integration in checklist form.
```

---

<a id="phase-15"></a>

## Phase 15 — Deployment stages

**Doc:** [operations/deployment-stages.md](operations/deployment-stages.md)

**Goal:** Repeatable promotion from devnet to testnet to mainnet.

**Agent prompt (copy-paste):**

```text
Read docs/operations/deployment-stages.md. Create a deployment checklist template (markdown table) with columns: network, contract set version, addresses, verification tx, indexer image/tag, frontend build id, signer/multisig, rollback note. Leave rows empty for future fills.
```

---

<a id="phase-16"></a>

## Phase 16 — Research: MegaETH

**Doc:** [research/megaeth.md](research/megaeth.md)

**Goal:** Keep links and assumptions current; inform gas and ops.

**Agent prompt (copy-paste):**

```text
Read docs/research/megaeth.md. Verify official doc URLs still resolve; update the doc if any link changed. Summarize for a contract dev: one paragraph on compute vs storage gas and one on why local gas estimation may differ. No unrelated refactors.
```

---

<a id="phase-17"></a>

## Phase 17 — Research: USDm and reserves

**Doc:** [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md)

**Goal:** Clarify reserve assumptions for Rabbit Treasury and fee routing.

**Agent prompt (copy-paste):**

```text
Read docs/research/stablecoin-and-reserves.md. List design decisions that require human/legal input (if any). Propose conservative defaults for which assets are accepted as reserves on v1 testnet. Ensure recommendations stay aligned with fully onchain enforcement and transparent accounting.
```

---

<a id="phase-18"></a>

## Phase 18 — Agents: metadata and Cursor skills (contributors)

**Doc:** [agents/metadata-and-skills.md](agents/metadata-and-skills.md)

**Goal:** Repo conventions so **coding** agents do not violate architecture or licensing. Distinct from **play** skills: see [Phase 20](#phase-20) and [`skills/`](../skills/README.md).

**Agent prompt (copy-paste):**

```text
Read docs/agents/metadata-and-skills.md. If .cursor/skills or rules are used in this repo, draft a skill file that tells agents: read agent-phases.md, respect AGPL, never move game logic offchain, and run tests per docs/testing/strategy.md. Keep the skill concise. Ask the maintainer where to place the file if unclear.
```

---

<a id="phase-19"></a>

## Phase 19 — Root README and discoverability

**Doc:** root [README.md](../README.md)

**Goal:** First landing for humans and agents.

**Agent prompt (copy-paste):**

```text
Read the root README.md and docs/README.md. Improve only clarity: link to docs/agent-phases.md, state AGPL-3.0, and list the three packages (contracts, indexer, frontend) as future locations. Avoid marketing fluff; keep accurate status (docs-only vs implemented).
```

---

<a id="phase-20"></a>

## Phase 20 — Play the ecosystem (agents as participants)

**Docs:** Root [`skills/README.md`](../skills/README.md) (index), plus product specs [product/primitives.md](product/primitives.md), [product/rabbit-treasury.md](product/rabbit-treasury.md), [product/leprechaun-nfts.md](product/leprechaun-nfts.md), and [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md).

**Goal:** Equip agents that **participate** in the games and treasuries—not only contributors who fork the repo. Play skills explain **how to read authoritative onchain state**, respect wallet safety, and collaborate with a human **without** mixing in contributor-only guardrails from `.cursor/skills/`.

**Agent prompt (copy-paste):**

```text
You are an agent helping a human PLAY the Yieldomega ecosystem (MegaETH), not necessarily edit this repo. Read skills/README.md and each play SKILL under skills/ that matches the human’s intent (TimeCurve + DOUB, Rabbit Treasury, Leprechaun sets, and why-participation-matters). Cross-check moves against docs/product/primitives.md, rabbit-treasury.md, leprechaun-nfts.md, and fee-routing-and-governance.md. Never present offchain indexers as sources of truth for balances or winners; cite contract reads or events. Refuse financial advice; encourage testnet practice and clear risk disclosure. Summarize a safe next-step plan for the human.
```
