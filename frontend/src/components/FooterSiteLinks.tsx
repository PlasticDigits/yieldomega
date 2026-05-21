// SPDX-License-Identifier: AGPL-3.0-only

import { FooterSiteLinkIcon } from "@/components/FooterSiteLinkIcon";
import { FOOTER_SITE_LINKS } from "@/lib/footerSiteLinks";

/**
 * Outbound link pills for the footer site-links card
 * ([GitLab #232](https://gitlab.com/PlasticDigits/yieldomega/-/issues/232)).
 */
export function FooterSiteLinks() {
  return (
    <nav
      className="footer-site-links-card__nav"
      aria-label="YieldOmega and CL8Y links"
      data-testid="footer-site-links"
    >
      {FOOTER_SITE_LINKS.map((link) => (
        <a
          key={link.testId}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="footer-link-pill footer-link-pill--with-icon"
          data-testid={link.testId}
        >
          <FooterSiteLinkIcon icon={link.icon} />
          <span className="footer-link-pill__label">{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
