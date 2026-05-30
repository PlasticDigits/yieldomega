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
    to: "/arena",
    title: "Time Arena",
    blurb: "Always-on DOUB arena — buy CHARM, compete on podiums, extend the clock",
    image: "/art/scenes/arena-simple.jpg",
    imageAlt: "Time Arena fair-launch arcade scene with mascots and coins",
    badgeLabel: "Live",
    badgeTone: "live",
  },
  {
    to: "/referrals",
    title: "Referrals",
    blurb: "Earn 5% everytime someone uses TimeCurve",
    image: "/art/scenes/referrals-network.jpg",
    imageAlt: "Referral network threads scene",
    badgeLabel: "Live",
    badgeTone: "live",
  },
  {
    to: "/kumbaya",
    title: "Kumbaya",
    blurb: "Trade CL8Y and soon DOUB on Kumbaya",
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
    blurb: "Trade 2x leveraged CL8Y and soon DOUB",
    image: "/art/sir-card.png",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Sir branded card art for the third-party leverage venue",
    badgeLabel: "External",
    badgeTone: "external",
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
