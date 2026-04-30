// SPDX-License-Identifier: AGPL-3.0-only

import { configuredChain } from "@/lib/chain";
import { useSwitchChain } from "wagmi";

type Props = {
  className?: string;
};

/** Calls EIP-3326 [`wallet_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-3326) for `{@link configuredChain}`. */
export function SwitchToTargetChainButton({ className }: Props) {
  const target = configuredChain();
  const { switchChainAsync, isPending } = useSwitchChain();

  return (
    <button
      type="button"
      className={className ?? "btn-primary"}
      disabled={Boolean(isPending || !switchChainAsync)}
      data-testid="switch-to-target-chain"
      onClick={() => void switchChainAsync?.({ chainId: target.id }).catch(() => undefined)}
    >
      {isPending ? "Switching…" : `Switch to ${target.name}`}
    </button>
  );
}
