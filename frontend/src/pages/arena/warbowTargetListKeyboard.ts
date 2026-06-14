// SPDX-License-Identifier: AGPL-3.0-only

/** Roving listbox index for WarBow steal targets (Arrow/Home/End). */
export function moveWarbowTargetListIndex(
  key: string,
  currentIndex: number,
  length: number,
): { index: number; handled: boolean } | null {
  if (length <= 0) return null;
  const clamped = Math.max(0, Math.min(currentIndex, length - 1));
  switch (key) {
    case "ArrowDown":
      return { index: (clamped + 1) % length, handled: true };
    case "ArrowUp":
      return { index: (clamped - 1 + length) % length, handled: true };
    case "Home":
      return { index: 0, handled: true };
    case "End":
      return { index: length - 1, handled: true };
    default:
      return null;
  }
}
