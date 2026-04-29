# YO DOUB — Launch UX flows (legacy title)

This filename is kept so **F-11** checkpoints in external QA specs and spreadsheets resolve to stable paths in-repo.

## F-10 — Presale vesting UX (`/vesting`)

**Shipping path:** [`/vesting`](frontend/src/pages/PresaleVestingPage.tsx) + onchain **[`DoubPresaleVesting`](contracts/src/vesting/DoubPresaleVesting.sol)** (GitLab [#92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)).

**Nav:** Route is **hidden** from the primary header — participants use a **direct link** (see issue comment).

**Docs:** [presale-vesting.md](docs/frontend/presale-vesting.md), [launchplan §6](launchplan-timecurve.md#6-under-construction-frontend), [invariants — #92](docs/testing/invariants-and-business-logic.md#presale-vesting-frontend-gitlab-92). **Play checklist:** [`skills/verify-yo-presale-vesting/SKILL.md`](skills/verify-yo-presale-vesting/SKILL.md).

---

## F-11 — Non–TimeCurve routes at TGE (under construction vs shipped)

**Invariant:** **`/rabbit-treasury`** and **`/collection`** use **`UnderConstruction`**. **`/referrals`** does **not** — it is the **full** referrals registration, storage-key docs, registry reads, and share-link UX shipped for TimeCurve attribution ([GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)). Removing `/referrals` from the placeholder set matches live routing and QA evidence ([GitLab #91](https://gitlab.com/PlasticDigits/yieldomega/-/issues/91)).

**Canonical doc:** **[`launchplan-timecurve.md`](launchplan-timecurve.md)** — especially **§6 Under construction** and §7 checklist.

**Product + tests:**

- [`docs/product/referrals.md`](docs/product/referrals.md)
- [`docs/testing/invariants-and-business-logic.md`](docs/testing/invariants-and-business-logic.md#referrals-page-visual-issue-64)
- Third-party agent checklist: [`skills/verify-yo-referrals-surface/SKILL.md`](skills/verify-yo-referrals-surface/SKILL.md)

**Agent phase:** Contributor alignment with [`docs/agent-phases.md`](docs/agent-phases.md).
