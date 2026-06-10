// SPDX-License-Identifier: AGPL-3.0-only

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  safepalWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import type { Transport } from "viem";
import { createConfig, mock } from "wagmi";
import {
  configuredChain,
  megaethMainnetOrderedRpcUrls,
  MEGAETH_MAINNET_CHAIN_ID,
  parseCommaSeparatedRpcUrls,
  resolveChainRpcConfig,
} from "@/lib/chain";
import { fallbackHttpUrls, httpWithOptionalRpcDebug, isRpcDebugEnabled } from "@/lib/rpcDebugTransport";

/** Anvil default account #0 — matches DeployDev when using the well-known Anvil private key. */
const ANVIL_DEFAULT_ACCOUNT =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

const targetChain = configuredChain();
/** Single declared chain — avoids viem/wagmi default transports probing mainnet RPCs (issue #81). */
const chains = [targetChain] as const;

const chainId = Number.parseInt(import.meta.env.VITE_CHAIN_ID || "31337", 10);
const initialChain =
  chains.find((c) => c.id === chainId) ?? targetChain;

const envRpcUrls = parseCommaSeparatedRpcUrls(import.meta.env.VITE_RPC_URL);
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const useE2EMockWallet = import.meta.env.VITE_E2E_MOCK_WALLET === "1";

function browserHasInjectedProvider(): boolean {
  if (typeof window === "undefined") return true;
  return Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

/** Anvil local dev without Rabby/MetaMask (e.g. Cursor Glass preview) — same mock connector as E2E. */
const useAnvilDevMockWallet =
  useE2EMockWallet ||
  (import.meta.env.DEV && chainId === 31337 && !browserHasInjectedProvider());

if (isRpcDebugEnabled()) {
  console.info("[yieldomega/rpc] VITE_RPC_DEBUG=1 — logging each JSON-RPC request and fallback switches");
}

if (!projectId && !useAnvilDevMockWallet) {
  console.info(
    "[yieldomega] VITE_WALLETCONNECT_PROJECT_ID is empty — using injected-detection wallets only (no WalletConnect mobile flow). Set the env var to enable mobile WC. See GitLab #203.",
  );
}

if (useAnvilDevMockWallet && !useE2EMockWallet) {
  console.info(
    "[yieldomega] No browser wallet extension — using Anvil dev mock connector (account #0). Import Rabby or set VITE_E2E_MOCK_WALLET=1 to override.",
  );
}

function transportFor(chain: (typeof chains)[number]) {
  if (chain.id === MEGAETH_MAINNET_CHAIN_ID) {
    const { defaultRpcHttp } = resolveChainRpcConfig(
      import.meta.env.VITE_CHAIN_ID,
      import.meta.env.VITE_RPC_URL,
    );
    const base = envRpcUrls.length > 0 ? envRpcUrls : [defaultRpcHttp];
    const urls = megaethMainnetOrderedRpcUrls(base);
    return fallbackHttpUrls(urls);
  }
  if (chain.id !== initialChain.id) {
    return httpWithOptionalRpcDebug(undefined, 0, 1);
  }
  if (envRpcUrls.length === 0) {
    return httpWithOptionalRpcDebug(undefined, 0, 1);
  }
  return fallbackHttpUrls(envRpcUrls);
}

const transports = Object.fromEntries(
  chains.map((c) => [c.id, transportFor(c)] as const),
) as Record<(typeof chains)[number]["id"], Transport>;

/** RainbowKit default “Popular” list omits SafePal; include it so extension + mobile WC flows match [issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58). */
const rainbowKitWalletGroups = [
  {
    groupName: "Popular",
    wallets: [
      safeWallet,
      rainbowWallet,
      baseAccount,
      metaMaskWallet,
      safepalWallet,
      walletConnectWallet,
    ],
  },
];

function anvilMockWagmiConfig() {
  return createConfig({
    chains,
    connectors: [
      mock({
        accounts: [ANVIL_DEFAULT_ACCOUNT],
        features: { defaultConnected: true, reconnect: true },
      }),
    ],
    transports,
    ssr: false,
    pollingInterval: { [MEGAETH_MAINNET_CHAIN_ID]: 1000 },
  });
}

/**
 * Playwright Anvil E2E (`VITE_E2E_MOCK_WALLET=1`) and local Anvil dev without an extension:
 * wagmi `mock` connector forwards JSON-RPC to the chain URL. Do not ship production builds
 * with `VITE_E2E_MOCK_WALLET=1`.
 */
export const wagmiConfig = useAnvilDevMockWallet
  ? anvilMockWagmiConfig()
  : projectId
    ? getDefaultConfig({
        appName: "Yield Omega",
        projectId,
        chains,
        transports,
        ssr: false,
        multiInjectedProviderDiscovery: true,
        wallets: rainbowKitWalletGroups,
        /** Floors viem client polling on MegaETH so incidental `watch*` helpers do not outrun 1 req/s. */
        pollingInterval: { [MEGAETH_MAINNET_CHAIN_ID]: 1000 },
      })
    : getDefaultConfig({
        appName: "Yield Omega",
        // Placeholder projectId for local dev without WalletConnect. Never reaches a real WC server because walletConnectWallet is omitted from the wallets list below. See GitLab #203.
        projectId: "yieldomega-local-no-walletconnect",
        chains,
        transports,
        ssr: false,
        multiInjectedProviderDiscovery: true,
        wallets: [
          {
            groupName: "Popular",
            wallets: [safeWallet, metaMaskWallet, safepalWallet],
          },
        ],
        pollingInterval: { [MEGAETH_MAINNET_CHAIN_ID]: 1000 },
      });
