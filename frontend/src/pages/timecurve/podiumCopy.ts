// SPDX-License-Identifier: AGPL-3.0-only

export const PODIUM_LABELS = [
  "Last Buy",
  "Time Booster",
  "Defended Streak",
] as const;

export const PODIUM_HELP = [
  "50% of the prize pool. The final buyer takes first, with the two buyers before them taking second and third.",
  "25% of the prize pool. This rewards the wallets that added the most real seconds to the deadline.",
  "25% of the prize pool. This rewards the best under-15-minute defense streak before someone else breaks it.",
] as const;
