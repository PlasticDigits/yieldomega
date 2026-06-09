// SPDX-License-Identifier: AGPL-3.0-only

import { ConnectButton } from "@rainbow-me/rainbowkit";

type Props = {
  /** Visible label before CSS uppercase (default "Connect"). */
  label?: string;
};

/**
 * Pill-style empty state that opens the global RainbowKit connect modal.
 * Matches `EmptyDataPlaceholder` styling so wallet-gated stats stay compact.
 */
export function ConnectWalletPlaceholder({ label = "Connect" }: Props) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        return (
          <button
            type="button"
            className="empty-data-placeholder empty-data-placeholder--connect"
            onClick={ready ? openConnectModal : undefined}
            disabled={!ready}
            aria-label="Connect wallet"
          >
            {label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
