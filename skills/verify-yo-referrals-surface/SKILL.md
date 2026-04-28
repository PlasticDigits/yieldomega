---
name: verify-yo-referrals-surface
description: Walk the YO Referrals /referrals visual verification checklist (GitLab #64) for agents helping with QA evidence — shell, empty states, register flow, share links, ?ref= capture — aligned with docs/product/referrals.md and Playwright specs. Browser storage keys for R4 vs R7: GitLab #85.
---

# Verify YO Referrals `/referrals` surface (issue #64)

Use this skill when an agent or human needs to **produce evidence** (screenshots or tx hashes) for the **seven-row** checklist tracked in [GitLab #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64). It mirrors **cl8y-ecosystem-qa** `YO-Referrals-Visual-Verification-Checklist.md` scope approved 2026-04-24.

## Authoritative docs (read first)

- [`docs/product/referrals.md`](../../docs/product/referrals.md) — code rules, link capture, **browser storage key table** (pending vs my-code — [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)), `REFERRAL_EACH_BPS` math, onchain authority.
- [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md#referrals-page-visual-issue-64) — automated vs manual rows.
- Contributor Anvil runbook: [`docs/testing/e2e-anvil.md`](../../docs/testing/e2e-anvil.md) (`bash scripts/e2e-anvil.sh`).

## Preconditions

- Frontend built with **`VITE_LAUNCH_TIMESTAMP` in the past** if you need the **post-launch** route tree (`/` → TimeCurve Simple, `/home` → marketing home).
- **`VITE_REFERRAL_REGISTRY_ADDRESS`** set **or** **`VITE_TIMECURVE_ADDRESS`** pointing at a TimeCurve whose **`referralRegistry()`** is non-zero.
- Wallet with **gas + CL8Y** for `registerCode` when exercising R4.
- **Out of scope** for this checklist per #64: leaderboard UI; on-chain reserved-word governance; Kumbaya buy CTA referral plumbing (separate signoff).

## Rows R1–R7 (evidence checklist)

| Row | What to verify | Suggested evidence |
|-----|----------------|-------------------|
| **R1** | `/referrals` renders (hero, sections, `data-testid="referrals-surface"`) behind launch gate | Screenshot |
| **R2** | Connected wallet, **not** yet registered: burn copy + input + CTA | Screenshot |
| **R3** | Disconnected: wallet-gated placeholder | Screenshot |
| **R4** | Approve (if needed) → `registerCode` → success → **`localStorage`** key **`yieldomega.myrefcode.v1.<walletLowercase>`** for “my code” (distinct from pending **`yieldomega.ref.v1`** — [`referralStorage.ts`](../../frontend/src/lib/referralStorage.ts), [GitLab #85](https://gitlab.com/PlasticDigits/yieldomega/-/issues/85)) | Tx hash(es) + screenshot |
| **R5** | Registered: code visible + copy-able **path** and **`?ref=`** URLs | Screenshot |
| **R6** | Copy / share UX (desktop + mobile as applicable) | Screenshot or screen recording |
| **R7** | Land with **`?ref=`** (and optionally `/timecurve/{code}`); pending capture under **`yieldomega.ref.v1`** (local + session) | Screenshot + storage inspector or Playwright trace |

## Automated regression (contributors)

- CI: `frontend/e2e/referrals-surface.spec.ts` (shell + `?ref=`).
- Anvil: `frontend/e2e/anvil-referrals.spec.ts` (register + clipboard).
- Unit: `frontend/src/lib/referralPathCapture.test.ts`.

Failing automation does **not** waive manual rows R3/R6 on real wallets.

## Agent phase

[Phase 20 — Play the ecosystem](../../docs/agent-phases.md#phase-20) for participant-facing verification; contributor wiring changes use [Phase 14 — Testing strategy](../../docs/agent-phases.md#phase-14).
