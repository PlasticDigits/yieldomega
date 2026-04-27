// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { friendlyRevertFromUnknown, friendlyRevertMessage } from "./revertMessage";

describe("friendlyRevertMessage", () => {
  it("maps live charm band errors to clearer buy copy", () => {
    expect(friendlyRevertMessage("TimeCurve: below min charms")).toBe(
      "This charm size slipped below the live minimum for the current timer state.",
    );
    expect(friendlyRevertMessage("TimeCurve: above max charms")).toBe(
      "This charm size is above the live maximum for the current timer state.",
    );
  });

  it("maps common WarBow eligibility failures", () => {
    expect(friendlyRevertMessage("TimeCurve: steal 2x rule")).toBe(
      "You can only steal from a rival with at least 2x your Battle Points.",
    );
    expect(friendlyRevertMessage("TimeCurve: flag silence")).toBe(
      "The silence timer has not finished, so the flag is not claimable yet.",
    );
    expect(friendlyRevertMessage("TimeCurve: revenge expired")).toBe(
      "The revenge window already expired.",
    );
  });
});

describe("friendlyRevertFromUnknown", () => {
  it("uses buy-submit hint for bare execution reverted when buySubmit is set", () => {
    const err = new Error("Execution reverted for an unknown reason.");
    const msg = friendlyRevertFromUnknown(err, { buySubmit: true });
    expect(msg).toContain("CHARM amount band");
    expect(msg).toContain("quote and submit");
  });

  it("does not replace user rejection with buy-submit hint", () => {
    const err = new Error("User rejected the request.");
    const msg = friendlyRevertFromUnknown(err, { buySubmit: true });
    expect(msg.toLowerCase()).toContain("rejected");
  });
});
