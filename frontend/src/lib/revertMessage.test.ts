// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  REDACTED_RPC_URL_MARKER,
  friendlyRevertFromUnknown,
  friendlyRevertMessage,
  redactSensitiveUrlsInUserMessage,
} from "./revertMessage";

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
      "Stealing requires positive Battle Points on your wallet and a victim with at least 2× your Battle Points.",
    );
    expect(friendlyRevertMessage("TimeCurve: steal attacker daily limit")).toContain("three steals today");
    expect(friendlyRevertMessage("TimeCurve: flag silence")).toBe(
      "The silence timer has not finished, so the flag is not claimable yet.",
    );
    expect(friendlyRevertMessage("TimeCurve: revenge expired")).toBe(
      "The revenge window already expired.",
    );
  });
});

describe("redactSensitiveUrlsInUserMessage", () => {
  const fake =
    "RPC Request failed: fetch failed — URL https://eth-mainnet.g.alchemy.com/v2/deadbeefdeadbeefdeadbeefdeadbeef";

  it("redacts Alchemy v2 URLs", () => {
    expect(redactSensitiveUrlsInUserMessage(fake)).not.toContain("deadbeef");
    expect(redactSensitiveUrlsInUserMessage(fake)).toContain(REDACTED_RPC_URL_MARKER);
  });

  it("redacts Infura v3 URLs", () => {
    const msg = 'Transport failed for "https://mainnet.infura.io/v3/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"';
    const out = redactSensitiveUrlsInUserMessage(msg);
    expect(out).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(out).toContain(REDACTED_RPC_URL_MARKER);
  });

  it("redacts extra configured RPC fragments (tests / proxy URLs)", () => {
    const secret = "https://example-rpc.invalid/v1/fake-api-key-xyz";
    const msg = `estimateGas failed contacting ${secret} (timeout)`;
    const out = redactSensitiveUrlsInUserMessage(msg, { extraKnownRpcUrlSubstrings: [secret] });
    expect(out).not.toContain("fake-api-key");
    expect(out).toContain(REDACTED_RPC_URL_MARKER);
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

  it("redacts RPC URLs embedded in wagmi-style errors before mapping", () => {
    const secretUrl = "https://polygon-mainnet.g.alchemy.com/v2/supersecretapikeyhere12345678901234";
    const err = new Error(`HTTP request failed.\n\nURL: ${secretUrl}\nRequest body: {...}`);
    const msg = friendlyRevertFromUnknown(err);
    expect(msg).not.toContain("supersecretapikey");
    expect(msg).toContain(REDACTED_RPC_URL_MARKER);
  });
});
