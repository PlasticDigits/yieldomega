import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NavLink, Outlet } from "react-router-dom";
import { useChainId, useChains } from "wagmi";
import { FeeTransparency } from "@/components/FeeTransparency";
import { IndexerStatusBar } from "@/components/IndexerStatusBar";
import { governanceUrl } from "@/lib/addresses";

// SPDX-License-Identifier: AGPL-3.0-only

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link--active" : "nav-link";

export function RootLayout() {
  const chainId = useChainId();
  const chains = useChains();
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
  const gov = governanceUrl();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <NavLink to="/" className="brand-link">
            YieldOmega
          </NavLink>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/timecurve" className={navLinkClass}>
            TimeCurve
          </NavLink>
          <NavLink to="/rabbit-treasury" className={navLinkClass}>
            Rabbit Treasury
          </NavLink>
          <NavLink to="/collection" className={navLinkClass}>
            Collection
          </NavLink>
          <NavLink to="/referrals" className={navLinkClass}>
            Referrals
          </NavLink>
          <NavLink to="/kumbaya" className={navLinkClass}>
            Kumbaya
          </NavLink>
          <NavLink to="/sir" className={navLinkClass}>
            Sir
          </NavLink>
        </nav>
        <div className="app-header__wallet">
          <span className="chain-pill" title="Connected network">
            <span className="chain-pill__label">network</span>
            <span className="chain-pill__value">{chainName}</span>
          </span>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              mounted,
              authenticationStatus,
              openAccountModal,
              openChainModal,
              openConnectModal,
            }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected =
                ready &&
                account !== undefined &&
                chain !== undefined &&
                (!authenticationStatus || authenticationStatus === "authenticated");

              if (!ready) {
                return (
                  <div aria-hidden="true" className="wallet-controls wallet-controls--hidden">
                    <button type="button" className="wallet-action wallet-action--connect">
                      Loading wallet
                    </button>
                  </div>
                );
              }

              if (!connected) {
                return (
                  <div className="wallet-controls">
                    <button
                      type="button"
                      className="wallet-action wallet-action--connect"
                      onClick={openConnectModal}
                      aria-label="Connect wallet"
                    >
                      <span className="wallet-action__text-long">Connect Wallet</span>
                      <span className="wallet-action__text-short">Connect</span>
                    </button>
                  </div>
                );
              }

              if (chain.unsupported) {
                return (
                  <div className="wallet-controls">
                    <button
                      type="button"
                      className="wallet-action wallet-action--warning"
                      onClick={openChainModal}
                    >
                      Wrong Network
                    </button>
                    <button
                      type="button"
                      className="wallet-action wallet-action--account"
                      onClick={openAccountModal}
                    >
                      {account.displayName}
                    </button>
                  </div>
                );
              }

              return (
                <div className="wallet-controls">
                  <button
                    type="button"
                    className="wallet-action wallet-action--chain"
                    onClick={openChainModal}
                  >
                    {chain.name}
                  </button>
                  <button
                    type="button"
                    className="wallet-action wallet-action--account"
                    onClick={openAccountModal}
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="app-footer__row">
          <IndexerStatusBar />
          {gov && (
            <a href={gov} target="_blank" rel="noreferrer">
              Governance / CL8Y
            </a>
          )}
        </div>
        <div className="data-panel data-panel--footer">
          <h3 className="h-footer">Canonical fee sinks (read-only)</h3>
          <FeeTransparency />
        </div>
      </footer>
    </div>
  );
}
