# YO DOUB — Launch UX flows (legacy title)

This filename is kept so **F-11** checkpoints in external QA specs and spreadsheets resolve to stable paths in-repo.

**Arena v2 (live):** Primary play route **`/arena`** · product spec [`docs/product/time-arena.md`](docs/product/time-arena.md) · [#240](https://gitlab.com/PlasticDigits/yieldomega/-/issues/240). v1 TimeCurve sale-end / redeem flows are **retired** ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

## F-10 — Presale vesting UX (`/vesting`)

**Shipping path:** [`/vesting`](frontend/src/pages/PresaleVestingPage.tsx) + onchain **[`DoubPresaleVesting`](contracts/src/vesting/DoubPresaleVesting.sol)** (GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)).

**Nav:** Route is **hidden** from the primary header — participants use a **direct link** (see issue comment).

**Docs:** [presale-vesting.md](docs/frontend/presale-vesting.md), [frontend design § vesting](docs/frontend/presale-vesting.md), [invariants — #92](docs/testing/invariants-and-business-logic.md#presale-vesting-frontend-gitlab-92). **Manual QA checklist:** [`docs/testing/manual-qa-checklists.md#manual-qa-issue-92`](docs/testing/manual-qa-checklists.md#manual-qa-issue-92).

---

## F-11 — Arena v2 routes (under construction vs shipped)

**Live:** **`/arena`** (TimeArena play), **`/arena/protocol`** (AUDIT), **`/referrals`** (full referrals UX — not `UnderConstruction`).

**Retired / placeholder:** **`/rabbit-treasury`**, **`/collection`** → **`UnderConstruction`**. Legacy **`/timecurve/*`** redirects to **`/arena/*`** ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266)).

**Canonical product spec:** [`docs/product/time-arena.md`](docs/product/time-arena.md) · routing invariants: [`INV-FRONTEND-266-ARENA-ROUTES`](docs/testing/invariants-and-business-logic.md#timearena-v2-gitlab-260).

**Product + tests:**

- [`docs/product/referrals.md`](docs/product/referrals.md)
- [`docs/testing/invariants-and-business-logic.md`](docs/testing/invariants-and-business-logic.md#referrals-page-visual-issue-64)
- Third-party agent checklist: [`docs/testing/manual-qa-checklists.md#manual-qa-issue-64`](docs/testing/manual-qa-checklists.md#manual-qa-issue-64)

**Agent phase:** Contributor alignment with [`docs/agent-phases.md`](docs/agent-phases.md) · Play track: [Phase 20](docs/agent-phases.md#phase-20) · [`skills/README.md`](skills/README.md).
