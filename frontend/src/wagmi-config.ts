import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  safepalWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, mock } from "wagmi";
import { injected } from "wagmi/connectors";
import { configuredChain } from "@/lib/chain";

// SPDX-License-Identifier: AGPL-3.0-only

/** Anvil default account #0 — matches DeployDev when using the well-known Anvil private key. */
const ANVIL_DEFAULT_ACCOUNT =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

const targetChain = configuredChain();
/** Single declared chain — avoids viem/wagmi default transports probing mainnet RPCs (issue #81). */
const chains = [targetChain] as const;

const chainId = Number.parseInt(import.meta.env.VITE_CHAIN_ID || "31337", 10);
const initialChain =
  chains.find((c) => c.id === chainId) ?? targetChain;

const rpcOverride = import.meta.env.VITE_RPC_URL?.trim();
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const useE2EMockWallet = import.meta.env.VITE_E2E_MOCK_WALLET === "1";

if (!projectId && !useE2EMockWallet) {
  console.info(
    "[yieldomega] VITE_WALLETCONNECT_PROJECT_ID is empty — using injected wallets only (no WalletConnect / Reown). Set the env var for mobile WalletConnect.",
  );
}

function transportFor(chain: (typeof chains)[number]) {
  if (rpcOverride && chain.id === initialChain.id) {
    return http(rpcOverride);
  }
  return http();
}

const transports = Object.fromEntries(
  chains.map((c) => [c.id, transportFor(c)] as const),
) as Record<(typeof chains)[number]["id"], ReturnType<typeof http>>;

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

/**
 * Playwright Anvil E2E only: wagmi `mock` connector forwards JSON-RPC to the chain URL (see
 * `@wagmi/core` mock connector). MegaETH behavior still differs; do not ship production builds
 * with `VITE_E2E_MOCK_WALLET=1`.
 */
export const wagmiConfig = useE2EMockWallet
  ? createConfig({
      chains,
      connectors: [
        mock({
          accounts: [ANVIL_DEFAULT_ACCOUNT],
          features: { defaultConnected: true, reconnect: true },
        }),
      ],
      transports,
      ssr: false,
    })
  : projectId
    ? getDefaultConfig({
        appName: "YieldOmega",
        projectId,
        chains,
        transports,
        ssr: false,
        multiInjectedProviderDiscovery: true,
        wallets: rainbowKitWalletGroups,
      })
    : createConfig({
        chains,
        connectors: [injected()],
        transports,
        ssr: false,
        multiInjectedProviderDiscovery: true,
      });
