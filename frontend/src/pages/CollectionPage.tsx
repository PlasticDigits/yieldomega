// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { TxHash } from "@/components/TxHash";
import { addresses } from "@/lib/addresses";
import { leprechaunReadAbi } from "@/lib/abis";
import { fetchLeprechaunMints, type MintItem } from "@/lib/indexerApi";
import { httpUrlFromTokenUri, type NftMetadataJson } from "@/lib/resolveTokenUri";

type TraitBundle = {
  tokenId: bigint;
  seriesId: bigint;
  rarityTier: number;
  role: number;
  passiveEffectType: number;
  setId: bigint;
  setPosition: number;
  bonusCategory: number;
  bonusValue: bigint;
  synergyTag: bigint;
  agentTradable: boolean;
  agentLendable: boolean;
  factionLocked: boolean;
};

const BONUS_LABELS = ["treasuryDeposit", "timerSkew", "feeDiscount"];

export function CollectionPage() {
  const { address } = useAccount();
  const nft = addresses.leprechaunNft;
  const [mints, setMints] = useState<MintItem[] | null>(null);
  const [mintNote, setMintNote] = useState<string | null>(null);
  const [seriesFilter, setSeriesFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [passiveFilter, setPassiveFilter] = useState("");
  const [imagesByToken, setImagesByToken] = useState<Record<string, string | undefined>>({});

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

  const uriReads = useMemo(() => {
    if (!nft || tokenIdList.length === 0) {
      return [];
    }
    return tokenIdList.map((tid) => ({
      address: nft,
      abi: leprechaunReadAbi,
      functionName: "tokenURI" as const,
      args: [tid] as const,
    }));
  }, [nft, tokenIdList]);

  const { data: uriResults } = useReadContracts({
    contracts: uriReads,
    query: { enabled: uriReads.length > 0 },
  });

  useEffect(() => {
    if (!uriResults || tokenIdList.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string | undefined> = {};
      await Promise.all(
        uriResults.map(async (r, i) => {
          const tid = tokenIdList[i];
          if (tid === undefined || r.status !== "success" || r.result === undefined) {
            return;
          }
          const rawUri = r.result as string;
          const httpUrl = httpUrlFromTokenUri(rawUri);
          if (!httpUrl) {
            return;
          }
          try {
            const res = await fetch(httpUrl);
            if (!res.ok) {
              return;
            }
            const meta = (await res.json()) as NftMetadataJson;
            const img = meta.image?.trim();
            if (img && !cancelled) {
              const imgUrl = httpUrlFromTokenUri(img) ?? (img.startsWith("http") ? img : null);
              if (imgUrl) {
                next[tid.toString()] = imgUrl;
              }
            }
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) {
        setImagesByToken((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uriResults, tokenIdList]);

  const traitBundles: TraitBundle[] = useMemo(() => {
    if (!traitsResults) {
      return [];
    }
    const out: TraitBundle[] = [];
    traitsResults.forEach((r, i) => {
      if (r.status !== "success" || r.result === undefined) {
        return;
      }
      const t = r.result as readonly [
        bigint,
        number,
        number,
        number,
        bigint,
        number,
        number,
        bigint,
        bigint,
        boolean,
        boolean,
        boolean,
      ];
      const tid = tokenIdList[i];
      if (tid === undefined) {
        return;
      }
      out.push({
        tokenId: tid,
        seriesId: t[0],
        rarityTier: t[1],
        role: t[2],
        passiveEffectType: t[3],
        setId: t[4],
        setPosition: t[5],
        bonusCategory: t[6],
        bonusValue: t[7],
        synergyTag: t[8],
        agentTradable: t[9],
        agentLendable: t[10],
        factionLocked: t[11],
      });
    });
    return out;
  }, [traitsResults, tokenIdList]);

  const filteredBundles = useMemo(() => {
    let out = traitBundles;
    if (seriesFilter.trim()) {
      try {
        const sid = BigInt(seriesFilter.trim());
        out = out.filter((b) => b.seriesId === sid);
      } catch {
        /* invalid bigint */
      }
    }
    if (rarityFilter.trim()) {
      const r = Number.parseInt(rarityFilter.trim(), 10);
      if (!Number.isNaN(r)) {
        out = out.filter((b) => b.rarityTier === r);
      }
    }
    if (roleFilter.trim()) {
      const r = Number.parseInt(roleFilter.trim(), 10);
      if (!Number.isNaN(r)) {
        out = out.filter((b) => b.role === r);
      }
    }
    if (passiveFilter.trim()) {
      const r = Number.parseInt(passiveFilter.trim(), 10);
      if (!Number.isNaN(r)) {
        out = out.filter((b) => b.passiveEffectType === r);
      }
    }
    return out;
  }, [traitBundles, seriesFilter, rarityFilter, roleFilter, passiveFilter]);

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
      <p className="lede">Onchain traits and metadata; mint feed from indexer.</p>

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
        <label className="form-label">
          Rarity tier (exact match, 0–255)
          <input
            type="text"
            className="form-input"
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="form-label">
          Role (exact match)
          <input
            type="text"
            className="form-input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="form-label">
          Passive effect (exact match)
          <input
            type="text"
            className="form-input"
            value={passiveFilter}
            onChange={(e) => setPassiveFilter(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="nft-grid">
          {filteredBundles.map((b) => {
            const img = imagesByToken[b.tokenId.toString()];
            const bonusLabel =
              BONUS_LABELS[b.bonusCategory] ?? `category ${b.bonusCategory}`;
            return (
              <article key={b.tokenId.toString()} className="nft-card">
                {img ? (
                  <div className="nft-card__media">
                    <img src={img} alt="" loading="lazy" />
                  </div>
                ) : (
                  <div className="nft-card__media nft-card__media--placeholder muted">No image</div>
                )}
                <div className="nft-card__id">#{b.tokenId.toString()}</div>
                <dl className="kv kv--compact">
                  <dt>series</dt>
                  <dd>{b.seriesId.toString()}</dd>
                  <dt>rarity</dt>
                  <dd>{b.rarityTier}</dd>
                  <dt>role</dt>
                  <dd>{b.role}</dd>
                  <dt>passive effect</dt>
                  <dd>{b.passiveEffectType}</dd>
                  <dt>set</dt>
                  <dd>
                    {b.setId.toString()} (pos {b.setPosition})
                  </dd>
                  <dt>bonus</dt>
                  <dd>
                    {bonusLabel} = {b.bonusValue.toString()}
                  </dd>
                  <dt>synergy</dt>
                  <dd>{b.synergyTag.toString()}</dd>
                  <dt>agent</dt>
                  <dd>
                    tradable {String(b.agentTradable)} · lendable {String(b.agentLendable)} ·
                    factionLocked {String(b.factionLocked)}
                  </dd>
                </dl>
              </article>
            );
          })}
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
                {m.series_id} — block {m.block_number} — tx <TxHash hash={m.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
