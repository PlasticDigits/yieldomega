import { useEffect, useState, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ReferralPathSync } from "@/components/ReferralPathSync";
import { AgentFooterCard } from "@/components/AgentFooterCard";
import { useIsViewportAtMost } from "@/hooks/useIsViewportAtMost";
import { configuredTargetChainId } from "@/lib/chain";
import { addressTailHex } from "@/lib/addressFormat";
import { MEGAETH_CHAIN_IDS } from "@/lib/tokenMedia";
import { AlbumPlayerBar } from "@/audio/AlbumPlayerBar";
// SPDX-License-Identifier: AGPL-3.0-only

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link--dense nav-link--active" : "nav-link nav-link--dense";

const TARGET_CHAIN_ID = configuredTargetChainId();

const HEADER_ICONS = {
  home: "/art/icons/header-home.png",
  timecurve: "/art/icons/header-timecurve.png",
  referrals: "/art/icons/header-referrals.png",
  networkMega: "/art/icons/header-network-mega.png",
  networkLocal: "/art/icons/header-network-local.png",
  networkChain: "/art/icons/header-network-chain.png",
  walletConnect: "/art/icons/header-wallet-connect.png",
  walletAccount: "/art/icons/header-wallet-account.png",
  walletLoading: "/art/icons/header-wallet-loading.png",
  music: "/art/icons/header-music.png",
  wrongNetwork: "/art/icons/header-wrong-network.png",
} as const;

function HeaderIcon({ src }: { src: string }) {
  return (
    <span className="app-header__icon-wrap" aria-hidden="true">
      <img className="app-header__icon" src={src} alt="" width={24} height={24} decoding="async" />
    </span>
  );
}

/** Align with `@media (min-width: 721px)` dense header rules in `index.css`. */
const DENSE_HEADER_MOBILE_MAX_PX = 720;

function denseHeaderWalletAddrTail(address: string, digitCount: 4 | 6): string {
  const strict = addressTailHex(address, digitCount);
  if (strict) {
    return strict;
  }
  const body = address.trim().replace(/^0x/i, "");
  return body.slice(-digitCount);
}

/** Short label beside the dense header network icon (tablet/desktop, header on top). */
function denseHeaderNetworkShortLabel(chainId: number): string {
  if (MEGAETH_CHAIN_IDS.has(chainId)) return "MEGAETH";
  if (chainId === 31_337) return "ANVIL";
  return `#${chainId}`;
}

export function RootLayout() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [musicOpen, setMusicOpen] = useState(false);
  const denseHeaderAddrTailDigits: 4 | 6 = useIsViewportAtMost(DENSE_HEADER_MOBILE_MAX_PX) ? 4 : 6;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  // The TimeCurve **Simple** view is a deliberately minimal first-run surface
  // (timer + buy CTA + podiums). The global footer's indexer status pill +
  // canonical-fee-sink table are valuable on operator / power-user surfaces
  // (home, Arena, Protocol, etc.) but they distract from the primary buy action
  // when always visible. We hide the footer **only** on `/timecurve` (exact);
  // `/timecurve/arena` and `/timecurve/protocol` keep it. Agents still get the
  // collapsed `TimeCurveSimpleAgentCard` at the bottom of the Simple page (same
  // skills + fee sinks when expanded). See
  // [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md).
  const showFooter = location.pathname !== "/timecurve";
  const isTimecurveRoute = location.pathname === "/timecurve" || location.pathname.startsWith("/timecurve/");

  return (
    <div className={isTimecurveRoute ? "app-shell app-shell--timecurve" : "app-shell"}>
      <ReferralPathSync />
      <header className="app-header app-header--dense">
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

            const c = chain;
            const wrongNetwork = Boolean(
              ready && connected && c && (c.unsupported || c.id !== TARGET_CHAIN_ID),
            );

            const networkIconId = connected && c && !c.unsupported ? c.id : TARGET_CHAIN_ID;

            const networkBtn = (
              <button
                type="button"
                className="header-network-btn"
                onClick={openChainModal}
                title={`Switch network (now ${networkIconId})`}
                aria-label={`Switch network, chain id ${networkIconId}`}
              >
                <HeaderIcon
                  src={
                    MEGAETH_CHAIN_IDS.has(networkIconId)
                      ? HEADER_ICONS.networkMega
                      : networkIconId === 31_337
                        ? HEADER_ICONS.networkLocal
                        : HEADER_ICONS.networkChain
                  }
                />
                <span className="app-header__network-label" aria-hidden="true">
                  {denseHeaderNetworkShortLabel(networkIconId)}
                </span>
              </button>
            );

            let walletCluster: ReactNode;
            if (!ready) {
              walletCluster = (
                <div className="wallet-controls wallet-controls--dense" aria-busy="true">
                  {networkBtn}
                  <span
                    className="wallet-action wallet-action--dense wallet-action--loading"
                    aria-label="Wallet loading"
                    title="Wallet loading"
                  >
                    <HeaderIcon src={HEADER_ICONS.walletLoading} />
                  </span>
                </div>
              );
            } else if (!connected) {
              walletCluster = (
                <div className="wallet-controls wallet-controls--dense">
                  {networkBtn}
                  <button
                    type="button"
                    className="wallet-action wallet-action--dense wallet-action--connect-dense wallet-action--connect-pulse"
                    onClick={openConnectModal}
                    aria-label="Connect wallet"
                    title="Connect wallet"
                  >
                    <HeaderIcon src={HEADER_ICONS.walletConnect} />
                  </button>
                </div>
              );
            } else {
              walletCluster = (
                <div className="wallet-controls wallet-controls--dense">
                  {networkBtn}
                  <button
                    type="button"
                    className="wallet-action wallet-action--dense wallet-action--account-dense"
                    onClick={openAccountModal}
                    aria-label={`Open wallet menu for ${account.address ?? ""}`}
                    title={account.address ?? account.displayName}
                  >
                    <HeaderIcon src={HEADER_ICONS.walletAccount} />
                    {account.address ? (
                      <span className="wallet-action__addr-tail">
                        {denseHeaderWalletAddrTail(account.address, denseHeaderAddrTailDigits)}
                      </span>
                    ) : (
                      <span className="wallet-action__addr-tail">{account.displayName}</span>
                    )}
                  </button>
                </div>
              );
            }

            return (
              <>
                <div className="app-header__top">
                  <div className="app-header__brand">
                    <NavLink to="/" className="brand-link brand-link--dense" title="YieldOmega home">
                      <HeaderIcon src={HEADER_ICONS.home} />
                    </NavLink>
                  </div>
                  <nav className="app-nav app-nav--dense" aria-label="Primary">
                    <NavLink to="/timecurve" className={navLinkClass} aria-label="TimeCurve" title="TimeCurve">
                      <HeaderIcon src={HEADER_ICONS.timecurve} />
                      <span className="app-header__nav-label" aria-hidden="true">
                        TimeCurve
                      </span>
                    </NavLink>
                    <NavLink to="/referrals" className={navLinkClass} aria-label="Referrals" title="Referrals">
                      <HeaderIcon src={HEADER_ICONS.referrals} />
                      <span className="app-header__nav-label" aria-hidden="true">
                        Referrals
                      </span>
                    </NavLink>
                  </nav>
                  <div className="app-header__wallet app-header__wallet--dense">{walletCluster}</div>
                  <button
                    type="button"
                    className="app-header__music-btn"
                    onClick={() => setMusicOpen((v) => !v)}
                    aria-expanded={musicOpen}
                    aria-controls="album-player-dock"
                    aria-label={musicOpen ? "Hide music player" : "Show music player"}
                    title={musicOpen ? "Hide music player" : "Show music player"}
                  >
                    <HeaderIcon src={HEADER_ICONS.music} />
                  </button>
                </div>
                {wrongNetwork ? (
                  <div className="app-header__network-alert" role="status">
                    <HeaderIcon src={HEADER_ICONS.wrongNetwork} /> WRONG NETWORK: USE CHAIN ID{" "}
                    {TARGET_CHAIN_ID}
                  </div>
                ) : null}
              </>
            );
          }}
        </ConnectButton.Custom>
      </header>
      <AlbumPlayerBar open={musicOpen} onOpenChange={setMusicOpen} />
      <main className={isTimecurveRoute ? "app-main app-main--timecurve" : "app-main"}>
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
          <AgentFooterCard />
        </footer>
      )}
    </div>
  );
}
