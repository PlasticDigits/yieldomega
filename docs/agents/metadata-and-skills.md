# Agents: onchain metadata and Cursor skills

## Why this matters

The ecosystem is designed to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries.** **Repository agent skills** encode how coding agents should behave so they do not violate architecture or licensing.

## Onchain metadata (product side)

- Arena v2 rules live in **`TimeArena`** and published docs ([`arena-v2.md`](../product/arena-v2.md)); agents should read **onchain** state, not retired launchpad docs.

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

Agents (and humans driving them) who want to **use** **Time Arena** (Arena v2) need guidance that is **not** the same as contributor guardrails. Play skills live at the repository root: [../../skills/README.md](../../skills/README.md).

**Invariant ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)):** `skills/` carries **player-facing** Cursor skills **only**. Maintainer QA lives under [`docs/testing/manual-qa-checklists.md`](../testing/manual-qa-checklists.md).

| Play skill | Use when |
|------------|----------|
| [../../skills/play-active-time-arena/SKILL.md](../../skills/play-active-time-arena/SKILL.md) | Route by live / paused Arena timers on `TimeArena`. |
| [../../skills/why-yieldomega-participation-matters/SKILL.md](../../skills/why-yieldomega-participation-matters/SKILL.md) | Ethics framing before other play skills. |
| [../../skills/script-with-timearena-local/SKILL.md](../../skills/script-with-timearena-local/SKILL.md) | Local scripts vs deployed contracts (env, Anvil stack). |
| [../../skills/play-time-arena-doub/SKILL.md](../../skills/play-time-arena-doub/SKILL.md) | DOUB buys, Last Buy timer, 40/30/30 podium routing. |
| [../../skills/play-time-arena-warbow/SKILL.md](../../skills/play-time-arena-warbow/SKILL.md) | DOUB WarBow (stub until [#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)). |

### Contributor manual QA (not play skills)

Row-by-row Anvil, Playwright, wallet, and UI verification checklists: [../testing/manual-qa-checklists.md](../testing/manual-qa-checklists.md). Examples: [Arena v2 (#260)](../testing/manual-qa-checklists.md#manual-qa-issue-260), [Anvil E2E (#87)](../testing/manual-qa-checklists.md#manual-qa-issue-87).

- **Issue #71 / stale bookmarks:** Older references to **`skills/verify-yo-album-bgm-resume/SKILL.md`** should be updated to **[Album 1 BGM resume (#71)](../testing/manual-qa-checklists.md#manual-qa-issue-71)** ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100) consolidation).

- **Issue #103 / mobile album dock:** Contributor verification and the **canonical procedural checklist** live under **[Mobile album dock vs nav (#103)](../testing/manual-qa-checklists.md#manual-qa-issue-103)**. Maintainer-facing doc maps should **not** treat [`../../skills/contributor-mobile-album-dock/SKILL.md`](../../skills/contributor-mobile-album-dock/SKILL.md) as a second checklist anchor ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)); that file remains an **optional** implementation deep-dive for agents editing `frontend/` audio or layout chrome.

- **Why:** Forking and patching code is optional; **understanding onchain rules** is the usual path for participants. Play skills focus on authoritative contracts, wallet hygiene, and **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules.** **Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate (see [../../skills/README.md](../../skills/README.md)).
- **How to use:** Point your agent at [Phase 20 — Play the ecosystem (agents helping users participate)](../agent-phases.md#phase-20) in [../agent-phases.md](../agent-phases.md), then read the indexed play `SKILL.md` files under `skills/` (table above).
- **Onchain metadata** (traits, agent flags) still applies to *what* can be done in games; play skills explain *how* to interpret rules responsibly.

## Prompting discipline

Humans can paste prompts from [../agent-phases.md](../agent-phases.md) verbatim. **Contributor** agents should **quote which phase** they executed and **which docs** they read in PR descriptions. **Play** agents should cite [Phase 20 (agents helping users participate)](../agent-phases.md#phase-20) and the relevant `skills/*/SKILL.md` when advising participation.

---

**Agent phases:** [Phase 18 — Agents: metadata and contributor skills](../agent-phases.md#phase-18) · [Phase 20 — Play the ecosystem (agents helping users participate)](../agent-phases.md#phase-20)
