// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/ui/PageHero";
import { homeHubPath } from "@/lib/launchHubRoute";

const NOT_FOUND_TITLE = "Page not found · YieldOmega";
const DEFAULT_TITLE = "YieldOmega";

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
    <main className="page page--not-found" data-testid="not-found-page" role="main">
      <PageHero
        title="404"
        badgeLabel="Off the map"
        badgeTone="warning"
        coinSrc="/art/hat-coin-stack.png"
        lede={
          <>
            This URL is not part of the YieldOmega app. Check the link, use a TimeCurve referral path like{" "}
            <code>/timecurve/yourcode</code>, or head back to a live surface below.
          </>
        }
        mascot={{
          src: "/art/mascot-bunny-wave.jpg",
          width: 208,
          height: 208,
          className: "cutout-decoration--peek",
        }}
      >
        <Link to="/timecurve" className="btn-primary">
          Open TimeCurve
        </Link>
        <Link to={homePath} className="btn-secondary">
          {homePath === "/" ? "Go home" : "Go to hub"}
        </Link>
        <Link to="/referrals" className="btn-secondary">
          Referrals
        </Link>
      </PageHero>
    </main>
  );
}
