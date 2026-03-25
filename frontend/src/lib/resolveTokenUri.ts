// SPDX-License-Identifier: AGPL-3.0-only

/** Turn tokenURI into a fetchable HTTPS URL when possible. */
export function httpUrlFromTokenUri(uri: string): string | null {
  const t = uri.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) {
    return t;
  }
  if (t.startsWith("ipfs://")) {
    const path = t.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  return null;
}

export type NftMetadataJson = {
  image?: string;
  name?: string;
  description?: string;
};
