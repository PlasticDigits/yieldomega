// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Indexed WarBow ladder rows for the Arena **Chasing pack** panel.
 *
 * The UI must show every row returned by the indexer (7+ participants, etc.) —
 * no arbitrary `slice(0, 6)` cap. Overflow is handled with a scroll region in CSS.
 *
 * @see [GitLab #189](https://gitlab.com/PlasticDigits/yieldomega/-/issues/189)
 */
export function warbowLeaderboardForChasingPackDisplay<T>(warbowLb: readonly T[] | null | undefined): readonly T[] {
  return warbowLb ?? [];
}
