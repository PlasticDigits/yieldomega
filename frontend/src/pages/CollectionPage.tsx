// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { addresses } from "@/lib/addresses";
import { leprechaunReadAbi } from "@/lib/abis";
import { fetchLeprechaunMints, type MintItem } from "@/lib/indexerApi";

export function CollectionPage() {
  const { address } = useAccount();
  const nft = addresses.leprechaunNft;
  const [mints, setMints] = useState<MintItem[] | null>(null);
  const [mintNote, setMintNote] = useState<string | null>(null);

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

  const firstTokenId =
    ownedTokenIds?.[0]?.status === "success" ? ownedTokenIds[0].result : undefined;

  const { data: traits } = useReadContract({
    address: nft,
    abi: leprechaunReadAbi,
    functionName: "tokenTraits",
    args: firstTokenId !== undefined ? [firstTokenId] : undefined,
    query: { enabled: Boolean(nft && firstTokenId !== undefined) },
  });

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
      <p className="lede">ERC-721 reads via RPC; mint feed from indexer.</p>

      <div className="data-panel">
        <h2>Contract</h2>
        {tsPending && <p>Loading totalSupply…</p>}
        {!tsPending && <p>totalSupply: {totalSupply !== undefined ? String(totalSupply) : "—"}</p>}
        {!address && <p className="placeholder">Connect a wallet to list owned token IDs.</p>}
        {address && (
          <>
            {balPending && <p>Loading balance…</p>}
            {!balPending && <p>Your balance: {String(balance ?? 0n)}</p>}
            {firstTokenId !== undefined && traits && (
              <div className="traits-box">
                <h3>First owned token #{String(firstTokenId)}</h3>
                <pre className="mono traits-pre">{JSON.stringify(traits, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)}</pre>
              </div>
            )}
          </>
        )}
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
