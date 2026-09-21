# ADR 0001: Remove catch-all CODEOWNERS

- **Status:** Proposed (not accepted in this change)
- **Date:** 2026-09-21
- **Issue:** [#544](https://git.cl8y.com/code/yieldomega/issues/544) (closed empty-diff PR; not the implementation vehicle)
- **Forge policy (private, credentialed):** [cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48) · [`docs/INVARIANTS.md` blob `9622d536`](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/src/branch/main/docs/INVARIANTS.md)

This record is the versioned design for [#544](https://git.cl8y.com/code/yieldomega/issues/544). Overview pointer: [architecture overview § contribution merge gate](../overview.md#contribution-merge-gate-forgejo-544). Acceptance is a later human review, not this change. Unauthenticated fetches of the private forge repo 404; that is visibility, not missing authority.

## Outcome

After the **landing PR** (a new Forgejo pull request that actually deletes the file — not closed `#544`):

- This repository has **no** catch-all Forgejo `CODEOWNERS` at `CODEOWNERS`, `docs/CODEOWNERS`, or `.forgejo/CODEOWNERS`.
- Mirror paths `.gitea/CODEOWNERS` and `.github/CODEOWNERS` have no catch-all rule (`.* @…` or GitHub `* @…`).
- Opening a pull request does **not** plant an official review request on `@code/maintainers` (or any other team/user) for every changed path.

The **merge gate** for `main` stays (protection; already observed — not this PR’s PATCH):

| Control | Stays | Evidence class |
|---------|--------|----------------|
| Direct push to `main` | Forbidden | Admin: `enable_push: false`. Public: `user_can_push: false` |
| Required status | Woodpecker `ci/woodpecker/pr/woodpecker` | Public + admin: `enable_status_check: true`, that single context |
| `force_merge` | Never | Merge API option, **not** a field on the protection object |
| Official CODEOWNERS review as a merge block | Off | Admin-only: `block_on_official_review_requests: false` |
| Explicit REJECT | Still blocks | Admin-only: `block_on_rejected_reviews: true` |
| `required_approvals` | `0` | Public + admin |

Onchain trust boundaries are unchanged: contracts remain authoritative; indexer and frontend remain derived.

## Plant versus block (do not conflate)

| Concern | Meaning | State on `main` at this design (`250da47b`) |
|---------|---------|---------------------------------------------|
| **Plant** | Forgejo creates an official review request from a CODEOWNERS match | **Live.** Root `CODEOWNERS` blob `f4ba0c824692281802570ab93eaacfb6d35ade8f` is `.* @code/maintainers`. |
| **Block** | Branch protection refuses merge while an official review is outstanding | **Off** (admin JSON below). Public `GET /branches/main` does not show this flag. |

Closed PR [#544](https://git.cl8y.com/code/yieldomega/pulls/544) had an empty diff (head SHA = `main` `250da47b`) and was closed with “no CODEOWNERS diff left to land.” **Empty-diff ≠ file gone.** The catch-all file is still on `main`. `#544` **cannot be reopened** (branch `chore/remove-catchall-codeowners` deleted; Forgejo: “This pull request cannot be reopened because the branch was deleted.”).

`INV-DEVOPS-544-NO-CATCHALL-CODEOWNERS` evidence is **after the landing PR**, not a claim about this design SHA or current `main`.

## Context

Forgejo CODEOWNERS uses **Go regular expressions**, not GitHub globs. A non-negative rule matching any changed path requests review from the listed users/teams. This tree’s only live rule is:

```text
.* @code/maintainers
```

Paths checked on `origin/main` for this design:

| Path | `origin/main` |
|------|----------------|
| `CODEOWNERS` | Present (catch-all) |
| `docs/CODEOWNERS` | Absent |
| `.forgejo/CODEOWNERS` | Absent |
| `.gitea/CODEOWNERS` | Absent |
| `.github/CODEOWNERS` | Absent |

There is **no** Woodpecker pipeline file in this repository (no `.woodpecker.yml`, no `.woodpecker/`). The required check `ci/woodpecker/pr/woodpecker` is posted by the org/instance Woodpecker at [ci.cl8y.com](https://ci.cl8y.com) (Woodpecker **3.18.1**; repo UI [ci.cl8y.com/code/yieldomega](https://ci.cl8y.com/code/yieldomega)). Templates and instance config live in private `PlasticDigits/cl8y-forgejo` (for example `docs/templates/woodpecker-ci.yaml`), not in yieldomega. **Woodpecker green** means that Forgejo status context is success on the landing PR — open the PR Checks tab or the Woodpecker repo UI for that SHA. This issue does not add a pipeline file here.

Forge policy ([cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48), still open; INVARIANTS items 5 and 8) requires **both** `block_on_official_review_requests: false` **and** file removal. Combined with the flag still true, a catch-all deadlocks `Do: merge` when the only team member is the PR author (Forgejo 405 official review / 422 self-approve). After the flag is false, the file still **plants** official requests on every change — noise for humans and CAC drain.

`GET /repos/code/yieldomega/branch_protections` is **401** without a token. Unauthenticated `GET /branches/main` (2026-09-21) returns:

```json
{
  "protected": true,
  "required_approvals": 0,
  "enable_status_check": true,
  "status_check_contexts": ["ci/woodpecker/pr/woodpecker"],
  "user_can_push": false
}
```

It does **not** expose `enable_push`, `force_merge`, `block_on_official_review_requests`, or `block_on_rejected_reviews`. Credentialed `GET /branch_protections` for rule `main` (same day; token redacted; `updated_at` `2026-09-21T07:29:33Z`):

```json
{
  "branch_name": "main",
  "enable_push": false,
  "enable_status_check": true,
  "status_check_contexts": ["ci/woodpecker/pr/woodpecker"],
  "required_approvals": 0,
  "block_on_rejected_reviews": true,
  "block_on_official_review_requests": false,
  "block_on_outdated_branch": true,
  "dismiss_stale_approvals": true,
  "apply_to_admins": false
}
```

`force_merge` is absent from that object. It is a merge-API option; forge INVARIANT 7 forbids using it. Protection PATCH stays admin-only in `PlasticDigits/cl8y-forgejo` (`apply_repo_policy.py`). This tree does not PATCH protection.

## Non-goals

- Do not PATCH Forgejo branch protection from this repository (admin / `apply_repo_policy.py` in cl8y-forgejo).
- Do not add path-specific CODEOWNERS, empty CODEOWNERS placeholders, or `required_approvals: 1`.
- Do not enable direct push to `main` or document `force_merge: true`.
- Do not dismiss reviewers from CAC as a substitute ([cl8y-agent-control#388](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/388)).
- Do not migrate `.github/workflows/*` into Woodpecker YAML, add `.gitlab-ci.yml`, or POST fake commit statuses.
- Do not change onchain, indexer, or frontend behavior.
- Do not deploy, spend, move custody, or expand autonomy policy ([cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297)).
- Do not reopen or “land” closed PR `#544`. Do not treat its empty diff as deletion.
- Do not merge this design branch to `main` as a docs-only PR (that would publish plant-absence claims while the file still exists).
- Design review in this change does not write `DESIGN: APPROVE` and does not treat issue keywords as architecture acceptance.

## Component / state / interface changes

| Surface | Change |
|---------|--------|
| `CODEOWNERS` (repo root) | **Delete** the file on the landing PR. It is the only catch-all today. |
| `docs/CODEOWNERS`, `.forgejo/CODEOWNERS` | Confirm **absent**; delete if a catch-all appears. |
| `.gitea/CODEOWNERS`, `.github/CODEOWNERS` | Confirm **no catch-all** (mirror inventory). |
| `scripts/check-no-catchall-codeowners.sh` | **Required** on the landing PR; hooked from GitHub `scripts-smoke`. |
| `AGENTS.md` + Forgejo PR helper | **In scope** on the landing PR: supported merge PR is `git.cl8y.com/code/yieldomega`. `scripts/glab-mr-create.sh` stays GitLab-mirror only. |
| Forgejo PR reviewers API | After delete: no automatic official request from `.* @code/maintainers`. Manual review requests remain allowed. |
| Branch protection JSON | **No change** from this issue. |
| Contracts / indexer / frontend / bots | None. |
| Docs | This ADR; short overview pointer; CI merge-gate sentences that split plant/block; proposed `INV-DEVOPS-544-*`. |

No application state, schema, or HTTP interface changes.

## Affected invariants

New (this issue): [invariants §544](../../testing/invariants-and-business-logic.md#forgejo-catchall-codeowners-issue-544).

| ID | Property | When true |
|----|----------|-----------|
| **`INV-DEVOPS-544-NO-CATCHALL-CODEOWNERS`** | No Forgejo lookup path with an active `.* @user-or-team` rule; mirrors have no catch-all | **After** the landing PR |
| **`INV-DEVOPS-544-MERGE-GATE`** | Trusted merge to `main` is PR + Woodpecker `ci/woodpecker/pr/woodpecker` + no direct push + no `force_merge`. Official CODEOWNERS review is not a merge gate | **Now** (protection). File delete does not change this |
| **`INV-DEVOPS-544-NO-REINTRODUCE`** | Adding a catch-all CODEOWNERS file in a later PR must not be treated as restoring an official-review merge block (protection PATCH is admin-only) | Ongoing |

Related, not replaced:

- **`INV-DEVOPS-322-GITLAB-CI-MINIMAL`** — still: no `.gitlab-ci.yml`. GitHub Actions remains the **mirrored unit-test suite** ([ci.md §322](../../testing/ci.md#gitlab-github-ci-split-gitlab-322)). Forgejo protection + Woodpecker is the write-path merge **block** gate ([ci.md §544](../../testing/ci.md#forgejo-merge-gate-issue-544)). Do not reopen #322 as a Woodpecker YAML migration.

## Alternatives

| Option | Why not |
|--------|---------|
| Keep the file; rely only on `block_on_official_review_requests: false` | Still plants official requests on every PR; forge invariant 5 requires **both** flag and file removal. |
| Path-specific CODEOWNERS (`contracts/.*`, …) | Out of scope; still plants official reviews; one-person team deadlock returns if the official-review flag is ever re-enabled. |
| `required_approvals: 1` without a second human | Same 422 self-approve deadlock. Future allowlist is a follow-up, not this issue. |
| Delete via direct push to `main` | Forbidden. Catch-all files are removed **via PR**. |
| Leave an empty `CODEOWNERS` | Easy to refill with `.* @team`; absence is the clearer contract. |
| Dismiss leftover official requests from automation | Forbidden substitute; protection flag already makes them non-blocking. |
| Reopen or push to closed `#544` / deleted `chore/remove-catchall-codeowners` | Cannot reopen; empty-diff already failed as a vehicle. |
| Land this design SHA (or a docs-only successor) on `main` without deleting the file | Publishes plant-absence prose while blob `f4ba0c82…` remains. |
| Let cl8y-forgejo `remove_codeowners.py` be the only PR | That script can delete the file, but this repo also needs ADR + satellites + absence gate + write-path retarget in **one** landing PR. |
| Leave `AGENTS.md` on GitLab MRs while `ci.md` calls Forgejo canonical | Agents open a GitLab MR that never removes Forgejo `CODEOWNERS`. Resolved by the write-path slice below (in scope). |

## Complexity added / removed

**Removed (after landing):** Catch-all official-review plant on every change; merge deadlock class for author-as-sole-maintainer; docs that could be read as “CODEOWNERS is the merge block.”

**Added:** A small doc/test surface (this ADR, overview pointer, required absence script on GitHub `scripts-smoke`). Narrow Cloud-agent write-path retarget (Forgejo PR helper). No runtime product complexity.

## Write path (in scope)

Pick used: **retarget the supported merge PR to Forgejo.** Do not leave GitLab as the agent merge vehicle while satellites call Forgejo canonical.

| Today | Landing PR |
|-------|------------|
| `AGENTS.md` “GitLab merge requests” → `scripts/glab-mr-create.sh` (PlasticDigits GitLab) | Product merge PRs: `git.cl8y.com/code/yieldomega` |
| `scripts/glab-mr-create.sh` | Remains for the **GitLab mirror** only. Must not be the vehicle that deletes Forgejo `CODEOWNERS`. |
| No Forgejo PR helper in this tree | Add `scripts/forgejo-pr-create.sh` (POST `/repos/code/yieldomega/pulls`) **or** document the equivalent UI/API in `AGENTS.md` so the landing PR is openable without `glab`. |

This is documentation/helper retarget, not deploy/spend/custody/policy expansion under [cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297).

## Migration

1. Protection PATCH for this repo is **already done** (forge `apply_repo_policy.py`, not this tree). Observed admin JSON above.
2. **Do not use PR `#544`.** It is closed, unmerged, empty-diff, unreopenable. Open a **new** Forgejo PR from a **new** branch (suggested `chore/delete-catchall-codeowners`) whose diff **deletes** root `CODEOWNERS` (blob `f4ba0c82…` must not remain on the PR tip).
3. That same PR is the **only** landing vehicle for: file delete, this ADR, satellite pointers, present-tense plant-absence claims, required absence script + `scripts-smoke`, and the `AGENTS.md` / Forgejo helper retarget. If docs and delete are ever split, docs stay conditional until the file is gone — do not split.
4. Tracking: closed `#544` cannot hold an open PR. Implementer files a **new** Forgejo issue with the same title if a live tracker is required, and links the new PR. This design change does not file that issue. Comments may still be added on closed `#544` as historical context.
5. Existing open PRs may still show leftover official requests; they are **not** a merge block while the protection flag is false. Humans may dismiss them; automation must not.
6. GitHub/GitLab mirrors follow Forgejo; they are not a second write path for this deletion.

## Observability

- PR sidebar: no automatic `@code/maintainers` official request on **new** PRs after the file is gone.
- Required check: `ci/woodpecker/pr/woodpecker` still appears on the Forgejo PR (source: [ci.cl8y.com/code/yieldomega](https://ci.cl8y.com/code/yieldomega), not this tree).
- Public: `GET /api/v1/repos/code/yieldomega/branches/main` — `protected`, `required_approvals=0`, Woodpecker context, `user_can_push=false`.
- Admin: `GET /branch_protections` — flags in the dump above. Product CI must not call this (no admin token in GitHub Actions).
- Absence gate: GitHub `scripts-smoke` fails if a catch-all returns. This is a **mirror doc-gate**, not a substitute for the Forgejo Woodpecker context.
- CAC: official-review drain skip should stop appearing for **new** PRs; leftover skip cleanup is cl8y-agent-control, not this repo.

## Failure modes

| Failure | Effect | Mitigation |
|---------|--------|------------|
| Delete root file but leave `docs/` or `.forgejo/` catch-all | Requests still planted | Inventory all three Forgejo paths before merge. |
| Mirror `.gitea/` or `.github/CODEOWNERS` catch-all | Silent reintroduce on a mirror | Inventory those paths in the required script. |
| Treat empty-diff / closed `#544` as done | File remains on `main` (this already happened) | New PR; `INV-DEVOPS-544-NO-CATCHALL` + required script must fail while the file exists. |
| Docs-only PR to `main` | Satellites claim no plant while blob `f4ba0c82…` lives | One landing PR; refuse docs-only merge of this design. |
| Agent uses `glab-mr-create.sh` | GitLab MR never deletes Forgejo `CODEOWNERS` | Write-path slice: Forgejo PR is the supported merge. |
| Re-add catch-all in a later PR | Requests planted again; **not** an official-review merge block unless an admin PATCHes protection | Doc + `INV-DEVOPS-544-NO-REINTRODUCE`; review the PR on its merits. |
| Woodpecker context missing or red | Cannot merge | Pre-existing org/instance pipeline; this issue does not fake statuses or drop the required context. Confirm at ci.cl8y.com, not by adding YAML here. |
| Operator uses `force_merge` | Bypasses reviews/status | Forbidden by forge invariant 7; do not document it here. |
| Treat this ADR as protection PATCH | Wrong owner | Protection lives in cl8y-forgejo policy scripts. |

## Ordered implementation slices

1. **Docs (this design branch `cac-design-issue-544`).** ADR 0001 + overview / CI / CONTRIBUTING / invariant stubs that **split plant vs block**. `AGENTS.md` names Forgejo as the merge host (helper may still be landing-PR work). **No** `CODEOWNERS` delete. **No** product PR from this branch.

2. **Single landing PR on Forgejo** (new branch, new PR number). Waits on design acceptance. Includes **all** of:
   1. Delete root `CODEOWNERS`.
   2. This ADR plus satellite pointers.
   3. Present-tense “no catch-all file / no plant” sentences, which are true **in this same commit**.
   4. `scripts/check-no-catchall-codeowners.sh` + required `scripts-smoke` step in [`.github/workflows/unit-tests.yml`](../../../.github/workflows/unit-tests.yml).
   5. `AGENTS.md` Cloud-agent row + `scripts/forgejo-pr-create.sh` (or documented Forgejo API/UI) so the supported merge PR is `git.cl8y.com/code/yieldomega`.
   6. Confirm the five CODEOWNERS paths have no catch-all.

   There is no later “clarify CI docs” slice. Do not double-book.

3. **Merge that landing PR** with Woodpecker `ci/woodpecker/pr/woodpecker` green, SHA-pinned `Do: merge`, no `force_merge`, no direct `main`.

Slice 1 has no yieldomega issue dependency. Slices 2–3 wait on design acceptance. Cross-repo: forge protection for this repo is already applied; do not block the file delete on a second protection PATCH. Closed `#544` is not a dependency (it cannot track an open PR).

## Tests

Required on the landing PR (not optional). GitHub mirror doc-gate only — **not** a substitute for Forgejo Woodpecker.

```bash
# Forgejo lookup paths must be absent after delete
test ! -e CODEOWNERS && test ! -e docs/CODEOWNERS && test ! -e .forgejo/CODEOWNERS

# Mirrors must not carry a catch-all either
test ! -e .gitea/CODEOWNERS && test ! -e .github/CODEOWNERS \
  || ! git grep -nE '^[[:space:]]*(\.\*|\*)[[:space:]]+@' -- .gitea/CODEOWNERS .github/CODEOWNERS

# No catch-all official-review rule if a Forgejo file is reintroduced
! git grep -nE '^[[:space:]]*\.\*[[:space:]]+@' -- CODEOWNERS docs/CODEOWNERS .forgejo/CODEOWNERS
```

Implementation: `scripts/check-no-catchall-codeowners.sh` encoding the above, invoked from the `scripts-smoke` job next to the other doc gates. The script must **fail** while root `CODEOWNERS` still exists (this is the gate closed `#544` lacked). No Foundry, cargo, or Playwright requirement. No browser verification (no UI). Do not assert admin protection JSON from product CI.

## Rollout

- Design publishes on `cac-design-issue-544` (this branch). Transport only; **not** a design-only product PR and **not** merged to `main`.
- Implementation is **one** new Forgejo landing PR into `main` (delete + docs + script + write-path retarget).
- ADR 0001 reaches `main` only inside that landing PR, in the same commit as the delete.
- Rollout is git-only. No deploy, no spend, no custody.

## Rollback

Restore a CODEOWNERS file only via a **new PR** (not force-push to `main`). Restoring `.* @code/maintainers` plants requests again; it does **not** restore the official-review merge block unless an admin PATCHes protection (out of this repo, discouraged).

## Integration completion criteria

- [ ] Root / `docs/` / `.forgejo/` have no catch-all CODEOWNERS; `.gitea/` and `.github/` have no catch-all either.
- [ ] A fresh PR that touches an arbitrary path does not auto-request `@code/maintainers`.
- [ ] `main` protection still matches the outcome table (no direct push, Woodpecker PR context required, official-review block false, rejected reviews true, approvals 0). Re-check public `GET /branches/main`; admin flags stay admin-only.
- [ ] This ADR remains the in-repo decision; overview and [ci.md §544](../../testing/ci.md#forgejo-merge-gate-issue-544) point here rather than restating policy.
- [ ] `INV-DEVOPS-544-NO-CATCHALL-CODEOWNERS` evidence commands pass **after** merge (they fail on current `main`).
- [ ] `scripts/check-no-catchall-codeowners.sh` is required in GitHub `scripts-smoke`.
- [ ] `AGENTS.md` tells Cloud agents to open the merge PR on Forgejo, not via `glab-mr-create.sh`.
- [ ] Closed `#544` was not reused; the landing PR diff deletes `CODEOWNERS`.
- [ ] No `force_merge`, no direct `main`, no protection PATCH from product CI.

## Authority

Ordinary design. Not deploy, spend, custody, or policy expansion under [cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297). Forge merge-policy authority stays in private `PlasticDigits/cl8y-forgejo` (INVARIANTS blob `9622d536`); this ADR only describes the yieldomega tree.
