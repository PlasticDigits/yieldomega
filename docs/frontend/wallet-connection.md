# Wallet connection (EVM)

**Issues:** [GitLab #58 — SafePal / WalletConnect](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58), [GitLab #81 — single-chain wagmi (no incidental mainnet RPC)](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81), [GitLab #95 — wrong-chain write gating (`VITE_CHAIN_ID` match)](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95), [GitLab #120 — AccessControl zero admin (deploy vs derived UX layers)](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120), [GitLab #144 — wallet session continuity during multi-step buy](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144), [GitLab #143 — ERC-20 approval sizing vs H-01](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143), [GitLab #97 — `:focus-visible` / WCAG 2.4.7](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97), [GitLab #98 — canonical address display + explorer base](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98)

The app uses **RainbowKit** + **wagmi** (`frontend/src/wagmi-config.ts`). Participant-facing connect surfaces use `<ConnectButton.Custom>` in the header and [`WalletConnectButton`](../../frontend/src/components/WalletConnectButton.tsx) on pages such as TimeCurve Simple ([`timecurve-views.md`](timecurve-views.md)).

## Configuration invariants

1. **`VITE_WALLETCONNECT_PROJECT_ID`** — Public WalletConnect Cloud project id ([`.env.example`](../../frontend/.env.example)). When **set**, RainbowKit receives **WalletConnect** metadata and the connector list below (including **SafePal**). When **empty** (and not E2E mock mode), the build uses **injected-only** wagmi config: browser extension / `window.ethereum` only — **no** QR / mobile WalletConnect, so many mobile wallets cannot pair through the modal.
2. **Chains — exactly one declared chain** — [`configuredChain()`](../../frontend/src/lib/chain.ts) from `VITE_CHAIN_ID` / `VITE_RPC_URL`. Default when unset: **Anvil `31337`** with `http://127.0.0.1:8545`. We **do not** register Ethereum `mainnet` / `sepolia` alongside the target chain: extra chains caused wagmi/viem to open default transports (e.g. `eth.merkle.io`) even when the wallet was on local Anvil ([#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)). Operators set env to the deployment network; participants must switch the wallet to that network to transact.
3. **`multiInjectedProviderDiscovery: true`** — Enables **EIP-6963** multi-wallet discovery in the browser (wagmi), so more than one injected provider can appear reliably when multiple extensions are installed.
4. **SafePal in the modal** — RainbowKit’s stock `getDefaultConfig` “Popular” group does **not** include `safepalWallet`. YieldOmega passes an explicit wallet group that adds **`safepalWallet`** before **`walletConnectWallet`**. SafePal’s RainbowKit connector uses **injected** `safepalProvider` / `isSafePal` when the extension is present, otherwise **WalletConnect** with SafePal mobile deep links.
5. **Keyboard focus in RainbowKit chrome** — RainbowKit’s internal reset applies **`outline: none`** to interactive nodes under **`[data-rk]`** with higher specificity than an unscoped **`button:focus-visible`** rule. Global styles in [`index.css`](../../frontend/src/index.css) therefore duplicate **`:focus-visible`** outline rules under **`[data-rk]`** so Tab navigation shows a visible ring in the connect / account modal (WCAG 2.4.7; [#97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)). Token: **`--yo-focus-ring`** on **`:root`**.

<a id="accesscontrol-zero-admin-deployment-gitlab-120"></a>

### AccessControl zero admin — frontend derived layer ([GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120))

Contracts enforce **`INV-AC-ZERO-ADMIN-120`** onchain — [fee-routing — Deployer / EVM boundary](../onchain/fee-routing-and-governance.md#deployer-evm-boundary-gitlab-120).

**INV-FRONTEND-120-DEPLOY:** The app **does not** add an HTTP or wallet call that proves **`DEFAULT_ADMIN_ROLE`** sits on a non-zero admin **before** showing protocol pages—it assumes **`VITE_*` proxies** belong to deployments that passed **`constructor`/`initializer`** checks. Operators still verify deployments with **`FOUNDRY_PROFILE=ci forge test`** (**[`AccessControlZeroAdmin.t.sol`](../../contracts/test/AccessControlZeroAdmin.t.sol)**) and sane env hygiene (proxy vs implementation addresses per [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). The indexer likewise has **no** event stream for “zero admin”: **[`INV-INDEXER-120-DEPLOY`](../testing/invariants-and-business-logic.md#indexer-accesscontrol-deploy-footgun-gitlab-120)**.

**Contributor:** [manual QA — #120](../testing/manual-qa-checklists.md#manual-qa-issue-120-accesscontrol-zero-admin-derived-layers), [invariants — #120 § derived layers](../testing/invariants-and-business-logic.md#accesscontrol-zero-admin-deployments-gitlab-120).

<a id="block-explorer-base-url-gitlab-98"></a>

### Block explorer base URL (issue #98)

**`VITE_EXPLORER_BASE_URL`** (optional, see [`frontend/.env.example`](../../frontend/.env.example)) sets the **single** HTTP origin for outbound **tx** and **address** explorer pages. Helpers: [`explorerTxUrl`](../../frontend/src/lib/explorer.ts) (`/tx/{hash}`), [`explorerAddressUrl`](../../frontend/src/lib/explorer.ts) (`/address/{address}`). Default when unset: **`https://mega.etherscan.io`**. Trailing slashes on the env value are stripped.

Participant-facing **wallet / contract identities** use [`AddressInline`](../../frontend/src/components/AddressInline.tsx) (blockie + label + link). Fee-sink monospace rows use [`MegaScannerAddressLink`](../../frontend/src/components/MegaScannerAddressLink.tsx), which shares the same URL builder. **Contributor manual QA:** [`docs/testing/manual-qa-checklists.md#manual-qa-issue-98`](../testing/manual-qa-checklists.md#manual-qa-issue-98); invariants: [§ #98](../testing/invariants-and-business-logic.md#canonical-address-display-gitlab-98).

<a id="wrong-network-write-gating-issue-95"></a>

### Wrong-network write gating (issue #95)

RainbowKit can surface **Wrong Network** while the app still exposes **`writeContract`** CTAs (`Buy CHARM`, WarBow steals, **`/referrals`** register, **`/vesting`** `claim()`, …). YieldOmega aligns the **canonical target `chainId`** with **`VITE_CHAIN_ID`** and **`VITE_RPC_URL`** via **`resolveChainRpcConfig`** ([`configuredTargetChainId()`](../../frontend/src/lib/chain.ts); default **Anvil 31337** — [`frontend/.env.example`](../../frontend/.env.example)). While connected and **`useChainId()`** mismatches:

- **`ChainMismatchWriteBarrier`** overlays the gated panels (still readable underneath with dimmed backdrop).
- **`SwitchToTargetChainButton`** calls wagmi **`switchChain`** (EIP-3326 **`wallet_switchEthereumChain`**).
- **`chainMismatchWriteMessage`** returns early from submit handlers (**defense in depth**). **`/vesting`** **`claim`** additionally sets local error state so the same message appears **in the wallet panel** if the click races a network switch ([GitLab #106](https://gitlab.com/PlasticDigits/yieldomega/-/issues/106)).
- **RPC privacy:** When **`/vesting`** **`claim`** (and other paths using **`friendlyRevertFromUnknown`**) surface provider failures, user-visible text **redacts** **`VITE_RPC_URL`** and common hosted-RPC URL patterns so API keys are not echoed ([GitLab #145](https://gitlab.com/PlasticDigits/yieldomega/-/issues/145); [`presale-vesting.md`](presale-vesting.md), [`revertMessage.ts`](../../frontend/src/lib/revertMessage.ts)).

**Out of scope:** **`ThirdPartyDexPage`** (`/kumbaya`, `/sir`) outbound venue links — not ABI writes emitted by this app.

<a id="wallet-session-continuity-during-buy-gitlab-144"></a>

### Wallet session continuity during multi-step buy (issue #144)

ETH/USDM paths run **`quoteExactOutput`**, wraps/approvals, **`exactOutput`** swaps, CL8Y **`approve`**, and **`TimeCurve.buy`** across **multiple** awaits. **`submitBuy`** / Arena **`handleBuy`** latch **`getAccount(wagmi)`** immediately after submit-time sizing ([`captureWalletBuySession`](../../frontend/src/lib/walletBuySessionGuard.ts)); after **each** async boundary they call **`walletBuySessionDriftMessage`** / **`assertWalletBuySessionUnchanged`**. If the user **disconnects**, switches **accounts**, or changes **`chainId`** mid-flow, the handler **aborts** with **`Wallet or network changed during purchase — please retry from the beginning.`** — complementary to wrong-chain **preflight** ([#95](#wrong-network-write-gating-issue-95)), which covers “started on wrong chain,” not “went stable → drifted mid-purchase.” [`submitKumbayaSingleTxBuy`](../../frontend/src/lib/timeCurveKumbayaSingleTx.ts) takes the same **`sessionSnapshot`** for internal awaits.

**Automated:** [`walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts). **Manual QA:** [`manual-qa-checklists.md — #144`](../testing/manual-qa-checklists.md#manual-qa-issue-144-wallet-session-drift-on-buy).

<a id="erc20-approval-sizing-h-01-gitlab-143"></a>

### ERC-20 approval sizing vs proxy-upgrade risk (GitLab #143)

[GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143) (split from [#138 — pre-deploy review](https://gitlab.com/PlasticDigits/yieldomega/-/issues/138), Finding 5) replaces **silent `maxUint256`** defaults on in-app **`approve`** calls with **exact sizing** where the spend is known, and documents residual risk vs audit **H-01** (privileged upgrade could alter economics; unlimited allowances amplify blast radius).

| Path | Approval target | Default `approve` amount |
|------|-----------------|--------------------------|
| Kumbaya **two-step** | `WETH` / **USDM** → **`swapRouter`** | Slippage-bounded **`maxIn`** for that swap leg ([`swapMaxInputFromQuoted`](../../frontend/src/lib/timeCurveKumbayaSwap.ts)) |
| Kumbaya **single-tx** `buyViaKumbaya` | **USDM** → **`TimeCurveBuyRouter`** | Same **`maxIn`** for the quoted leg |
| **`/referrals`** `registerCode` | **CL8Y** → **`ReferralRegistry`** | Onchain **`registrationBurnAmount`** exactly |
| **`TimeCurve.buy`** / WarBow **CL8Y** pulls | **CL8Y** → **`TimeCurve` (proxy)** | **Exact** gross CL8Y needed for the pending tx |

**Opt-in unlimited CL8Y → TimeCurve:** [`Cl8yTimeCurveUnlimitedApprovalFieldset`](../../frontend/src/components/Cl8yTimeCurveUnlimitedApprovalFieldset.tsx) on TimeCurve **Simple** and **Arena** buy panels stores **`yieldomega.erc20.cl8yTimeCurveUnlimited.v1`** in **`localStorage`** and, when enabled, uses **`type(uint256).max`** for that spender. Toggling off does **not** revoke an existing onchain allowance — participants revoke in their wallet if needed.

**Spec ↔ test:** [`INV-ERC20-APPROVAL-143`](../testing/invariants-and-business-logic.md#frontend-erc20-approval-sizing-gitlab-143) · [`cl8yTimeCurveApprovalPreference.test.ts`](../../frontend/src/lib/cl8yTimeCurveApprovalPreference.test.ts) · [timecurve-views §143](timecurve-views.md#erc20-approval-sizing-gitlab-143).

## Manual verification (post-deploy)

- **Extension:** SafePal browser extension installed → open connect modal → **SafePal Wallet** visible and connects on the target chain.
- **Mobile:** With a valid project id, choose SafePal (WalletConnect path) → QR / deep link opens the app and completes session on the correct network.

## Agent / contributor cross-links

- Test matrix: [`docs/testing/strategy.md`](../testing/strategy.md), invariant summary: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#wallet-connect-ux-issue-58) ([issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58)), single-chain wagmi: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#frontend-single-chain-wagmi-issue-81) ([issue #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)), AccessControl zero-admin derived UX / indexer layers: [#120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120) — [§ #120](#accesscontrol-zero-admin-deployment-gitlab-120), [invariants § #120 derived IDs](../testing/invariants-and-business-logic.md#accesscontrol-zero-admin-deployments-gitlab-120), [manual QA (#120)](../testing/manual-qa-checklists.md#manual-qa-issue-120-accesscontrol-zero-admin-derived-layers); wrong-chain writes: [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) — [invariants § #95](../testing/invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95), [manual QA checklist](../testing/manual-qa-checklists.md#manual-qa-issue-95); mid-buy wallet/session drift: [#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144) — [wallet-connection § #144](../frontend/wallet-connection.md#wallet-session-continuity-during-buy-gitlab-144), [invariants § #144](../testing/invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144), [manual QA (#144)](../testing/manual-qa-checklists.md#manual-qa-issue-144-wallet-session-drift-on-buy), focus-visible / WCAG 2.4.7: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97) ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)), canonical addresses / explorer base: [#98](https://gitlab.com/PlasticDigits/yieldomega/-/issues/98) — [invariants § #98](../testing/invariants-and-business-logic.md#canonical-address-display-gitlab-98), [manual QA checklist](../testing/manual-qa-checklists.md#manual-qa-issue-98).
- Play skills (participants): [`skills/README.md`](../../skills/README.md).
- Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).
- ERC-20 **`approve` sizing** (exact vs opt-in unlimited CL8Y → TimeCurve): [§ GitLab #143](#erc20-approval-sizing-h-01-gitlab-143) · [invariants — #143](../testing/invariants-and-business-logic.md#frontend-erc20-approval-sizing-gitlab-143).
