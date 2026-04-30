# Agents: onchain metadata and Cursor skills

## Why this matters

The ecosystem is designed to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries.** **Onchain metadata** encodes traits, bonuses, and **agent skill flags** ([../product/leprechaun-nfts.md](../product/leprechaun-nfts.md)). **Repository agent skills** encode how coding agents should behave so they do not violate architecture or licensing.

## Onchain metadata (product side)

- Traits should be **complete** enough for an agent to simulate **moves permitted under deployed contracts and published rules** (contract calls) without hidden server rules.
- **Agent skill flags** are not a substitute for law or platform ToS; they are **machine-readable hints** (for example “soulbound” prevents naive listing strategies).

## Contributor skills (Cursor / IDE — **fork and build**)

Cursor **skills** are typically small markdown instruction files (for example under `.cursor/skills/` or project rules) that tell **coding** agents:

1. Read [../agent-phases.md](../agent-phases.md) and pick the correct **phase prompt**.
2. Keep **game logic onchain**; use indexer/frontend only as prescribed in [../architecture/overview.md](../architecture/overview.md).
3. Default **AGPL-3.0** for new project code; do not strip license headers.
4. Run or propose tests per [../testing/strategy.md](../testing/strategy.md) before claiming completion.
5. Prefer **small, reviewable diffs**; do not refactor unrelated packages.

### Implemented contributor skill placement

- [../.cursor/skills/README.md](../../.cursor/skills/README.md) is the discoverable index for **contributor** skills.
- [../.cursor/skills/yieldomega-guardrails/SKILL.md](../../.cursor/skills/yieldomega-guardrails/SKILL.md) is the shared repo guardrails skill: read phase guidance, respect AGPL-3.0, keep logic onchain, and follow testing strategy expectations.
- Add future package-specific skills under `.cursor/skills/` only if they add guidance beyond the shared guardrails.

## Play skills (root **`skills/`** — **participate, not fork**)

Agents (and humans driving them) who want to **use** onchain games and treasuries—TimeCurve, Rabbit Treasury / DOUB, Leprechaun collections—need guidance that is **not** the same as contributor guardrails. Those play skills live at the repository root: [../../skills/README.md](../../skills/README.md).

**Invariant ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)):** `skills/` carries **six** player-facing Cursor skills **only**. Maintainer QA / harness prose lives under [`docs/testing/manual-qa-checklists.md`](../testing/manual-qa-checklists.md)—not inside `skills/`.

| Play skill | Use when |
|------------|----------|
| [../../skills/why-yieldomega-participation-matters/SKILL.md](../../skills/why-yieldomega-participation-matters/SKILL.md) | Ethics-and-governance framing before other play skills. |
| [../../skills/script-with-timecurve-local/SKILL.md](../../skills/script-with-timecurve-local/SKILL.md) | Local TypeScript or Python scripts vs **deployed** contracts (reads, env, timing-sensitive buy **process**—not repo patches). |
| [../../skills/play-timecurve-doubloon/SKILL.md](../../skills/play-timecurve-doubloon/SKILL.md) | Buys, timer, charms, **four** fixed v1 reserve podium **categories**, DOUB / fee sinks ([`primitives.md`](../product/primitives.md)). |
| [../../skills/play-timecurve-warbow/SKILL.md](../../skills/play-timecurve-warbow/SKILL.md) | WarBow Ladder PvP: Battle Points, steal / guard / revenge / flag. |
| [../../skills/play-rabbit-treasury/SKILL.md](../../skills/play-rabbit-treasury/SKILL.md) | Burrow deposits, epochs, withdraws, reserve-linked behavior. |
| [../../skills/collect-leprechaun-sets/SKILL.md](../../skills/collect-leprechaun-sets/SKILL.md) | Leprechaun sets, traits, and collecting onchain. |

### Contributor manual QA (not play skills)

Row-by-row Anvil, Playwright, wallet, and UI verification checklists: [../testing/manual-qa-checklists.md](../testing/manual-qa-checklists.md) (table of contents + GitLab cross-links). Examples: [Arena sniper-shark (#80)](../testing/manual-qa-checklists.md#manual-qa-issue-80), [Album 1 BGM resume (#71)](../testing/manual-qa-checklists.md#manual-qa-issue-71), [post-end gates (#79)](../testing/manual-qa-checklists.md#manual-qa-issue-79).

- **Why:** Forking and patching code is optional; **understanding onchain rules** is the usual path for participants. Play skills focus on authoritative contracts, wallet hygiene, and **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules.** **Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate (see [../../skills/README.md](../../skills/README.md)).
- **How to use:** Point your agent at [Phase 20 — Play the ecosystem (agents helping users participate)](../agent-phases.md#phase-20) in [../agent-phases.md](../agent-phases.md), then read the indexed play `SKILL.md` files under `skills/` (table above).
- **Onchain metadata** (traits, agent flags) still applies to *what* can be done in games; play skills explain *how* to interpret rules responsibly.

## Prompting discipline

Humans can paste prompts from [../agent-phases.md](../agent-phases.md) verbatim. **Contributor** agents should **quote which phase** they executed and **which docs** they read in PR descriptions. **Play** agents should cite [Phase 20 (agents helping users participate)](../agent-phases.md#phase-20) and the relevant `skills/*/SKILL.md` when advising participation.

---

**Agent phases:** [Phase 18 — Agents: metadata and contributor skills](../agent-phases.md#phase-18) · [Phase 20 — Play the ecosystem (agents helping users participate)](../agent-phases.md#phase-20)
