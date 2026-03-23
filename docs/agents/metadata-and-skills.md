# Agents: onchain metadata and Cursor skills

## Why this matters

The ecosystem is designed for **humans and AI agents** to participate **transparently**. **Onchain metadata** encodes traits, bonuses, and **agent skill flags** ([../product/leprechaun-nfts.md](../product/leprechaun-nfts.md)). **Repository agent skills** encode how coding agents should behave so they do not violate architecture or licensing.

## Onchain metadata (product side)

- Traits should be **complete** enough for an agent to simulate **legal moves** (contract calls) without hidden server rules.
- **Agent skill flags** are not a substitute for law or platform ToS; they are **machine-readable hints** (for example “soulbound” prevents naive listing strategies).

## Cursor / IDE agent skills (repo side)

Cursor **skills** are typically small markdown instruction files (for example under `.cursor/skills/` or project rules) that tell agents:

1. Read [../agent-phases.md](../agent-phases.md) and pick the correct **phase prompt**.
2. Keep **game logic onchain**; use indexer/frontend only as prescribed in [../architecture/overview.md](../architecture/overview.md).
3. Default **AGPL-3.0** for new project code; do not strip license headers.
4. Run or propose tests per [../testing/strategy.md](../testing/strategy.md) before claiming completion.
5. Prefer **small, reviewable diffs**; do not refactor unrelated packages.

### Implemented skill placement

- [../.cursor/skills/README.md](../../.cursor/skills/README.md) is the discoverable index for project skills.
- [../.cursor/skills/yieldomega-guardrails/SKILL.md](../../.cursor/skills/yieldomega-guardrails/SKILL.md) is the shared repo guardrails skill: read phase guidance, respect AGPL-3.0, keep logic onchain, and follow testing strategy expectations.
- Add future package-specific skills under `.cursor/skills/` only if they add guidance beyond the shared guardrails.

## Prompting discipline

Humans can paste prompts from [../agent-phases.md](../agent-phases.md) verbatim. Agents should **quote which phase** they executed and **which docs** they read in PR descriptions.

---

**Agent phase:** [Phase 18 — Agents: metadata and Cursor skills](../agent-phases.md#phase-18)
