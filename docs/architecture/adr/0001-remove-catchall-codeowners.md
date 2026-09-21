# ADR 0001: Remove catch-all CODEOWNERS

- **Status:** Proposed (not accepted in this change)
- **Date:** 2026-09-21
- **Issue:** [#544](https://git.cl8y.com/code/yieldomega/issues/544)
- **Forge policy origin:** [cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48) · [INVARIANTS.md](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/src/branch/main/docs/INVARIANTS.md)

This record is the versioned design for [#544](https://git.cl8y.com/code/yieldomega/issues/544). Overview pointer: [architecture overview § contribution merge gate](../overview.md#contribution-merge-gate-forgejo-544). Acceptance is a later human review, not this change.

## Outcome

After implementation, this repository has **no** catch-all Forgejo `CODEOWNERS` at `CODEOWNERS`, `docs/CODEOWNERS`, or `.forgejo/CODEOWNERS`. Opening a pull request does **not** plant an official review request on `@code/maintainers` (or any other team/user) for every changed path.

The **merge gate** for `main` stays:

| Control | Stays |
|---------|--------|
| Direct push to `main` | Forbidden (`enable_push: false`) |
| Required status | Woodpecker `ci/woodpecker/pr/woodpecker` |
| `force_merge` | Never |
| Official CODEOWNERS review as a merge block | Off (`block_on_official_review_requests: false`) |
| Explicit REJECT | Still blocks (`block_on_rejected_reviews: true`) |
| `required_approvals` | `0` (one-person maintainers cannot self-approve) |

Onchain trust boundaries are unchanged: contracts remain authoritative; indexer and frontend remain derived.

## Context

Forgejo CODEOWNERS uses **Go regular expressions**, not GitHub globs. A non-negative rule matching any changed path requests review from the listed users/teams. This tree currently has a root file whose only rule is:

```text
.* @code/maintainers
```

That is a catch-all. Combined with branch protection that **blocks on official review requests**, it deadlocks `Do: merge` when the only team member is the PR author (Forgejo 405 official review / 422 self-approve). Catch-all files also plant official requests on every change even after the protection flag is false — noise for humans and for CAC drain.

Forge policy ([cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48)) already reversed the official-review **protection** half for owners `code` and `PlasticDigits`. This repo’s live `main` protection (observed 2026-09-21) already has `block_on_official_review_requests: false`, `required_approvals: 0`, required Woodpecker PR context, and `enable_push: false`. The remaining product-tree work is **delete the catch-all file via PR** (never direct push) and record the merge gate in this repo’s docs so contributors do not reintroduce `.* @team`.

Open implementation vehicle: PR [#544](https://git.cl8y.com/code/yieldomega/pulls/544) on `chore/remove-catchall-codeowners`. At design time that branch tip matched `main` (empty diff). Implementation must actually delete the file on that branch (or a successor PR); opening the PR is not the deletion.

## Non-goals

- Do not PATCH Forgejo branch protection from this repository (admin / `apply_repo_policy.py` in cl8y-forgejo).
- Do not add path-specific CODEOWNERS, empty CODEOWNERS placeholders, or `required_approvals: 1`.
- Do not enable direct push to `main` or document `force_merge: true`.
- Do not dismiss reviewers from CAC as a substitute ([cl8y-agent-control#388](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/388)).
- Do not migrate `.github/workflows/*` into Woodpecker YAML, add `.gitlab-ci.yml`, or POST fake commit statuses.
- Do not change onchain, indexer, or frontend behavior.
- Do not deploy, spend, move custody, or expand autonomy policy ([cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297)).
- Design review in this change does not merge PR 544, does not write `DESIGN: APPROVE`, and does not treat issue keywords as architecture acceptance.

## Component / state / interface changes

| Surface | Change |
|---------|--------|
| `CODEOWNERS` (repo root) | **Delete** the file. It is the only catch-all today. |
| `docs/CODEOWNERS`, `.forgejo/CODEOWNERS` | Confirm **absent**; delete if a catch-all appears. |
| Forgejo PR reviewers API | No automatic official request from `.* @code/maintainers`. Manual review requests remain allowed. |
| Branch protection JSON | **No change** from this issue. Already matches forge invariants. |
| Contracts / indexer / frontend / bots | None. |
| Docs | This ADR; short overview pointer; CI merge-gate sentence; proposed `INV-DEVOPS-544-*`. |

No application state, schema, or HTTP interface changes.

## Affected invariants

New (this issue): [invariants §544](../../testing/invariants-and-business-logic.md#forgejo-catchall-codeowners-issue-544).

| ID | Property |
|----|----------|
| **`INV-DEVOPS-544-NO-CATCHALL-CODEOWNERS`** | No `CODEOWNERS` / `docs/CODEOWNERS` / `.forgejo/CODEOWNERS` whose active rule requests a user/team for `.*`. |
| **`INV-DEVOPS-544-MERGE-GATE`** | Trusted merge to `main` is PR + Woodpecker `ci/woodpecker/pr/woodpecker` + no direct push + no `force_merge`. Official CODEOWNERS review is not a merge gate. |
| **`INV-DEVOPS-544-NO-REINTRODUCE`** | Adding a catch-all CODEOWNERS file in a later PR must not be treated as restoring an official-review merge block (protection PATCH is admin-only). |

Related, not replaced:

- **`INV-DEVOPS-322-GITLAB-CI-MINIMAL`** — still: no `.gitlab-ci.yml`. Implementation should clarify that GitHub Actions remains the **mirrored unit-test suite** ([ci.md §322](../../testing/ci.md#gitlab-github-ci-split-gitlab-322)), while **Forgejo protection** is the write-path merge gate ([ci.md §544](../../testing/ci.md#forgejo-merge-gate-issue-544)). Do not reopen #322 as a Woodpecker YAML migration.

## Alternatives

| Option | Why not |
|--------|---------|
| Keep the file; rely only on `block_on_official_review_requests: false` | Still plants official requests on every PR; forge invariant 5 requires **both** flag and file removal. |
| Path-specific CODEOWNERS (`contracts/.*`, …) | Out of scope; still plants official reviews; one-person team deadlock returns if the official-review flag is ever re-enabled. |
| `required_approvals: 1` without a second human | Same 422 self-approve deadlock. Future allowlist is a follow-up, not this issue. |
| Delete via direct push to `main` | Forbidden. Catch-all files are removed **via PR**. |
| Leave an empty `CODEOWNERS` | Easy to refill with `.* @team`; absence is the clearer contract. |
| Dismiss leftover official requests from automation | Forbidden substitute; protection flag already makes them non-blocking. |

## Complexity added / removed

**Removed:** Catch-all official-review plant on every change; merge deadlock class for author-as-sole-maintainer; docs that could be read as “CODEOWNERS is the merge gate.”

**Added:** A small doc/test surface (this ADR, overview pointer, grep/absence check). No runtime complexity.

## Migration

1. Protection PATCH is **already done** for this repo (forge rollout, not this tree).
2. Implementation deletes the catch-all file(s) on `chore/remove-catchall-codeowners` (or a new PR if that branch cannot be reused) and lands through `Do: merge` with `head_commit_id` after Woodpecker is green.
3. Existing open PRs may still show leftover official requests; they are **not** a merge block while the protection flag is false. Humans may dismiss them; automation must not.
4. GitHub/GitLab mirrors follow Forgejo; they are not a second write path.

## Observability

- PR sidebar: no automatic `@code/maintainers` official request on new PRs after the file is gone.
- Required check: `ci/woodpecker/pr/woodpecker` still appears on the PR and is required to merge.
- Protection JSON (admin): `enable_push=false`, `block_on_official_review_requests=false`, `required_approvals=0`, `block_on_rejected_reviews=true`, `status_check_contexts=["ci/woodpecker/pr/woodpecker"]`.
- CAC: official-review drain skip should stop appearing for **new** PRs; leftover skip cleanup is cl8y-agent-control, not this repo.

## Failure modes

| Failure | Effect | Mitigation |
|---------|--------|------------|
| Delete root file but leave `docs/` or `.forgejo/` catch-all | Requests still planted | Inventory all three paths before merge. |
| PR 544 stays empty-diff | File remains on `main` | Implementation commit must delete; do not treat the open PR as done. |
| Re-add catch-all in a later PR | Requests planted again; **not** an official-review merge block unless an admin PATCHes protection | Doc + `INV-DEVOPS-544-NO-REINTRODUCE`; review the PR on its merits. |
| Woodpecker context missing or red | Cannot merge | Pre-existing; this issue does not fake statuses or drop the required context. |
| Operator uses `force_merge` | Bypasses reviews/status | Forbidden by forge invariants; do not document it here. |
| Treat this ADR as protection PATCH | Wrong owner | Protection lives in cl8y-forgejo policy scripts. |

## Ordered implementation slices

1. **Docs (this design).** ADR 0001 + overview pointer + CI/invariant stubs. No file delete on the design branch.
2. **Delete catch-all files** on the implementation branch (`chore/remove-catchall-codeowners` / PR 544, or a successor). Confirm the three CODEOWNERS paths are absent.
3. **Clarify CI docs** so GitHub Actions (#322) is not described as the Forgejo merge gate; point at this ADR.
4. **Absence test** (grep / `test ! -f`) for catch-all rules; optional `scripts-smoke` hook. Do not assert protection JSON from product CI (no admin token).
5. **Land** PR 544 with Woodpecker green, SHA-pinned merge, no `force_merge`.

Slice 1 has no yieldomega issue dependency. Slices 2–5 wait on design acceptance. Cross-repo: forge protection for this repo is already applied; do not block the file delete on a second protection PATCH.

## Tests

After the delete slice:

```bash
# No CODEOWNERS at the three Forgejo lookup paths
test ! -e CODEOWNERS && test ! -e docs/CODEOWNERS && test ! -e .forgejo/CODEOWNERS

# No catch-all official-review rule if a file is reintroduced
! git grep -nE '^[[:space:]]*\.\*[[:space:]]+@' -- CODEOWNERS docs/CODEOWNERS .forgejo/CODEOWNERS
```

Optional implementation: a `scripts/check-no-catchall-codeowners.sh` wired like other `scripts-smoke` doc gates. No Foundry, cargo, or Playwright requirement. No browser verification (no UI).

## Rollout

- Design publishes on `cac-design-issue-544` (this branch). Not a design-only product PR.
- Implementation is the CODEOWNERS deletion PR into `main`.
- Rollout is git-only. No deploy, no spend, no custody.

## Rollback

Restore a CODEOWNERS file only via a **new PR** (not force-push to `main`). Restoring `.* @code/maintainers` plants requests again; it does **not** restore the official-review merge block unless an admin PATCHes protection (out of this repo, discouraged).

## Integration completion criteria

- [ ] Root / `docs/` / `.forgejo/` have no catch-all CODEOWNERS.
- [ ] A fresh PR that touches an arbitrary path does not auto-request `@code/maintainers`.
- [ ] `main` protection still matches the outcome table (no direct push, Woodpecker PR context required, official-review block false, rejected reviews true, approvals 0).
- [ ] This ADR remains the in-repo decision; overview and [ci.md §544](../../testing/ci.md#forgejo-merge-gate-issue-544) point here rather than restating policy.
- [ ] `INV-DEVOPS-544-*` evidence commands pass.
- [ ] No `force_merge`, no direct `main`, no protection PATCH from product CI.

## Authority

Ordinary design. Not deploy, spend, custody, or policy expansion under [cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297). Forge merge-policy authority stays in cl8y-forgejo; this ADR only describes the yieldomega tree.
