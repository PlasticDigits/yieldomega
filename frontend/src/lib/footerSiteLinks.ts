// SPDX-License-Identifier: AGPL-3.0-only

/** Public GitHub mirror of the monorepo (`main` branch). */
export const GH_MAIN_BLOB = "https://github.com/PlasticDigits/yieldomega/blob/main";

export function ghMainBlob(path: string): string {
  return `${GH_MAIN_BLOB}/${path}`;
}

/** Canonical outbound URLs for the global footer site-link ribbon (GitLab #232). */
export const FOOTER_SITE_LINKS = [
  { label: "X", href: "https://x.com/yieldomega", testId: "footer-site-link-x" },
  { label: "Telegram", href: "https://t.me/yieldomega", testId: "footer-site-link-telegram" },
  {
    label: "GitLab",
    href: "https://gitlab.com/PlasticDigits/yieldomega",
    testId: "footer-site-link-gitlab",
  },
  {
    label: "GitHub",
    href: "https://github.com/PlasticDigits/yieldomega",
    testId: "footer-site-link-github",
  },
  {
    label: "Buy CL8Y (Kumbaya)",
    href: "https://www.kumbaya.xyz/#/swap?outputCurrency=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D&confirmed=1",
    testId: "footer-site-link-kumbaya-cl8y",
  },
  { label: "CL8Y Bridge", href: "https://bridge.cl8y.com", testId: "footer-site-link-cl8y-bridge" },
  {
    label: "Play active TimeCurve",
    href: ghMainBlob("skills/play-active-timecurve/SKILL.md"),
    testId: "footer-site-link-play-active-timecurve",
  },
] as const;
