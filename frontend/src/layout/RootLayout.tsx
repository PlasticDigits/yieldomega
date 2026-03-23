import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NavLink, Outlet } from "react-router-dom";
import { useChainId } from "wagmi";

// SPDX-License-Identifier: AGPL-3.0-only

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link--active" : "nav-link";

export function RootLayout() {
  const chainId = useChainId();

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
        </nav>
        <div className="app-header__wallet">
          <span className="chain-pill" title="Connected chain id">
            chain {chainId}
          </span>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
