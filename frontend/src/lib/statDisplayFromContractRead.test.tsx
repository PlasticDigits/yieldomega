// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { statFromContractRead, statFromOptionalString } from "./statDisplayFromContractRead";

vi.mock("@/components/ConnectWalletPlaceholder", () => ({
  ConnectWalletPlaceholder: ({ label = "Connect" }: { label?: string }) => (
    <button type="button" className="empty-data-placeholder empty-data-placeholder--connect" aria-label="Connect wallet">
      {label}
    </button>
  ),
}));

describe("statFromContractRead", () => {
  it("renders success mapping", () => {
    const html = renderToStaticMarkup(
      statFromContractRead({ status: "success", result: "1000" }, { isPending: false, isConnected: true }, {
        mapSuccess: (r) => <span data-v={r}>ok</span>,
      }),
    );
    expect(html).toContain('data-v="1000"');
  });

  it("shows connect CTA when wallet required but disconnected", () => {
    const html = renderToStaticMarkup(
      statFromContractRead(undefined, { isPending: false, isConnected: false }, {
        requireWallet: true,
        mapSuccess: () => <span>no</span>,
      }),
    );
    expect(html).toContain("empty-data-placeholder--connect");
    expect(html).toContain("Connect");
    expect(html).toContain('aria-label="Connect wallet"');
  });

  it("uses loading vs missing based on isPending when read absent", () => {
    const loading = renderToStaticMarkup(
      statFromContractRead(undefined, { isPending: true, isConnected: true }, {
        mapSuccess: () => <span>x</span>,
        labels: { loading: "L", missing: "M" },
      }),
    );
    const missing = renderToStaticMarkup(
      statFromContractRead(undefined, { isPending: false, isConnected: true }, {
        mapSuccess: () => <span>x</span>,
        labels: { loading: "L", missing: "M" },
      }),
    );
    expect(loading).toContain("L");
    expect(missing).toContain("M");
  });
});

describe("statFromOptionalString", () => {
  it("maps defined string", () => {
    const html = renderToStaticMarkup(
      statFromOptionalString("42", { isPending: false }, {
        mapSuccess: (r) => <em>{r}</em>,
      }),
    );
    expect(html).toContain("<em>42</em>");
  });
});
