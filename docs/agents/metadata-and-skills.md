# Agents: onchain metadata and Cursor skills

## Why this matters

The ecosystem is designed for **humans and AI agents** to participate **transparently**. **Onchain metadata** encodes traits, bonuses, and **agent skill flags** ([../product/rabbit-nfts.md](../product/rabbit-nfts.md)). **Repository agent skills** encode how coding agents should behave so they do not violate architecture or licensing.

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

### Suggested skill placement (when implementation exists)

- `.cursor/rules/` or `.cursor/skills/yieldomega/` — one skill for **contracts**, one for **indexer**, one for **frontend**, each pointing to phase prompts **11–13** respectively plus shared governance from **phase 14**.

## Prompting discipline

Humans can paste prompts from [../agent-phases.md](../agent-phases.md) verbatim. Agents should **quote which phase** they executed and **which docs** they read in PR descriptions.

---

**Agent phase:** [Phase 18 — Agents: metadata and Cursor skills](../agent-phases.md#phase-18)
