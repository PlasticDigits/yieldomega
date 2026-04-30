// SPDX-License-Identifier: AGPL-3.0-only

import type { PropsWithChildren, ReactNode } from "react";
import { SwitchToTargetChainButton } from "@/components/SwitchToTargetChainButton";
import { useWalletTargetChainMismatch } from "@/hooks/useWalletTargetChainMismatch";
import { configuredChain } from "@/lib/chain";

type Props = PropsWithChildren & {
  className?: string;
  /** Overrides default explanatory copy inside the overlay. */
  overlayBody?: ReactNode;
  /** `data-testid` on root wrapper (surface-level E2E hooks). */
  testId?: string;
};

/**
 * Option C ([GitLab #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)): dims write surfaces until the wallet
 * `chainId` matches [`configuredTargetChainId`](lib/chain.ts) from **`VITE_CHAIN_ID`** (default Anvil **`31337`** when unset —
 * see [`frontend/.env.example`](../../.env.example)). Pair with **`SwitchToTargetChainButton`** (EIP-3326 switch).
 */
export function ChainMismatchWriteBarrier({
  children,
  className,
  overlayBody,
  testId,
}: Props) {
  const { mismatch } = useWalletTargetChainMismatch();
  const meta = configuredChain();

  return (
    <div className={["chain-write-gate", className].filter(Boolean).join(" ")} data-testid={testId}>
      {children}
      {mismatch ? (
        <div className="chain-write-gate__overlay" role="presentation">
          <div className="chain-write-gate__card" role="dialog" aria-modal="true" aria-label="Wrong network for writes">
            <p className="chain-write-gate__title">Wrong network</p>
            {overlayBody ?? (
              <p className="chain-write-gate__body">
                This build targets <strong>{meta.name}</strong> (<strong>chain {meta.id}</strong>). Signing here on your
                current network would ship calldata that belongs on chain {meta.id} — switch before you transact (issue
                #95).
              </p>
            )}
            <SwitchToTargetChainButton className="btn-primary chain-write-gate__switch" />
            <p className="chain-write-gate__hint muted">You can also switch manually in your wallet extension.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
