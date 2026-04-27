---
name: verify-yo-timecurve-post-end-gates
description: Live Anvil evidence for TimeCurve post-end owner gates (GitLab #79) — charm redemption and reserve podium payouts after endSale — aligned with issue #55 and scripts/verify-timecurve-post-end-gates-anvil.sh.
---

# Verify TimeCurve post-end gates (issue #79)

Use this skill when an agent or human needs **cast-level evidence** for the **four-row** checklist in [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79): `redeemCharms` and `distributePrizes` **with gates off**, then **owner enables** and **success**, on a chain where **`TimeCurve.ended == true`**.

## Authoritative docs (read first)

- [`docs/operations/final-signoff-and-value-movement.md`](../../docs/operations/final-signoff-and-value-movement.md) — onchain gates ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)).
- [`docs/testing/invariants-and-business-logic.md` — TimeCurve post-end gates (issue #79)](../../docs/testing/invariants-and-business-logic.md#timecurve-post-end-gates-live-anvil-gitlab-79).
- [`docs/testing/anvil-rich-state.md` — Post-end gate walkthrough](../../docs/testing/anvil-rich-state.md#post-end-gate-walkthrough-issue-55--gitlab-79).

## Preconditions

- **Anvil** with `--code-size-limit 524288` and **31337** DeployDev (TimeCurve **proxy** address — not `run-latest.json` implementation row; see [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).
- **Fresh chain** (or at least no full `anvil_rich_state` Part2 yet): `prizesDistributed` must be **false** before the walkthrough.
- **Owner** key (default Anvil account **#0**) for `setCharmRedemptionEnabled` / `setReservePodiumPayoutsEnabled`.

## One-command setup (preferred)

From repo root:

```bash
export RPC_URL=http://127.0.0.1:8545
ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh
bash scripts/verify-timecurve-post-end-gates-anvil.sh
```

`ANVIL_RICH_END_SALE_ONLY=1` runs Part1 + warp + **`SimulateAnvilRichStatePart2EndSaleOnly`** (resets DeployDev convenience flags, then `endSale()`), **not** full Part2.

## Rows (evidence checklist)

| Row | What to verify | Suggested evidence |
|-----|----------------|-------------------|
| **1** | `redeemCharms` reverts with **`TimeCurve: charm redemptions disabled`** when the gate is off | `cast send` tx or simulation output showing revert string |
| **2** | Owner **`setCharmRedemptionEnabled(true)`** → same buyer **`redeemCharms`** succeeds | Success tx hash + optional `CharmsRedeemed` log |
| **3** | `distributePrizes` reverts with **`TimeCurve: reserve podium payouts disabled`** when pool **> 0** and gate off | Revert output |
| **4** | Owner **`setReservePodiumPayoutsEnabled(true)`** → **`distributePrizes`** succeeds | Success tx hash + `prizesDistributed == true` |

## Manual fallback

If [`scripts/verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) fails, run the same `cast send` sequence by hand. Confirm `acceptedAsset.balanceOf(podiumPool) > 0` before row 3. If the full rich script already ran, **reset** the chain (new anvil) — Part2 sets `prizesDistributed` and enables gates.

## Automated regression (contributors)

- Forge: `TimeCurve.t.sol` — `test_redeemCharms_reverts_while_charm_redemption_disabled`, `test_distributePrizes_reverts_while_reserve_podium_payouts_disabled` (see invariants test map).
- The **verify script** is an optional **local** check; it does not replace **forge** tests in CI.

## Agent phase

[Phase 20 — Play the ecosystem](../../docs/agent-phases.md#phase-20) for evidence gathering; [Phase 14 — Testing strategy](../../docs/agent-phases.md#phase-14) for script or contract changes.
