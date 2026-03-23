import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

// SPDX-License-Identifier: AGPL-3.0-only

const chains = [mainnet, sepolia] as const;

const chainId = Number.parseInt(import.meta.env.VITE_CHAIN_ID || "1", 10);
const initialChain = chains.find((c) => c.id === chainId) ?? mainnet;

const rpcOverride = import.meta.env.VITE_RPC_URL?.trim();
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

if (!projectId) {
  console.warn(
    "[yieldomega] VITE_WALLETCONNECT_PROJECT_ID is empty; WalletConnect may not work. See .env.example.",
  );
}

function transportFor(chain: (typeof chains)[number]) {
  if (rpcOverride && chain.id === initialChain.id) {
    return http(rpcOverride);
  }
  return http();
}

export const wagmiConfig = getDefaultConfig({
  appName: "YieldOmega",
  projectId: projectId || "00000000000000000000000000000000",
  chains,
  transports: {
    [mainnet.id]: transportFor(mainnet),
    [sepolia.id]: transportFor(sepolia),
  },
  ssr: false,
});
