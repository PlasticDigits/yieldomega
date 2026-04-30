import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import type { ReactNode } from "react";
import { wagmiConfig } from "@/wagmi-config";
import { AudioEngineProvider } from "@/audio/AudioEngineProvider";
import { IndexerConnectivityProvider } from "@/providers/IndexerConnectivityContext";

// SPDX-License-Identifier: AGPL-3.0-only

const queryClient = new QueryClient();

const arcadeWalletTheme = lightTheme({
  accentColor: "#0f7a47",
  accentColorForeground: "#ffffff",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={arcadeWalletTheme}>
          <IndexerConnectivityProvider>
            <AudioEngineProvider>{children}</AudioEngineProvider>
          </IndexerConnectivityProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
