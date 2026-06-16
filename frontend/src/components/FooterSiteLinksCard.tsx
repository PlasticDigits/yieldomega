// SPDX-License-Identifier: AGPL-3.0-only

import { FooterSiteLinks } from "@/components/FooterSiteLinks";
import { PageSection } from "@/components/ui/PageSection";

/**
 * Community, repo, CL8Y infra, and agent skill links — glass `PageSection` chrome
 * ([GitLab #232](https://gitlab.com/PlasticDigits/yieldomega/-/issues/232)).
 */
export function FooterSiteLinksCard() {
  return (
    <PageSection className="footer-site-links-card" title="Community & tools" dataTestId="footer-site-links-card">
      <FooterSiteLinks />
    </PageSection>
  );
}
