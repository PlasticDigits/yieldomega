// SPDX-License-Identifier: AGPL-3.0-only

import type { PageBadgeTone } from "@/components/ui/PageBadge";

export type HomeSurfaceCard = {
  to: string;
  title: string;
  blurb: string;
  image: string;
  /** Optional intrinsic size for the image (improves CLS; defaults match legacy 4:3 card slot). */
  imageWidth?: number;
  imageHeight?: number;
  imageAlt: string;
  badgeLabel: string;
  badgeTone: PageBadgeTone;
  tooltip: string;
};

export type HomeHeroSignal = {
  label: string;
  tooltip: string;
};

export type LaunchCountdownSignal = {
  label: string;
  tooltip: string;
};

export type LaunchCountdownLink = {
  label: string;
  href: string;
  tooltip: string;
};

export const HOME_HERO_SIGNALS: HomeHeroSignal[] = [
  {
    label: "BUY CHARM",
    tooltip: "Open /arena to buy CHARM with DOUB or Play CRED.",
  },
  {
    label: "4 PODIUMS",
    tooltip: "Last Buy, Time Booster, Defended Streak, and WarBow run as independent TimeArena podiums.",
  },
  {
    label: "WARBOW",
    tooltip: "PvP steal, guard, revenge, and flag actions compete for Battle Points.",
  },
  {
    label: "AUDIT",
    tooltip: "Verify TimeArena state, vault routing, and indexed activity on /arena/protocol.",
  },
];

export const HOME_SURFACE_CARDS: HomeSurfaceCard[] = [
  {
    to: "/arena",
    title: "Time Arena",
    blurb: "Buy CHARM, pressure four timers, fight for DOUB podiums.",
    image: "/art/scenes/arena-simple.jpg",
    imageAlt: "Time Arena command-console scene with mascots and coins",
    badgeLabel: "Live",
    badgeTone: "live",
    tooltip: "Primary play surface: buy CHARM, route DOUB to prizes, earn CRED, and compete in PvP TimeArena.",
  },
  {
    to: "/arena/protocol",
    title: "Arena AUDIT",
    blurb: "Verify timers, vault routing, and indexed PvP activity.",
    image: "/art/scenes/arena-protocol.jpg",
    imageAlt: "Time Arena protocol audit console scene",
    badgeLabel: "Verify",
    badgeTone: "info",
    tooltip: "Read-only AUDIT console for TimeArena state, contract addresses, vault routing, and activity mirrors.",
  },
  {
    to: "/referrals",
    title: "Referrals",
    blurb: "Share codes; each referred DOUB buy mints 5 CRED per side.",
    image: "/art/scenes/referrals-network.jpg",
    imageAlt: "Referral network threads scene",
    badgeLabel: "Live",
    badgeTone: "live",
    tooltip: "Referral codes reward both buyer and referrer with flat Play CRED on referred DOUB buys.",
  },
  {
    to: "/kumbaya",
    title: "Kumbaya",
    blurb: "Swap rails for CL8Y, DOUB, ETH, and USDM routes.",
    image: "/art/kumbaya-card.jpg",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Kumbaya branded card art for the third-party spot DEX",
    badgeLabel: "External",
    badgeTone: "external",
    tooltip: "External spot venue used for ecosystem swaps and TimeArena pay-rail context.",
  },
  {
    to: "/sir",
    title: "Sir",
    blurb: "External leverage venue for advanced CL8Y and DOUB exposure.",
    image: "/art/sir-card.png",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Sir branded card art for the third-party leverage venue",
    badgeLabel: "External",
    badgeTone: "external",
    tooltip: "External leverage venue; not required for TimeArena play.",
  },
];

export const LAUNCH_COUNTDOWN_SIGNALS: LaunchCountdownSignal[] = [
  {
    label: "PLAY",
    tooltip: "The primary handoff is /arena: buy CHARM and compete on TimeArena.",
  },
  {
    label: "CRED",
    tooltip: "DOUB buys accrue Play CRED; CRED can also burn for CHARM buys when available.",
  },
  {
    label: "PVP",
    tooltip: "WarBow actions make the entry surface adversarial player-vs-player.",
  },
  {
    label: "AUDIT",
    tooltip: "After the gate opens, /arena/protocol exposes state and routing verification.",
  },
];

export const LAUNCH_COUNTDOWN_LINKS: LaunchCountdownLink[] = [
  { label: "Telegram", href: "https://t.me/yieldomega", tooltip: "Yield Omega Telegram" },
  { label: "X.com", href: "https://x.com/yieldomega", tooltip: "Yield Omega on X" },
  {
    label: "Docs",
    href: "https://github.com/PlasticDigits/yieldomega/tree/main/docs",
    tooltip: "Yield Omega product and technical docs",
  },
  {
    label: "Play Skills",
    href: "https://github.com/PlasticDigits/yieldomega/blob/main/skills/README.md",
    tooltip: "Player-facing TimeArena skill index",
  },
];

export const PLACEHOLDER_CUTOUTS_BY_SLUG = {
  referrals: {
    primary: "/art/cutouts/mascot-bunny-girl-wave-cutout.png",
    secondary: "/art/cutouts/cutout-bunny-girl-head.png",
    tertiary: "/art/cutouts/loading-mascot-circle.png",
  },
} as const;

export const THIRD_PARTY_CUTOUTS_BY_SLUG = {
  kumbaya: {
    banner: "/art/cutouts/cutout-bunny-girl-head.png",
    panel: "/art/cutouts/mascot-bunny-girl-wave-cutout.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
  sir: {
    banner: "/art/cutouts/mascot-bunny-girl-jump-cutout.png",
    panel: "/art/cutouts/cutout-bunny-girl-full.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
} as const;
