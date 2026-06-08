// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/ui/PageHero";
import { homeHubPath } from "@/lib/launchHubRoute";

const NOT_FOUND_TITLE = "Page not found · Yield Omega";
const DEFAULT_TITLE = "Yield Omega";

/**
 * Branded client 404 inside `RootLayout` (GitLab #223). Referral capture via
 * `?ref=` still runs in `ReferralPathSync` because the shell stays mounted.
 */
export function NotFoundPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = NOT_FOUND_TITLE;
    return () => {
      document.title = previous === NOT_FOUND_TITLE ? DEFAULT_TITLE : previous;
    };
  }, []);

  const homePath = homeHubPath();

  return (
    <main className="page page--not-found yga-secondary-page" data-testid="not-found-page" role="main">
      <PageHero
        title="404"
        badgeLabel="Route miss"
        badgeTone="warning"
        coinSrc="/art/hat-coin-stack.png"
        lede="No surface at this route."
        mascot={{
          src: "/art/mascot-bunny-wave.jpg",
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      >
        <Link to="/arena" className="btn-primary">
          Time Arena
        </Link>
        <Link to="/arena/protocol" className="btn-secondary">
          AUDIT
        </Link>
        <Link to={homePath} className="btn-secondary">
          Go to hub
        </Link>
        <Link to="/referrals" className="btn-secondary">
          Referrals
        </Link>
      </PageHero>
    </main>
  );
}
