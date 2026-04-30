---
name: script-with-timecurve-local
description: Author local TypeScript or Python scripts against deployed TimeCurve — reads, env hygiene, CHARM bounds, cooldowns, timing near sale end. For players and agents helping players; not for patching the yieldomega repo (use Phase 18 + guardrails for contributors).
---

# Script with TimeCurve locally (TS / Python)

**Audience:** **Players** and **agents helping players** use wallets and onchain reads — not **contributors** editing `frontend/`, `contracts/`, `indexer/`, or CI unless the user explicitly intends to open a merge request. **Contributors:** [Phase 18 — Agents: metadata and contributor skills](../../docs/agent-phases.md#phase-18) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Hard rule:** Do **not** propose merge requests or edits under this monorepo unless the user states **contributor** intent. Participant automation belongs in **the user’s own** scratch folder or repo.

## A. Scope and languages

- **TypeScript** (viem, ethers) or **Python** (web3.py) — **local scripts only**.
- **Never** imply that participant scripts must live inside PlasticDigits/yieldomega unless the user is shipping a contributor change.

## B. Environment and addresses

- **RPC URL** and **chain ID** in env; **private keys** via env or hardware — **no commits** of secrets.
- **UUPS proxies:** Use the **ERC1967 proxy** for `TimeCurve` and siblings for **live state** and writes — not the **implementation** row in `run-latest.json` ([`docs/testing/anvil-rich-state.md`](../../docs/testing/anvil-rich-state.md), [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61), [`docs/contracts/foundry-and-megaeth.md`](../../docs/contracts/foundry-and-megaeth.md)).
- Resolve addresses from deployment artifacts, registry JSON, or explorer for the **target** network.

## C. Read-before-write checklist

Poll or call **before** each write (or on a tight loop for time-sensitive flows):

- **Sale phase / timer / `ended`** — match your intent to the **onchain** deadline, not indexer/UI alone ([`docs/product/primitives.md`](../../docs/product/primitives.md), [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48)).
- **`currentCharmBoundsWad()`** (or the deployment’s documented ABI) — size CHARM inside **[min, max]** inclusive; mind submit-time drift near band edges ([issue #82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82), [`docs/testing/manual-qa-checklists.md`](../../docs/testing/manual-qa-checklists.md#manual-qa-issue-82)).
- **Per-wallet buy cooldown** — `buyCooldownSec`, `nextBuyAllowedAt(account)` when applicable.
- **Token balances and allowances** for accepted asset, wrappers, and **Kumbaya** router paths if used ([`docs/integrations/kumbaya.md`](../../docs/integrations/kumbaya.md)).
- **Reference implementation:** [`bots/timecurve/README.md`](../../bots/timecurve/README.md) **`inspect`** and Python CLIs show read patterns; AGPL — copy **ideas** into your own project, do not assume license compatibility for closed-source reuse.

## D. “Last buy” and timing-sensitive buys (process, not advice)

**Intent:** A transaction **included before** `endSale` / phase transition, under competition and clock skew — **not** a guarantee of outcome or profit.

- **Source of truth:** Prefer **RPC** reads for `deadline`, `ended`, and `block.timestamp` over indexer/API latency.
- **Revert risks:** Band violations, cooldown not elapsed, sale already ended, insufficient liquidity or slippage on router paths, gas spikes.
- **Ordering:** Public mempools do not guarantee inclusion order; private builders / MEV are **factual** ecosystem details, not encouragement.
- **Pattern:** Poll `latest` block timestamp vs sale deadline → leave conservative lead time → build tx → `eth_call` dry-run when helpful → sign/send with explicit nonce / gas; refresh Kumbaya swap deadlines from **chain time**, not `Date.now()` ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)).
- **ABIs:** Treat [`contracts/`](../../contracts/) artifacts as **read-only references** — import ABI JSON into **your** script’s tree.

## E. Referrals, `buyFor`, routers

- **Referrals:** Code rules and capture semantics in [`docs/product/referrals.md`](../../docs/product/referrals.md).
- **`buyFor` / `TimeCurveBuyRouter` / `buyViaKumbaya`:** [`docs/integrations/kumbaya.md`](../../docs/integrations/kumbaya.md) — gross CL8Y, router attestation, env parity for local registry.

## F. Safety / ethics

Cross-link **[`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)** — voluntary participation, informed consent, **no** promises of profit or “win” timing.

## G. Relationship to in-repo bots

[`bots/timecurve/`](../../bots/timecurve/) is **maintained AGPL** project code for local Anvil and ops. Participants may **study** it or run it per its README; casual production use requires understanding **AGPL obligations** and operational risk.
