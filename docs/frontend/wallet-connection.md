# Wallet connection (EVM)

**Issues:** [GitLab #58 — SafePal / WalletConnect](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58), [GitLab #81 — single-chain wagmi (no incidental mainnet RPC)](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81), [GitLab #97 — `:focus-visible` / WCAG 2.4.7](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)

The app uses **RainbowKit** + **wagmi** (`frontend/src/wagmi-config.ts`). Participant-facing connect surfaces use `<ConnectButton.Custom>` in the header and [`WalletConnectButton`](../../frontend/src/components/WalletConnectButton.tsx) on pages such as TimeCurve Simple ([`timecurve-views.md`](timecurve-views.md)).

## Configuration invariants

1. **`VITE_WALLETCONNECT_PROJECT_ID`** — Public WalletConnect Cloud project id ([`.env.example`](../../frontend/.env.example)). When **set**, RainbowKit receives **WalletConnect** metadata and the connector list below (including **SafePal**). When **empty** (and not E2E mock mode), the build uses **injected-only** wagmi config: browser extension / `window.ethereum` only — **no** QR / mobile WalletConnect, so many mobile wallets cannot pair through the modal.
2. **Chains — exactly one declared chain** — [`configuredChain()`](../../frontend/src/lib/chain.ts) from `VITE_CHAIN_ID` / `VITE_RPC_URL`. Default when unset: **Anvil `31337`** with `http://127.0.0.1:8545`. We **do not** register Ethereum `mainnet` / `sepolia` alongside the target chain: extra chains caused wagmi/viem to open default transports (e.g. `eth.merkle.io`) even when the wallet was on local Anvil ([#81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)). Operators set env to the deployment network; participants must switch the wallet to that network to transact.
3. **`multiInjectedProviderDiscovery: true`** — Enables **EIP-6963** multi-wallet discovery in the browser (wagmi), so more than one injected provider can appear reliably when multiple extensions are installed.
4. **SafePal in the modal** — RainbowKit’s stock `getDefaultConfig` “Popular” group does **not** include `safepalWallet`. YieldOmega passes an explicit wallet group that adds **`safepalWallet`** before **`walletConnectWallet`**. SafePal’s RainbowKit connector uses **injected** `safepalProvider` / `isSafePal` when the extension is present, otherwise **WalletConnect** with SafePal mobile deep links.
5. **Keyboard focus in RainbowKit chrome** — RainbowKit’s internal reset applies **`outline: none`** to interactive nodes under **`[data-rk]`** with higher specificity than an unscoped **`button:focus-visible`** rule. Global styles in [`index.css`](../../frontend/src/index.css) therefore duplicate **`:focus-visible`** outline rules under **`[data-rk]`** so Tab navigation shows a visible ring in the connect / account modal (WCAG 2.4.7; [#97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)). Token: **`--yo-focus-ring`** on **`:root`**.

## Manual verification (post-deploy)

- **Extension:** SafePal browser extension installed → open connect modal → **SafePal Wallet** visible and connects on the target chain.
- **Mobile:** With a valid project id, choose SafePal (WalletConnect path) → QR / deep link opens the app and completes session on the correct network.

## Agent / contributor cross-links

- Test matrix: [`docs/testing/strategy.md`](../testing/strategy.md), invariant summary: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#wallet-connect-ux-issue-58) ([issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58)), single-chain wagmi: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#frontend-single-chain-wagmi-issue-81) ([issue #81](https://gitlab.com/PlasticDigits/yieldomega/-/issues/81)), focus-visible / WCAG 2.4.7: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97) ([issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97)).
- Play skills (participants): [`skills/README.md`](../../skills/README.md).
- Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).
