// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from "react";
import { AddressInline } from "@/components/AddressInline";

const CHARM_MIN = 1;
const CHARM_MAX = 10;
const CHARM_PRICE_DOUB = 1042;

const LAST_BUY_PRIZES = [
  ["1st", "0xa4b6f019a5b364d632e5c9b29f89053eab13a49d", "14.2k DOUB", "$14.2k"],
  ["2nd", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "7.1k DOUB", "$7.1k"],
  ["3rd", "0x11c8b3f4ca0e6a1d0fb643d6743b42a1aa1111c8", "3.5k DOUB", "$3.5k"],
] as const;

const SECONDARY_PODIUMS = [
  {
    label: "Defended Streak",
    epoch: "Epoch 8",
    timer: "10:58:44",
    delta: "streak +2",
    prizes: [
      ["1st", "0x7102e5a81c19a44d980f1537e3021c26e38e7102", "7.1k DOUB", "$7.1k"],
      ["2nd", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "3.5k DOUB", "$3.5k"],
      ["3rd", "0x9b210f24d2a8841f96b6d4dc0f2e067a7c9b2121", "1.8k DOUB", "$1.8k"],
    ],
  },
  {
    label: "Time Booster",
    epoch: "Epoch 12",
    timer: "06:58:44",
    delta: "+60s rank",
    prizes: [
      ["1st", "0x18aafd35ebb26ff5570f9245aba962f1c4b318aa", "5.5k DOUB", "$5.5k"],
      ["2nd", "0x4219e861b3d3d7e510ac4aa713fb7d664e7a4219", "2.8k DOUB", "$2.8k"],
      ["3rd", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "1.4k DOUB", "$1.4k"],
    ],
  },
  {
    label: "WarBow",
    epoch: "Epoch 4",
    timer: "47:58:44",
    delta: "flag 00:58",
    prizes: [
      ["1st", "0xf280c8f30d876f37c653dd43d9128db49af2f280", "10.3k DOUB", "$10.3k"],
      ["2nd", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "5.2k DOUB", "$5.2k"],
      ["3rd", "0x7d44f48e1f2d79ebaa2b8c36344f2386ee7d7d44", "2.6k DOUB", "$2.6k"],
    ],
  },
] as const;

const ACTIVITY_EVENTS = [
  {
    type: "BUY",
    address: "0xa4b6f019a5b364d632e5c9b29f89053eab13a49d",
    change: "+120s LB",
    meta: "8.4 CHARM",
  },
  {
    type: "STEAL",
    address: "0xf280c8f30d876f37c653dd43d9128db49af2f280",
    change: "+2.4x BP",
    meta: "WarBow",
  },
  {
    type: "GUARD",
    address: "0x7102e5a81c19a44d980f1537e3021c26e38e7102",
    change: "blocked steal",
    meta: "WarBow",
  },
  {
    type: "REVENGE",
    address: "0x9b210f24d2a8841f96b6d4dc0f2e067a7c9b2121",
    change: "counter hit",
    meta: "WarBow",
  },
] as const;

export function ArenaThemeConcepts() {
  const [charmAmount, setCharmAmount] = useState("8.4");
  const charmAmountNumber = Number.parseFloat(charmAmount);
  const clampedCharmAmount = Number.isFinite(charmAmountNumber)
    ? Math.min(CHARM_MAX, Math.max(CHARM_MIN, charmAmountNumber))
    : CHARM_MIN;
  const estimatedDoub = useMemo(
    () => Math.round(clampedCharmAmount * CHARM_PRICE_DOUB).toLocaleString("en-US"),
    [clampedCharmAmount],
  );
  const setPresetCharmAmount = (amount: number) => setCharmAmount(amount.toFixed(1));

  return (
    <section className="arena-final-concept" aria-labelledby="arena-final-concept-title">
      <div className="arena-final-concept__ambient" aria-hidden="true" />
      <div className="arena-final-concept__topbar">
        <span>Yield Omega</span>
        <strong id="arena-final-concept-title">PvP Command Console</strong>
        <span>Live</span>
      </div>

      <div className="arena-final-concept__grid">
        <div className="arena-final-concept__primary">
          <div className="arena-final-concept__clock" aria-label="Last Buy podium priority">
            <div className="arena-final-concept__clock-head">
              <span>Last Buy</span>
              <b>Epoch 16</b>
            </div>
            <strong>00:12:48</strong>
            <em>ends {"->"} prizes + CHARM reset</em>
          </div>
          <div className="arena-final-concept__leaderboard" aria-label="Last Buy leaderboard preview">
            {LAST_BUY_PRIZES.map(([rank, address, doub, usd]) => (
              <div key={rank} className="arena-final-concept__leader-row">
                <span className="arena-final-concept__rank">{rank}</span>
                <AddressInline
                  address={address}
                  tailHexDigits={6}
                  size={16}
                  explorer={false}
                  className="arena-final-concept__address"
                />
                <em>{doub}</em>
                <b>{usd}</b>
              </div>
            ))}
          </div>
          <div className="arena-final-concept__decision-row" aria-label="CHARM buy deltas">
            <div>
              <span>CHARM Price</span>
              <strong>1,042 DOUB</strong>
            </div>
            <div>
              <span>Buy Min/Max</span>
              <strong>1.0-10 CHARM</strong>
            </div>
            <div>
              <span>CRED yield</span>
              <strong>epoch weight</strong>
            </div>
          </div>
          <div className="arena-final-concept__actions">
            <form className="arena-final-concept__buy-control" onSubmit={(event) => event.preventDefault()}>
              <div className="arena-final-concept__buy-head">
                <span>Buy CHARM</span>
                <strong>{estimatedDoub} DOUB</strong>
              </div>
              <label className="arena-final-concept__buy-entry">
                <span>Amount</span>
                <input
                  type="number"
                  min={CHARM_MIN}
                  max={CHARM_MAX}
                  step="0.1"
                  value={charmAmount}
                  onChange={(event) => setCharmAmount(event.target.value)}
                  aria-label="CHARM amount to buy"
                />
              </label>
              <input
                className="arena-final-concept__buy-slider"
                type="range"
                min={CHARM_MIN}
                max={CHARM_MAX}
                step="0.1"
                value={clampedCharmAmount}
                onChange={(event) => setCharmAmount(event.target.value)}
                aria-label="Set CHARM amount"
              />
              <div className="arena-final-concept__buy-footer">
                <button type="button" onClick={() => setPresetCharmAmount(CHARM_MIN)}>
                  Min
                </button>
                <button type="button" onClick={() => setPresetCharmAmount(CHARM_MAX)}>
                  Max
                </button>
                <button type="submit" className="arena-final-concept__buy-submit">
                  Buy Now
                </button>
              </div>
            </form>
            <button type="button" className="arena-final-concept__claim-button">
              Claim CRED
            </button>
          </div>
        </div>

        <div className="arena-final-concept__side">
          <div className="arena-final-concept__warbow" aria-label="WarBow actions">
            <div className="arena-final-concept__warbow-head">
              <span>WarBow</span>
              <strong>2.4x BP</strong>
            </div>
            <div className="arena-final-concept__warbow-actions">
              <button type="button">Steal</button>
              <button type="button">Guard</button>
              <button type="button">Revenge</button>
              <button type="button">Flag</button>
            </div>
          </div>
          <div className="arena-final-concept__rival-stack" aria-label="PvP decision deltas">
            {[
              ["Last Buy", "+120s", "next buy", "primary"],
              ["Defended", "+8m", "next buy", "podium"],
              ["Time Booster", "+60s", "next buy", "podium"],
              ["WarBow", "+300s", "next buy", "podium"],
            ].map(([label, address, value, delta]) => (
              <div key={label} className={label === "Last Buy" ? "arena-final-concept__rival is-you" : "arena-final-concept__rival"}>
                <span>{label}</span>
                <b>{address}</b>
                <strong>{value}</strong>
                <em>{delta}</em>
              </div>
            ))}
          </div>
          <div className="arena-final-concept__event-feed" aria-label="Recent PvP activity">
            {ACTIVITY_EVENTS.map(({ type, address, change, meta }) => (
              <div key={`${type}-${address}`} className="arena-final-concept__event">
                <span>{type}</span>
                <AddressInline
                  address={address}
                  tailHexDigits={6}
                  size={12}
                  explorer={false}
                  className="arena-final-concept__address arena-final-concept__address--small"
                />
                <strong>{change}</strong>
                <em>{meta}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="arena-final-concept__rings" aria-label="Secondary prize rings">
          {SECONDARY_PODIUMS.map(({ label, epoch, timer, delta, prizes }) => (
            <div key={label} className="arena-final-concept__ring">
              <span>{label}</span>
              <strong>{timer}</strong>
              <b>{epoch}</b>
              <em>{delta}</em>
              <ol aria-label={`${label} top three`}>
                {prizes.map(([rank, address, doub, usd]) => (
                  <li key={rank}>
                    <span className="arena-final-concept__rank">{rank}</span>
                    <AddressInline
                      address={address}
                      tailHexDigits={6}
                      size={12}
                      explorer={false}
                      className="arena-final-concept__address arena-final-concept__address--small"
                    />
                    <strong>{doub}</strong>
                    <em>{usd}</em>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <img
        className="arena-final-concept__character"
        src="/art/cutouts/sniper-shark-cool-suit-headset.png"
        alt=""
        aria-hidden="true"
        width={260}
        height={260}
        decoding="async"
      />
    </section>
  );
}
