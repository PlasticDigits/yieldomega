// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { cl8yWeiToUsdDisplay } from "./cl8ySpotUsdPrice";

describe("cl8yWeiToUsdDisplay", () => {
  it("multiplies CL8Y wei by USD/CL8Y", () => {
    const usd = cl8yWeiToUsdDisplay(2n * 10n ** 18n, 1.5);
    expect(usd).toMatch(/\$3\.00/);
  });

  it("returns undefined when price missing", () => {
    expect(cl8yWeiToUsdDisplay(10n ** 18n, undefined)).toBeUndefined();
  });
});
