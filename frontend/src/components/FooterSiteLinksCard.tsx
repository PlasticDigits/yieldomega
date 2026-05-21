// SPDX-License-Identifier: AGPL-3.0-only

import { FooterSiteLinks } from "@/components/FooterSiteLinks";

/**
 * Standalone footer card for community, repo, CL8Y infra, and agent skill links —
 * separate from the collapsible agent card ([GitLab #232](https://gitlab.com/PlasticDigits/yieldomega/-/issues/232)).
 */
export function FooterSiteLinksCard() {
  return (
    <section
      className="footer-site-links-card data-panel"
      aria-labelledby="footer-site-links-card-title"
      data-testid="footer-site-links-card"
    >
      <h3 id="footer-site-links-card-title" className="h-footer footer-site-links-card__title">
        Community &amp; tools
      </h3>
      <FooterSiteLinks />
    </section>
  );
}
