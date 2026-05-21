// SPDX-License-Identifier: AGPL-3.0-only

import { FOOTER_SITE_LINKS } from "@/lib/footerSiteLinks";

/**
 * Site-wide outbound link ribbon below the agent card body and above indexer /
 * fee-sink rows ([GitLab #232](https://gitlab.com/PlasticDigits/yieldomega/-/issues/232)).
 */
export function FooterSiteLinks() {
  return (
    <nav
      className="app-footer__row app-footer__row--site-links"
      aria-label="YieldOmega and CL8Y links"
      data-testid="footer-site-links"
    >
      {FOOTER_SITE_LINKS.map((link) => (
        <a
          key={link.testId}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="footer-link-pill"
          data-testid={link.testId}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
