# Presale vesting (`/vesting`)

**Contract:** [`DoubPresaleVesting`](../../contracts/src/vesting/DoubPresaleVesting.sol) (UUPS proxy address is canonical — [GitLab #54](https://gitlab.com/PlasticDigits/yieldomega/-/issues/54), [GitLab #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

**Route:** [`/vesting`](../../frontend/src/pages/PresaleVestingPage.tsx) — **intentionally omitted** from the global header nav; participants use a **direct link** ([GitLab #92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)).

## Build-time configuration

| Variable | Role |
|----------|------|
| `VITE_DOUB_PRESALE_VESTING_ADDRESS` | ERC-1967 **proxy** for `DoubPresaleVesting` |

Local one-shot stack: [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) parses **`DoubPresaleVesting:`** from the `DeployDev` log and writes the line into `frontend/.env.local` together with other `VITE_*` addresses.

Anvil Playwright: [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) exports the same variable after deploy.

## UX invariants

- **Schedule copy** reflects onchain rules: **30%** at `vestingStart`, **70%** linear over `vestingDuration` (canonical presale bucket: **180 days** — see [`PARAMETERS.md`](../../contracts/PARAMETERS.md)).
- **Clock:** **vestingStart** and **vestingStart + vestingDuration** are shown in the browser’s **local** timezone and in **UTC**.
- **Wallet panel:** **allocation**, **claimed**, **claimable** via `allocationOf` / `claimedOf` / `claimable` (`claimable` uses chain `block.timestamp` on read).
- **Claim CTA:** gated on `claimsEnabled` and non-zero `claimable` ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)).
- **Wrong-chain guard:** **`useChainId()`** must equal [**`configuredTargetChainId()`**](../../frontend/src/lib/chain.ts) (`VITE_CHAIN_ID`; default **Anvil 31337**) before **`claim()`** prompts — overlay + EIP-3326 switch CTA ([issue #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)). **Race:** if **`claim`** fires while mismatched, **`chainMismatchWriteMessage`** copy is shown as an error **`StatusMessage`** above the button ([GitLab #106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106)).

## Cross-links

- [Final signoff / `claimsEnabled`](../operations/final-signoff-and-value-movement.md)
- [Invariant map — presale vesting frontend](../testing/invariants-and-business-logic.md#presale-vesting-frontend-gitlab-92) · [§ #106 claim chain preflight](../testing/invariants-and-business-logic.md#presale-vesting-claim-chain-preflight-gitlab-106)
- Play checklist: [`../testing/manual-qa-checklists.md#manual-qa-issue-92`](../testing/manual-qa-checklists.md#manual-qa-issue-92)
- Wrong-network write gate (#95): [`wallet-connection.md` § #95](wallet-connection.md#wrong-network-write-gating-issue-95); play checklist [`../testing/manual-qa-checklists.md#manual-qa-issue-95`](../testing/manual-qa-checklists.md#manual-qa-issue-95)
- Claim chain mismatch UX (#106): [`../testing/manual-qa-checklists.md#manual-qa-issue-106`](../testing/manual-qa-checklists.md#manual-qa-issue-106)
