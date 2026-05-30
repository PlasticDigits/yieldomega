// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatTimeBoosterPodiumSec } from "./timeBoosterPodiumFormat";

describe("formatTimeBoosterPodiumSec (GitLab #228)", () => {
  const cases: Array<{ sec: number | bigint; expected: string }> = [
    { sec: -1, expected: "0" },
    { sec: 0n, expected: "0" },
    { sec: 45, expected: "45" },
    { sec: 59, expected: "59" },
    { sec: 60, expected: "01:00" },
    { sec: 300, expected: "05:00" },
    { sec: 3599, expected: "59:59" },
    { sec: 3600, expected: "01:00:00" },
    { sec: 86399, expected: "23:59:59" },
    { sec: 86400, expected: "1:00:00:00" },
    { sec: 2 * 86400 + 3 * 3600 + 13 * 60 + 7, expected: "2:03:13:07" },
    { sec: 90061n, expected: "1:01:01:01" },
  ];

  it.each(cases)("formats $sec as $expected", ({ sec, expected }) => {
    expect(formatTimeBoosterPodiumSec(sec)).toBe(expected);
  });
});
