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
};

export const HOME_SURFACE_CARDS: HomeSurfaceCard[] = [
  {
    to: "/timecurve",
    title: "TimeCurve",
    blurb: "DOUB sale, timer pressure, charms, podiums, and WarBow PvP on the live launch surface.",
    image: "/art/scenes/timecurve-simple.jpg",
    imageAlt: "TimeCurve fair-launch arcade scene with mascots and coins",
    badgeLabel: "Live",
    badgeTone: "live",
  },
  {
    to: "/rabbit-treasury",
    title: "Rabbit Treasury",
    blurb: "Burrow deposits, epochs, reserve health, and claim loops staged with the same YieldOmega shell.",
    image: "/art/scenes/rabbit-treasury.jpg",
    imageAlt: "Rabbit burrow reserve scene with charts adjacent",
    badgeLabel: "In queue",
    badgeTone: "soon",
  },
  {
    to: "/collection",
    title: "Collection",
    blurb: "Leprechaun NFT sets, traits, and roster history will slot into the shared product shell next.",
    image: "/art/scenes/collection-gallery.jpg",
    imageAlt: "Collection gallery scene with display shelves",
    badgeLabel: "In queue",
    badgeTone: "soon",
  },
  {
    to: "/referrals",
    title: "Referrals",
    blurb: "Registration, share links, indexer-backed referrer stats, and illustrative CHARM / CL8Y readouts in the shared shell.",
    image: "/art/scenes/referrals-network.jpg",
    imageAlt: "Referral network threads scene",
    badgeLabel: "Live",
    badgeTone: "live",
  },
  {
    to: "/kumbaya",
    title: "Kumbaya",
    blurb: "YieldOmega-framed view into the third-party spot venue for DOUB / CL8Y liquidity.",
    image: "/art/kumbaya-card.jpg",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Kumbaya branded card art for the third-party spot DEX",
    badgeLabel: "External",
    badgeTone: "external",
  },
  {
    to: "/sir",
    title: "Sir",
    blurb: "YieldOmega-framed launchpad for the third-party leverage venue tied to DOUB markets.",
    image: "/art/sir-card.png",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Sir branded card art for the third-party leverage venue",
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
