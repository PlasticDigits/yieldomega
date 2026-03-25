// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { addresses } from "@/lib/addresses";
import { leprechaunReadAbi } from "@/lib/abis";
import { fetchLeprechaunMints, type MintItem } from "@/lib/indexerApi";

type TraitBundle = {
  tokenId: bigint;
  seriesId: bigint;
  rarityTier: number;
  role: number;
};

export function CollectionPage() {
  const { address } = useAccount();
  const nft = addresses.leprechaunNft;
  const [mints, setMints] = useState<MintItem[] | null>(null);
  const [mintNote, setMintNote] = useState<string | null>(null);
  const [seriesFilter, setSeriesFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchLeprechaunMints(30);
      if (cancelled) {
        return;
      }
      if (!data) {
        setMintNote("Set VITE_INDEXER_URL to load indexed mints.");
        setMints([]);
        return;
      }
      setMints(data.items);
      setMintNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: totalSupply, isPending: tsPending } = useReadContract({
    address: nft,
    abi: leprechaunReadAbi,
    functionName: "totalSupply",
    query: { enabled: Boolean(nft) },
  });

  const { data: balance, isPending: balPending } = useReadContract({
    address: nft,
    abi: leprechaunReadAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(nft && address) },
  });

  const balN = balance !== undefined ? Number(balance) : 0;

  const indexReads = useMemo(() => {
    if (!nft || !address || balN <= 0) {
      return [];
    }
    return Array.from({ length: balN }, (_, i) => ({
      address: nft,
      abi: leprechaunReadAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [nft, address, balN]);

  const { data: ownedTokenIds } = useReadContracts({
    contracts: indexReads,
    query: { enabled: indexReads.length > 0 },
  });

  const tokenIdList = useMemo(() => {
    if (!ownedTokenIds) {
      return [];
    }
    const out: bigint[] = [];
    for (const r of ownedTokenIds) {
      if (r.status === "success" && r.result !== undefined) {
        out.push(r.result as bigint);
      }
    }
    return out;
  }, [ownedTokenIds]);

  const traitReads = useMemo(() => {
    if (!nft || tokenIdList.length === 0) {
      return [];
    }
    return tokenIdList.map((tid) => ({
      address: nft,
      abi: leprechaunReadAbi,
      functionName: "tokenTraits" as const,
      args: [tid] as const,
    }));
  }, [nft, tokenIdList]);

  const { data: traitsResults } = useReadContracts({
    contracts: traitReads,
    query: { enabled: traitReads.length > 0 },
  });

  const traitBundles: TraitBundle[] = useMemo(() => {
    if (!traitsResults) {
      return [];
    }
    const out: TraitBundle[] = [];
    traitsResults.forEach((r, i) => {
      if (r.status !== "success" || r.result === undefined) {
        return;
      }
      const t = r.result as readonly [bigint, number, number, number, bigint, number, number, bigint, bigint, boolean, boolean, boolean];
      const tid = tokenIdList[i];
      if (tid === undefined) {
        return;
      }
      out.push({
        tokenId: tid,
        seriesId: t[0],
        rarityTier: t[1],
        role: t[2],
      });
    });
    return out;
  }, [traitsResults, tokenIdList]);

  const filteredBundles = useMemo(() => {
    if (!seriesFilter.trim()) {
      return traitBundles;
    }
    try {
      const sid = BigInt(seriesFilter.trim());
      return traitBundles.filter((b) => b.seriesId === sid);
    } catch {
      return traitBundles;
    }
  }, [traitBundles, seriesFilter]);

  if (!nft) {
    return (
      <section className="page">
        <h1>Collection</h1>
        <p className="placeholder">
          Set <code>VITE_LEPRECHAUN_NFT_ADDRESS</code> in <code>.env</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Collection</h1>
      <p className="lede">ERC-721 reads via RPC; mint feed from indexer; filter owned by series.</p>

      <div className="data-panel">
        <h2>Contract</h2>
        {tsPending && <p>Loading totalSupply…</p>}
        {!tsPending && <p>totalSupply: {totalSupply !== undefined ? String(totalSupply) : "—"}</p>}
        {!address && <p className="placeholder">Connect a wallet to list owned tokens.</p>}
        {address && (
          <>
            {balPending && <p>Loading balance…</p>}
            {!balPending && <p>Your balance: {String(balance ?? 0n)}</p>}
          </>
        )}
      </div>

      <div className="data-panel">
        <h2>Your tokens</h2>
        {traitBundles.length === 0 && address && !balPending && (
          <p className="placeholder">No NFTs in this wallet (or still loading traits).</p>
        )}
        <label className="form-label">
          Filter by series id (numeric)
          <input
            type="text"
            className="form-input"
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="nft-grid">
          {filteredBundles.map((b) => (
            <article key={b.tokenId.toString()} className="nft-card">
              <div className="nft-card__id">#{b.tokenId.toString()}</div>
              <dl className="kv kv--compact">
                <dt>series</dt>
                <dd>{b.seriesId.toString()}</dd>
                <dt>rarity</dt>
                <dd>{b.rarityTier}</dd>
                <dt>role</dt>
                <dd>{b.role}</dd>
              </dl>
            </article>
          ))}
        </div>
      </div>

      <div className="data-panel">
        <h2>Recent mints (indexer)</h2>
        {mintNote && <p className="placeholder">{mintNote}</p>}
        {mints && mints.length === 0 && !mintNote && <p>No mints indexed yet.</p>}
        {mints && mints.length > 0 && (
          <ul className="event-list">
            {mints.map((m) => (
              <li key={`${m.tx_hash}-${m.log_index}`}>
                token <span className="mono">#{m.token_id}</span> →{" "}
                <span className="mono">{m.to_address.slice(0, 10)}…</span> — series{" "}
                {m.series_id} — block {m.block_number}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
