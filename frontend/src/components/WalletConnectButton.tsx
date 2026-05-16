// SPDX-License-Identifier: AGPL-3.0-only

import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Project-styled wallet connect button (single source of truth).
 *
 * RainbowKit's stock `<ConnectButton />` ships its own button DOM that doesn't
 * inherit the project's `wallet-action wallet-action--connect` style — which
 * leaves in-page connect prompts visually inconsistent with the header (see
 * `RootLayout.tsx`). This component wraps `<ConnectButton.Custom>` so any
 * surface that needs a "connect a wallet" CTA gets the same look as the
 * header without re-implementing the chain-aware account/network state.
 *
 * Use this anywhere a page or panel only needs the **disconnected → open
 * connect modal** action. Header surfaces that also render account / chain
 * pickers should keep their inline `<ConnectButton.Custom>` integration.
 *
 * Pass `label` to override the visible button text (e.g. uppercase panel CTAs).
 */
type WalletConnectButtonProps = {
  /**
   * When set, this is the only visible label (no long/short responsive swap).
   * For in-panel CTAs that need a fixed string (e.g. uppercase copy).
   */
  label?: string;
};

export function WalletConnectButton({ label }: WalletConnectButtonProps) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        if (!ready) {
          return (
            <button
              type="button"
              className="wallet-action wallet-action--connect"
              disabled
              aria-hidden="true"
            >
              Loading wallet
            </button>
          );
        }
        return (
          <button
            type="button"
            className="wallet-action wallet-action--connect wallet-action--priority"
            onClick={openConnectModal}
            aria-label="Connect wallet"
          >
            {label ? (
              <span>{label}</span>
            ) : (
              <>
                <span className="wallet-action__text-long">Connect Wallet</span>
                <span className="wallet-action__text-short">Connect</span>
              </>
            )}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export default WalletConnectButton;
