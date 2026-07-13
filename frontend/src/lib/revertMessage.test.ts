// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { BaseError } from "viem";
import {
  REDACTED_RPC_URL_MARKER,
  friendlyRevertFromUnknown,
  friendlyRevertMessage,
  redactSensitiveUrlsInUserMessage,
} from "./revertMessage";
import { GasSoftCapExceededError } from "./writeContractWithGasBuffer";

describe("friendlyRevertMessage", () => {
  it("maps live charm band errors to clearer buy copy", () => {
    expect(friendlyRevertMessage("TimeArena: charm bounds")).toBe(
      "This charm size is outside the live min–max band. Nudge the amount or wait one block and retry.",
    );
    expect(friendlyRevertMessage("TimeCurve: below min charms")).toBe(
      "This charm size slipped below the live minimum for the current timer state.",
    );
  });

  it("maps TimeArenaBuyRouter custom errors", () => {
    expect(friendlyRevertMessage("TimeArenaBuyRouter__CharmBounds()")).toContain("min–max band");
    expect(friendlyRevertMessage("0xa8130f38")).toContain("min–max band");
    expect(friendlyRevertMessage("0x817275ab")).toContain("slippage");
    expect(friendlyRevertMessage("TimeArena: not started")).toBe("The arena has not opened yet.");
    expect(friendlyRevertMessage("TimeArenaBuyRouter__BadPhase()")).not.toMatch(/\bsale\b/i);
  });

  it("maps TimeArena not-started to arena framing (#318)", () => {
    expect(friendlyRevertMessage("TimeArena: not started")).toBe("The arena has not opened yet.");
    expect(friendlyRevertMessage("TimeArena: timer expired")).toBe("The arena timer has expired.");
    expect(friendlyRevertMessage("TimeArenaBuyRouter__BadPhase()")).toContain("Arena buys are not open");
    expect(friendlyRevertMessage("TimeArenaBuyRouter__BadPhase()")).not.toMatch(/\bsale\b/i);
  });

  it("maps common WarBow eligibility failures", () => {
    expect(friendlyRevertMessage("TimeArena: steal band")).toBe(
      "Stealing requires positive Battle Points on your wallet and a victim with at least 1× your Battle Points (and at most 50× — see the steal preflight).",
    );
    expect(friendlyRevertMessage("TimeCurve: steal 10x cap")).toBe(
      "That victim’s Battle Points are too far above yours for a steal under the onchain 1×–50× band.",
    );
    expect(friendlyRevertMessage("TimeArena: steal limit")).toContain("three steals today");
    expect(friendlyRevertMessage("TimeArena: flag silence")).toBe(
      "The silence timer has not finished, so the flag is not claimable yet.",
    );
    expect(friendlyRevertMessage("TimeArena: revenge")).toBe(
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
  it("maps OZ ERC20InsufficientAllowance error blobs without extra RPC", () => {
    const err = new Error(
      `Transaction failed with error: execution reverted: 0xfb8f41b20000000000000000000000001b68bb6789baeba4bd28f53c10b52dbe1ef2bf71000000000000000000000000000000000000000000000000252d08ec796f83f6000000000000000000000000000000000000000000000000252d35aef9a06f49`,
    );
    const msg = friendlyRevertFromUnknown(err, { buySubmit: true });
    expect(msg.toLowerCase()).toContain("cl8y");
    expect(msg.toLowerCase()).toContain("allowance");
  });

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

  it("maps stale wagmi connector errors to wallet-not-ready copy", () => {
    const err = new Error("connection.connector.getChainId is not a function");
    expect(friendlyRevertFromUnknown(err)).toMatch(/wait a moment and retry/i);
  });
});

describe("friendlyRevertFromUnknown — GasSoftCapExceededError (issue #176)", () => {
  it("surfaces estimated and cap values with a clear safety-cap message", () => {
    const err = new GasSoftCapExceededError(1_000_000n, 1_300_000n, 1_000_000n);
    const msg = friendlyRevertFromUnknown(err);
    expect(msg).toContain("safety cap");
    expect(msg).toContain("1000000");
    expect(msg).toContain("+30% buffer");
  });
});

describe("friendlyRevertFromUnknown — viem BaseError dedup ([#183](https://gitlab.com/PlasticDigits/yieldomega/-/issues/183))", () => {
  it("does not duplicate the revert reason from BaseError shortMessage / details / message", () => {
    // mimics the real shape of a viem BaseError raised by a reverted contract call:
    //   shortMessage = "The contract function ... reverted with the following reason: <reason>"
    //   details = "<reason>"
    //   message = composed by viem (shortMessage + metaMessages + version footer)
    const err = new BaseError(
      "The contract function \"warbowSteal\" reverted with the following reason: nonce too low",
      { details: "nonce too low" },
    );
    const msg = friendlyRevertFromUnknown(err);
    // revert reason should appear at most once
    const occurrences = (msg.match(/nonce too low/gi) ?? []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
    // "Contract Call" footer leaked from err.message must not surface
    expect(msg).not.toMatch(/Contract Call/i);
    // no double-prefix from the "reverted with the following reason" template
    const prefixOccurrences = (msg.match(/reverted with the following reason/gi) ?? []).length;
    expect(prefixOccurrences).toBeLessThanOrEqual(1);
  });

  it("still returns a usable single-line message when only shortMessage is populated", () => {
    const err = new BaseError("The contract function \"buy\" reverted with the following reason: TimeArena: below min buy");
    const msg = friendlyRevertFromUnknown(err);
    // matches the friendly mapping for "timearena: below min buy"
    expect(msg).toBe("Amount is below the current minimum buy.");
  });
});
