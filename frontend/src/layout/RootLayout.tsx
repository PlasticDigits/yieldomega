import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useChainId, useChains } from "wagmi";
import { ReferralPathSync } from "@/components/ReferralPathSync";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { FeeTransparency } from "@/components/FeeTransparency";
import { IndexerStatusBar } from "@/components/IndexerStatusBar";
import { PageBadge } from "@/components/ui/PageBadge";
import { governanceUrl } from "@/lib/addresses";
import { MEGA_MARK, MEGAETH_CHAIN_IDS } from "@/lib/tokenMedia";
import { AlbumPlayerBar } from "@/audio/AlbumPlayerBar";
import { TimecurvePresaleCharmHeaderBadge } from "@/layout/TimecurvePresaleCharmHeaderBadge";

// SPDX-License-Identifier: AGPL-3.0-only

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link--active" : "nav-link";

export function RootLayout() {
  const chainId = useChainId();
  const chains = useChains();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
  const gov = governanceUrl();

  // The TimeCurve **Simple** view is a deliberately minimal first-run surface
  // (timer + buy CTA + recent buys + nothing else). The global footer's
  // indexer status pill + canonical-fee-sink table are valuable on operator
  // / power-user surfaces (home, Arena, Protocol, etc.) but they swamp the
  // Simple page with secondary information that distracts from the single
  // primary action. We hide the footer **only** on `/timecurve` (exact);
  // `/timecurve/arena` and `/timecurve/protocol` keep it. See
  // [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md).
  const showFooter = location.pathname !== "/timecurve";

  return (
    <div className="app-shell">
      <ReferralPathSync />
      <header className="app-header">
        <div className="app-header__top">
        <div className="app-header__brand">
          <NavLink to="/" className="brand-link">
            <img
              className="brand-link__mark"
              src="/art/token-logo.png"
              alt=""
              width={40}
              height={40}
              decoding="async"
            />
            YieldOmega
          </NavLink>
          <TimecurvePresaleCharmHeaderBadge />
          <PageBadge
            label="TimeCurve live"
            tone="live"
            className="app-header__status"
            iconSrc="/art/icons/status-live.png"
          />
          <CutoutDecoration
            className="app-header__mascot cutout-decoration--sway"
            src="/art/cutouts/loading-mascot-circle.png"
            width={120}
            height={120}
          />
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
            {MEGAETH_CHAIN_IDS.has(chainId) ? (
              <img
                className="chain-pill__mega-mark"
                src={MEGA_MARK}
                alt=""
                width={18}
                height={18}
                decoding="async"
                aria-hidden="true"
              />
            ) : null}
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
                      className="wallet-action wallet-action--connect wallet-action--priority"
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
        </div>
      </header>
      <AlbumPlayerBar />
      <main className="app-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="route-stage"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.28, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {showFooter && (
        <footer className="app-footer">
          <div className="app-footer__row">
            <IndexerStatusBar />
            {gov && (
              <a href={gov} target="_blank" rel="noreferrer" className="footer-link-pill">
                Governance / CL8Y
              </a>
            )}
          </div>
          <div className="data-panel data-panel--footer">
            <h3 className="h-footer">Canonical fee sinks (read-only)</h3>
            <FeeTransparency />
          </div>
        </footer>
      )}
    </div>
  );
}
