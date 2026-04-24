# Wallet connection (EVM)

**Issue:** [GitLab #58 — SafePal / WalletConnect](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58)

The app uses **RainbowKit** + **wagmi** (`frontend/src/wagmi-config.ts`). Participant-facing connect surfaces use `<ConnectButton.Custom>` in the header and [`WalletConnectButton`](../../frontend/src/components/WalletConnectButton.tsx) on pages such as TimeCurve Simple ([`timecurve-views.md`](timecurve-views.md)).

## Configuration invariants

1. **`VITE_WALLETCONNECT_PROJECT_ID`** — Public WalletConnect Cloud project id ([`.env.example`](../../frontend/.env.example)). When **set**, RainbowKit receives **WalletConnect** metadata and the connector list below (including **SafePal**). When **empty** (and not E2E mock mode), the build uses **injected-only** wagmi config: browser extension / `window.ethereum` only — **no** QR / mobile WalletConnect, so many mobile wallets cannot pair through the modal.
2. **Chains** — `configuredChain()` (from `VITE_CHAIN_ID` / `VITE_RPC_URL`) plus **reference** `mainnet` and `sepolia` for reads/switching. The **dapp’s declared chains** must include the chain the user selects in the wallet or sessions can fail after connect.
3. **`multiInjectedProviderDiscovery: true`** — Enables **EIP-6963** multi-wallet discovery in the browser (wagmi), so more than one injected provider can appear reliably when multiple extensions are installed.
4. **SafePal in the modal** — RainbowKit’s stock `getDefaultConfig` “Popular” group does **not** include `safepalWallet`. YieldOmega passes an explicit wallet group that adds **`safepalWallet`** before **`walletConnectWallet`**. SafePal’s RainbowKit connector uses **injected** `safepalProvider` / `isSafePal` when the extension is present, otherwise **WalletConnect** with SafePal mobile deep links.

## Manual verification (post-deploy)

- **Extension:** SafePal browser extension installed → open connect modal → **SafePal Wallet** visible and connects on the target chain.
- **Mobile:** With a valid project id, choose SafePal (WalletConnect path) → QR / deep link opens the app and completes session on the correct network.

## Agent / contributor cross-links

- Test matrix: [`docs/testing/strategy.md`](../testing/strategy.md), invariant summary: [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#wallet-connect-ux-issue-58).
- Play skills (participants): [`skills/README.md`](../../skills/README.md).
- Contributor guardrails: [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).
