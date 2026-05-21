// SPDX-License-Identifier: AGPL-3.0-only

/** Public GitHub mirror of the monorepo (`main` branch). */
export const GH_MAIN_BLOB = "https://github.com/PlasticDigits/yieldomega/blob/main";

export function ghMainBlob(path: string): string {
  return `${GH_MAIN_BLOB}/${path}`;
}

export type FooterSiteLinkIcon =
  | { kind: "asset"; src: string; alt?: string }
  | { kind: "brand"; brand: "x" | "telegram" | "gitlab" | "github" | "mail" };

export type FooterSiteLink = {
  label: string;
  href: string;
  testId: string;
  icon: FooterSiteLinkIcon;
};

/** Canonical outbound URLs for the global footer site-links card (GitLab #232). */
export const FOOTER_SITE_LINKS: readonly FooterSiteLink[] = [
  {
    label: "X",
    href: "https://x.com/yieldomega",
    testId: "footer-site-link-x",
    icon: { kind: "brand", brand: "x" },
  },
  {
    label: "Telegram",
    href: "https://t.me/yieldomega",
    testId: "footer-site-link-telegram",
    icon: { kind: "brand", brand: "telegram" },
  },
  {
    label: "GitLab",
    href: "https://gitlab.com/PlasticDigits/yieldomega",
    testId: "footer-site-link-gitlab",
    icon: { kind: "brand", brand: "gitlab" },
  },
  {
    label: "GitHub",
    href: "https://github.com/PlasticDigits/yieldomega",
    testId: "footer-site-link-github",
    icon: { kind: "brand", brand: "github" },
  },
  {
    label: "contact@yieldomega.com",
    href: "mailto:contact@yieldomega.com",
    testId: "footer-site-link-email",
    icon: { kind: "brand", brand: "mail" },
  },
  {
    label: "Buy CL8Y (Kumbaya)",
    href: "https://www.kumbaya.xyz/#/swap?outputCurrency=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D&confirmed=1",
    testId: "footer-site-link-kumbaya-cl8y",
    icon: { kind: "asset", src: "/art/icons/token-cl8y-24.png", alt: "" },
  },
  {
    label: "CL8Y Bridge",
    href: "https://bridge.cl8y.com",
    testId: "footer-site-link-cl8y-bridge",
    icon: { kind: "asset", src: "/art/icons/ui-conversion-arrow.png", alt: "" },
  },
  {
    label: "Agent SKILL.md",
    href: ghMainBlob("skills/play-active-timecurve/SKILL.md"),
    testId: "footer-site-link-agent-skill",
    icon: { kind: "asset", src: "/art/icons/header-timecurve.png", alt: "" },
  },
];
