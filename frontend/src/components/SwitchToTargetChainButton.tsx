// SPDX-License-Identifier: AGPL-3.0-only

import { configuredChain } from "@/lib/chain";
import { useSwitchChain, useConfig } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { useState } from "react";

type Props = {
  className?: string;
};

/** Calls EIP-3326 [`wallet_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-3326) for `{@link configuredChain}`. */
export function SwitchToTargetChainButton({ className }: Props) {
  const target = configuredChain();
  const wagmiConfig = useConfig();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const [adding, setAdding] = useState(false);

  const handleSwitch = async () => {
    if (!switchChainAsync) return;
    try {
      await switchChainAsync({ chainId: target.id });
      return;
    } catch {
      // Chain may be missing from the wallet — register MegaETH RPC then retry.
    }
    setAdding(true);
    try {
      const walletClient = await getWalletClient(wagmiConfig);
      if (!walletClient) return;
      await walletClient.addChain({ chain: target });
      await switchChainAsync({ chainId: target.id });
    } catch {
      // User rejected or wallet blocked the request.
    } finally {
      setAdding(false);
    }
  };

  const pending = switchPending || adding;

  return (
    <button
      type="button"
      className={className ?? "btn-primary"}
      disabled={Boolean(pending || !switchChainAsync)}
      data-testid="switch-to-target-chain"
      onClick={() => void handleSwitch()}
    >
      {pending ? "Switching…" : `Switch to ${target.name}`}
    </button>
  );
}
