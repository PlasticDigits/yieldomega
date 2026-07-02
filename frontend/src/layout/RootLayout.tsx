import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import { ReferralPathSync } from "@/components/ReferralPathSync";
import { ReferralSelfReferralPurge } from "@/components/ReferralSelfReferralPurge";
import { AgentFooterCard } from "@/components/AgentFooterCard";
import { FooterSiteLinksCard } from "@/components/FooterSiteLinksCard";
import { SwitchToTargetChainButton } from "@/components/SwitchToTargetChainButton";
import { useIsViewportAtMost } from "@/hooks/useIsViewportAtMost";
import { configuredTargetChainId } from "@/lib/chain";
import { isReferralPlayPathname } from "@/lib/referralPathCapture";
import { addressTailHex } from "@/lib/addressFormat";
import { MEGAETH_CHAIN_IDS, MEGA_MARK } from "@/lib/tokenMedia";
import { AlbumPlayerBar } from "@/audio/AlbumPlayerBar";
// SPDX-License-Identifier: AGPL-3.0-only

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link--dense nav-link--active" : "nav-link nav-link--dense";

const TARGET_CHAIN_ID = configuredTargetChainId();

const HEADER_ICONS = {
  home: "/art/icons/header-home.svg",
  networkLocal: "/art/icons/header-network-local.png",
  networkChain: "/art/icons/header-network-chain.png",
  walletConnect: "/art/icons/header-wallet-connect.png",
  walletLoading: "/art/icons/header-wallet-loading.png",
  music: "/art/icons/header-music.png",
  wrongNetwork: "/art/icons/header-wrong-network.png",
} as const;

function HeaderAuditIcon() {
  return (
    <svg className="app-header__icon app-header__icon--svg" viewBox="0 0 24 24" width={24} height={24} focusable="false">
      <path
        d="M12 4.95l5.75 2.08v4.25c0 3.72-2.2 6.65-5.75 8.12c-3.55-1.47-5.75-4.4-5.75-8.12V7.03L12 4.95Z"
        fill="#12394c"
        stroke="#7ef1ff"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M9.15 12.1l1.68 1.68l4.05-4.28"
        fill="none"
        stroke="#f5cf42"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeaderReferralsIcon() {
  return (
    <svg className="app-header__icon app-header__icon--svg" viewBox="0 0 24 24" width={24} height={24} focusable="false">
      <path
        d="M8.05 12.85l3.95-5.2l3.95 5.2M8.05 12.85l7.9 0M12 7.65v8.5"
        fill="none"
        stroke="#1fe0c5"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7.1" r="2.65" fill="#12394c" stroke="#7ef1ff" strokeWidth="1.25" />
      <circle cx="7.15" cy="14.25" r="2.65" fill="#12394c" stroke="#7ef1ff" strokeWidth="1.25" />
      <circle cx="16.85" cy="14.25" r="2.65" fill="#12394c" stroke="#7ef1ff" strokeWidth="1.25" />
      <circle cx="12" cy="7.1" r="1.25" fill="#f5cf42" />
      <circle cx="7.15" cy="14.25" r="1.25" fill="#1fe0c5" />
      <circle cx="16.85" cy="14.25" r="1.25" fill="#1fe0c5" />
    </svg>
  );
}

function HeaderIcon({ src, kind }: { src?: string; kind?: "audit" | "referrals" }) {
  return (
    <span className="app-header__icon-wrap" aria-hidden="true">
      {kind === "audit" ? (
        <HeaderAuditIcon />
      ) : kind === "referrals" ? (
        <HeaderReferralsIcon />
      ) : src ? (
        <img className="app-header__icon" src={src} alt="" width={24} height={24} decoding="async" />
      ) : null}
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

function DenseHeaderWalletControls({
  denseHeaderAddrTailDigits,
}: {
  denseHeaderAddrTailDigits: 4 | 6;
}) {
  return (
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
                  ? MEGA_MARK
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

        if (!ready) {
          return (
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
        }

        if (!connected) {
          return (
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
                <span className="app-header__connect-label" aria-hidden="true">
                  CONNECT
                </span>
              </button>
            </div>
          );
        }

        return (
          <div className="wallet-controls wallet-controls--dense">
            {networkBtn}
            <button
              type="button"
              className="wallet-action wallet-action--dense wallet-action--account-dense"
              onClick={openAccountModal}
              aria-label={`Open wallet menu for ${account.address ?? ""}`}
              title={account.address ?? account.displayName}
            >
              <HeaderIcon src={HEADER_ICONS.walletConnect} />
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
      }}
    </ConnectButton.Custom>
  );
}

export function RootLayout() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [musicOpen, setMusicOpen] = useState(false);
  const denseHeaderAddrTailDigits: 4 | 6 = useIsViewportAtMost(DENSE_HEADER_MOBILE_MAX_PX) ? 4 : 6;
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const walletReady = !isConnecting && !isReconnecting;
  const wrongNetwork = Boolean(walletReady && isConnected && chainId !== TARGET_CHAIN_ID);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  // The default Time Arena route is a minimal buy-first surface (timer + CTA +
  // podiums). The global footer's agent/operator readouts are useful elsewhere,
  // but they compete with the live buy decision when always visible.
  // See [`docs/frontend/arena-views.md`](../../docs/frontend/arena-views.md).
  const isArenaPlayRoute = isReferralPlayPathname(location.pathname);
  const isReferralsRoute = location.pathname === "/referrals";

  const shellClassName = [
    "app-shell",
    isArenaPlayRoute ? "app-shell--arena" : null,
    isReferralsRoute ? "app-shell--referrals" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const mainClassName = [
    "app-main",
    isArenaPlayRoute ? "app-main--arena" : null,
    isReferralsRoute ? "app-main--referrals" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const showFooter = !isArenaPlayRoute;

  return (
    <div className={shellClassName}>
      <ReferralPathSync />
      <ReferralSelfReferralPurge />
      <header className="app-header app-header--dense">
        <div className="app-header__top">
          <div className="app-header__brand">
            <NavLink to="/" className="brand-link brand-link--dense" title="Yield Omega home">
              <HeaderIcon src={HEADER_ICONS.home} />
            </NavLink>
          </div>
          <nav className="app-nav app-nav--dense" aria-label="Primary">
            <NavLink
              to="/audit"
              className={navLinkClass}
              aria-label="AUDIT: Inspect Time Arena contract reads, indexer tables, and operator activity."
              title="Inspect Time Arena contract reads, indexer tables, and operator activity."
            >
              <HeaderIcon kind="audit" />
              <span className="app-header__nav-label" aria-hidden="true">
                AUDIT
              </span>
            </NavLink>
            <NavLink to="/referrals" className={navLinkClass} aria-label="Referrals" title="Referrals">
              <HeaderIcon kind="referrals" />
              <span className="app-header__nav-label" aria-hidden="true">
                Referrals
              </span>
            </NavLink>
          </nav>
          <div className="app-header__wallet app-header__wallet--dense">
            <DenseHeaderWalletControls denseHeaderAddrTailDigits={denseHeaderAddrTailDigits} />
          </div>
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
            <span className="app-header__network-alert-copy">
              <HeaderIcon src={HEADER_ICONS.wrongNetwork} /> WRONG NETWORK: USE CHAIN ID {TARGET_CHAIN_ID}
            </span>
            <SwitchToTargetChainButton className="btn-secondary app-header__network-alert-switch" />
          </div>
        ) : null}
      </header>
      <AlbumPlayerBar open={musicOpen} onOpenChange={setMusicOpen} />
      <main className={mainClassName}>
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
          <FooterSiteLinksCard />
        </footer>
      )}
    </div>
  );
}
