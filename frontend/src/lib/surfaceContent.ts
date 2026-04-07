// SPDX-License-Identifier: AGPL-3.0-only

import type { PageBadgeTone } from "@/components/ui/PageBadge";

export type HomeSurfaceCard = {
  to: string;
  title: string;
  blurb: string;
  image: string;
  imageAlt: string;
  badgeLabel: string;
  badgeTone: PageBadgeTone;
};

export const HOME_SURFACE_CARDS: HomeSurfaceCard[] = [
  {
    to: "/timecurve",
    title: "TimeCurve",
    blurb: "DOUB sale, timer pressure, charms, podiums, and WarBow PvP on the live launch surface.",
    image: "/art/hero-home.jpg",
    imageAlt: "Arcade fantasy scene with mascots and coins",
    badgeLabel: "Live",
    badgeTone: "live",
  },
  {
    to: "/rabbit-treasury",
    title: "Rabbit Treasury",
    blurb: "Burrow deposits, epochs, reserve health, and claim loops staged with the same YieldOmega shell.",
    image: "/art/rabbit-treasury-card.jpg",
    imageAlt: "Rabbit Treasury feature illustration",
    badgeLabel: "In queue",
    badgeTone: "soon",
  },
  {
    to: "/collection",
    title: "Collection",
    blurb: "Leprechaun NFT sets, traits, and roster history will slot into the shared product shell next.",
    image: "/art/collection-card.jpg",
    imageAlt: "Collection feature illustration with mascot roster",
    badgeLabel: "In queue",
    badgeTone: "soon",
  },
  {
    to: "/referrals",
    title: "Referrals",
    blurb: "Referral registration and tracked reward flow are designed, branded, and waiting for the next milestone.",
    image: "/art/referrals-card.jpg",
    imageAlt: "Referral rewards feature illustration",
    badgeLabel: "In queue",
    badgeTone: "soon",
  },
  {
    to: "/kumbaya",
    title: "Kumbaya",
    blurb: "YieldOmega-framed view into the third-party spot venue for DOUB / CL8Y liquidity.",
    image: "/art/kumbaya-card.jpg",
    imageAlt: "Kumbaya liquidity feature illustration",
    badgeLabel: "External",
    badgeTone: "external",
  },
  {
    to: "/sir",
    title: "Sir",
    blurb: "YieldOmega-framed launchpad for the third-party leverage venue tied to DOUB markets.",
    image: "/art/sir-card.png",
    imageAlt: "Sir trading arena feature illustration",
    badgeLabel: "External",
    badgeTone: "external",
  },
];

export const PLACEHOLDER_CUTOUTS_BY_SLUG = {
  "rabbit-treasury": {
    primary: "/art/cutouts/mascot-leprechaun-with-bag-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/loading-mascot-circle.png",
  },
  collection: {
    primary: "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/bunny-cutout.png",
  },
  referrals: {
    primary: "/art/cutouts/mascot-bunnyleprechaungirl-wave-cutout.png",
    secondary: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    tertiary: "/art/cutouts/loading-mascot-circle.png",
  },
} as const;

export const THIRD_PARTY_CUTOUTS_BY_SLUG = {
  kumbaya: {
    banner: "/art/cutouts/cutout-bunnyleprechaungirl-head.png",
    panel: "/art/cutouts/mascot-bunnyleprechaungirl-wave-cutout.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
  sir: {
    banner: "/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png",
    panel: "/art/cutouts/cutout-bunnyleprechaungirl-full.png",
    footer: "/art/cutouts/loading-mascot-circle.png",
  },
} as const;
