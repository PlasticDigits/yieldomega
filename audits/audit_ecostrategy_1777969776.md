# Internal EcoStrategy Security Review

Audit file: `audits/audit_ecostrategy_1777969776.md`  
Date: 2026-05-05  
Reviewer: Cursor agent, internal review  
Commit reviewed: `e54ca048274257181c502c40f8968c48e34c0db3`  
Working tree at start of report write: dirty (`UU .cursor/skills/yieldomega-guardrails/SKILL.md`, pre-existing and not touched)  
Scope: economic and game-strategy behavior for TimeCurve, WarBow, referrals, fee routing, Rabbit Treasury coupling, launch-anchor assumptions, simulations, indexer/UX incentive surfaces, and post-sale operational flows.

## Executive Summary

The TimeCurve design does create meaningful shark-vs-shark competition: late and well-capitalized participants fight over last-buy, WarBow, defended-streak, and time-booster prizes while every successful buy raises `totalRaised`, funds burns/liquidity/podium/Rabbit sinks, and increases the documented launch-anchor value for CHARM holders. That structure can benefit early believers when predator activity is expensive, visible, and value-accretive to the sale.

The strongest believer-protective property is the no-referral redemption-density invariant: excluding referral and presale bonus weight, later buying raises implied CL8Y per DOUB faster than it dilutes DOUB per CHARM. The strongest believer-hostile forces are not simple contract theft; they are incentive leaks: controlled-wallet referral/presale weight, per-wallet cooldown sybils, WarBow high-BP predation, candidate-set dependence at WarBow finalization, and launch/Rabbit operational coupling.

One high-impact accounting issue needs attention before relying on Rabbit Treasury as the canonical fifth TimeCurve fee sink: `FeeRouter.distributeFees` transfers the last sink share directly to the configured destination, while `RabbitTreasury` only books fee income into `protocolOwnedBacking` through `receiveFee`. If the sink destination is the Rabbit Treasury contract itself, token balances increase but Rabbit's internal buckets, cumulative fee counters, burn split, and epoch health events do not. That can make the advertised Rabbit 10% support invisible to the Burrow accounting model.

Automated checks were not run for this report because it is documentation/audit output only. The recommended next step is not a broad refactor; it is targeted modeling of shark clusters and one integration fix or explicit deployment policy for Rabbit fee routing.

## Review Checklist

### Smart Contracts

- `contracts/src/TimeCurve.sol`: buy economics, referral/presale CHARM weight, timer hard reset, buy cooldown, WarBow BP, steal/revenge/guard, flag claim/penalty, redemption, podium distribution, WarBow candidate finalization, post-end gates, unredeemed DOUB sweep.
- `contracts/src/FeeRouter.sol`: sink split semantics, direct ERC20 transfer behavior, governance updates, distributable-token allowlist.
- `contracts/src/RabbitTreasury.sol`: redeemable vs protocol-owned backing, `receiveFee`, deposit/withdraw, epoch repricing, redemption health.
- `contracts/src/ReferralRegistry.sol`: code registration ordering, burn economics, uniqueness, public calldata race.
- `contracts/src/TimeCurveBuyRouter.sol`: ETH/stable entry, gross CL8Y exact-output, `buyFor`, marginal refunds, CL8Y dust routing.
- `contracts/src/sinks/DoubLPIncentives.sol`, `PodiumPool.sol`, `FeeSink.sol`: launch liquidity and reserve prize custody assumptions.
- `contracts/src/vesting/DoubPresaleVesting.sol`: beneficiary status used by TimeCurve for +15% CHARM weight.

### Product, Ops, Simulations, and UX

- `docs/product/primitives.md`: CHARM bounds, redemption economics, podium shares, WarBow rules.
- `docs/product/referrals.md`: 5% + 5% referral CHARM, registration ordering, dashboard authority.
- `docs/product/rabbit-treasury.md`: reserve buckets, honest sustainability, epoch and repricing semantics.
- `docs/onchain/fee-routing-and-governance.md`: TimeCurve fee split and governance authority.
- `contracts/PARAMETERS.md`: canonical constants and launch allocation policy.
- `docs/onchain/security-and-threat-model.md`: MEV, griefing, parameter-change, and indexer risks.
- `simulations/timecurve_sim/model.py` and `simulations/timecurve_sim/monte_carlo.py`: existing TimeCurve and WarBow buy-path modeling.
- Frontend/indexer surfaces sampled through prior full-stack audit context where they affect incentives.

## Assumptions and Trust Boundaries

- Contracts are authoritative for balances, winners, phase, redemption, and prize settlement. Indexer and frontend output are discovery and UX layers only.
- Governance/admin roles are trusted for this review, but governance sequencing is still reviewed when it changes participant economics or user expectations.
- The accepted reserve asset is standard non-rebasing CL8Y unless otherwise stated.
- Public transaction ordering, same-block ordering, and final-window contention are part of the onchain game unless a finding calls out a mismatch between that intent and user disclosure.
- "Believers" means early sale buyers whose primary upside is CHARM redemption and launch-anchor value, not late predators whose main objective is extracting reserve podium or WarBow value.

## Severity Findings

### H-01: Rabbit Treasury fee sink can receive CL8Y without booking Rabbit backing or fee events

Affected code and docs:

- `contracts/src/FeeRouter.sol`
- `contracts/src/RabbitTreasury.sol`
- `docs/onchain/fee-routing-and-governance.md`
- `docs/product/rabbit-treasury.md`
- `contracts/PARAMETERS.md`

The documented TimeCurve split sends 10% of gross routed fees to Rabbit Treasury. `FeeRouter.distributeFees` implements sinks as direct token transfers: for each configured destination it calls `token.safeTransfer(destination, share)`, and the last sink receives the rounding remainder. `RabbitTreasury`, however, only updates `protocolOwnedBacking`, `cumulativeFees`, `cumulativeBurned`, `BurrowProtocolRevenueSplit`, and related reserve events through `receiveFee(uint256 amount)`, which pulls tokens from `msg.sender` and applies the configured burn/protocol split.

If the fifth sink is configured as the Rabbit Treasury proxy directly, Rabbit's CL8Y ERC20 balance can increase while `protocolOwnedBacking` remains unchanged. Epoch finalization then uses `redeemableBacking + protocolOwnedBacking`, not raw ERC20 balance, so the 10% sale support may not improve Burrow coverage. `redemptionHealthWad` uses only `redeemableBacking` by design, but the broader system-health story in docs depends on protocol-owned backing being booked through Rabbit's accounting path.

Impact:

- TimeCurve buyers may believe 10% of each buy supports Rabbit Treasury, while Rabbit's internal health metrics ignore that transfer.
- Fee income may bypass Rabbit's configured protocol revenue burn share.
- Indexers relying on Burrow events will not see `BurrowFeeAccrued` or `BurrowProtocolRevenueSplit` for the TimeCurve share.
- Post-sale DOUB/Rabbit behavior can diverge from the intended believer-support narrative even though no token transfer reverts.

Recommendation:

- Do not configure Rabbit Treasury itself as a direct `FeeRouter` sink unless the contract is changed to account direct transfers safely.
- Prefer a small Rabbit fee adapter sink that receives the FeeRouter transfer, approves Rabbit, and calls `receiveFee`, or change the router to support explicit callback sinks with strict allowlisting.
- Add an integration test: TimeCurve buy -> FeeRouter fifth sink -> Rabbit fee accounting changes `protocolOwnedBacking`, emits fee/bucket events, and applies the burn split.
- If launch intentionally uses direct transfer, update docs to state the 10% is an unbooked token balance and not Burrow backing until a separate governed reconciliation path runs.

Suggested severity: High, because it can invalidate a core economic promise and all Rabbit health dashboards while preserving superficially successful fee transfers.

### M-01: Controlled-wallet referral and presale stacking can dilute non-referred early believers

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `contracts/src/ReferralRegistry.sol`
- `contracts/src/vesting/DoubPresaleVesting.sol`
- `docs/product/referrals.md`
- `docs/product/primitives.md`

Referral rewards are paid as CHARM weight, not reserve rebates. On a referred buy, `TimeCurve` adds 5% of `charmWad` to the referrer and 5% to the buyer, increasing `totalCharmWeight` by 110% of the purchased CHARM while `totalRaised` only increases by the gross spend. Self-referral by the same address is blocked, but common-control wallet clusters are not. A buyer can register a code from wallet A and buy from wallet B, capturing both tranches under common control.

If the buyer is also a `DoubPresaleVesting` beneficiary, TimeCurve adds another 15% buyer CHARM weight on each buy. A controlled pair can therefore capture 125% total controlled CHARM weight per unit of spend: 100% purchased CHARM, 15% presale buyer bonus, 5% referee bonus, and 5% referrer bonus.

This is likely intentional growth/referral design, but it breaks the clean no-referral early-believer invariant. Non-referred early believers are diluted by referred and presale-weighted buyers, and whales with wallet hygiene can make the dilution systematic rather than incidental.

Impact:

- Referral and presale whales receive more redemption claim per CL8Y than ordinary early buyers.
- The "later sharks raise the clearing value for believers" story weakens when later shark activity adds unpaid CHARM weight.
- Referral dashboards can reward common-control clusters and create social proof that does not represent organic distribution.

Recommendation:

- Treat controlled-wallet referral farming as an explicit, documented economic tradeoff, not an edge case.
- Model sale outcomes under 0%, 25%, 50%, and 80% referred-buy shares, with and without presale stacking.
- Consider a per-wallet or per-code cap on referral CHARM eligible for redemption if the desired outcome is believer-protective rather than growth-maximal.
- In UX, show referred/presale bonus weight separately from paid CHARM so buyers understand when their redemption share is being diluted by unpaid weight.

Suggested severity: Medium. It is not an implementation bug, but it can materially change who benefits from the sale.

### M-02: WarBow steal/revenge asymmetry can make high-BP early believers cheap prey

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `docs/product/primitives.md`
- `contracts/PARAMETERS.md`

WarBow's 2x rule makes a victim stealable when `victimBP >= 2 * attackerBP`. That encourages low-BP or fresh attackers to target high-BP leaders. A normal steal burns 1 CL8Y and transfers 10% of the victim's BP to the attacker. Guard reduces the drain to 1%, but costs 10 CL8Y and lasts 6 hours. Revenge burns 1 CL8Y and takes 10% of the stealer's current BP, not the amount stolen.

This creates an asymmetric surface around early believers who build BP honestly through early buys, reset plays, or flag claims. A small attacker can take a large absolute BP amount from a leader. The victim's revenge against a low-BP attacker may recover far less than was lost, especially if the attacker transfers or loses BP through subsequent PvP dynamics before revenge.

Impact:

- Early WarBow leaders become economically attractive prey.
- Low-BP shark clusters can turn early believers' accumulated BP into their own ranking fuel.
- Guard may be rational only for whales or known leaders, not ordinary believers, creating a protection gap.
- The WarBow prize slice can be redistributed from active early participants to late predators without proportional sale contribution.

Recommendation:

- Model WarBow with the real 2x rule, per-attacker/victim daily caps, guard, revenge, UTC rollover, and burn costs. The current simulation only includes toy random 10% steals.
- Consider whether revenge should recover a percentage of stolen amount, impose attacker lockups, or give defended early leaders stronger anti-predation tools if the goal is believer protection.
- At minimum, UX should describe WarBow BP as contestable score, not a banked entitlement.

Suggested severity: Medium. This may be intended PvP, but the asymmetry can invert the desired "sharks fight sharks to help believers" outcome.

### M-03: Per-wallet cooldown does not constrain sybil shark packs

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `docs/onchain/security-and-threat-model.md`
- `simulations/timecurve_sim/monte_carlo.py`

TimeCurve enforces `nextBuyAllowedAt[buyer]` per credited buyer address. `buyFor` correctly uses the actual buyer rather than the router, so the Kumbaya router does not bypass cooldown for one wallet. However, a whale can split across many wallets and buy at the same cadence as a crowd.

Because several prize/score components are per buy rather than proportional to spend, sybil packs can be more efficient than single-wallet whales:

- Each qualifying buy gets base WarBow BP.
- Multiple wallets can occupy last-buy slots and reset windows.
- Multiple wallets can bypass the 5-minute flag-claim rhythm and contest each other's flags.
- Coordinated wallets can stage defended-streak breaks and ambush bonuses.
- Buy count and ordering pressure can rise without revealing common control.

Impact:

- The game may look broad in unique buyers while being dominated by one operator.
- Small genuine early believers face timing pressure from wallet clusters that simulate crowd activity.
- Podium EV may reward operational sophistication more than conviction or sale contribution.

Recommendation:

- Treat sybil cooldown bypass as an expected strategy and model it directly.
- Add simulation scenarios with a single capital pool split across 1, 5, 25, and 100 wallets, measuring spend share, CHARM share, podium share, BP share, and value returned to early non-sybil buyers.
- If sybil resistance is desired, consider making more rewards scale with CHARM spend or net CL8Y contribution rather than raw transaction count.

Suggested severity: Medium. This is expected for permissionless systems, but it is central to the intended game outcome.

### M-04: WarBow finalization depends on an offchain candidate superset

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `docs/product/primitives.md`
- `docs/testing/invariants-and-business-logic.md`

Battle Points can decrease after a wallet enters the WarBow podium, so `TimeCurve` includes `refreshWarbowPodium(candidates)` during the sale and owner-only `finalizeWarbowPodium(candidates)` after the sale. Finalization clears the podium and rebuilds it from the supplied candidates. The contract NatSpec explicitly states that omitted wallets cannot influence the rebuild.

This is operationally understandable, but economically sensitive: WarBow receives 25% of the podium pool, or 5% of gross raise under launch defaults. If the candidate list is stale, incomplete, filtered incorrectly by an indexer, or misses wallets whose BP was created by steals/revenge/flag rather than buy rows, the wrong wallets can receive reserve prizes.

Impact:

- A correct onchain BP holder can be excluded from the WarBow payout if omitted from candidates.
- Indexer bugs or operator mistakes become economic settlement risks.
- Shark clusters may try to hide or fragment candidate discovery if they believe candidate collection is weak.

Recommendation:

- Require an operator runbook that constructs candidates from all BP-mutating events and sampled storage reads, not only `Buy` rows.
- Emit and persist every BP mutation with enough data to reconstruct the candidate universe.
- Add a pre-distribution report comparing candidate top-3 against independent sources: indexer replay, direct RPC reads for known BP earners, and event-log derived candidate set.
- Consider adding pagination/stateful finalization if the expected BP candidate set is small enough to handle onchain in chunks.

Suggested severity: Medium. The issue is operational rather than unprivileged theft, but the affected prize share is large.

### M-05: Launch-anchor value is documented as economic policy but not enforced by the LP sink

Affected code and docs:

- `contracts/src/sinks/DoubLPIncentives.sol`
- `docs/onchain/fee-routing-and-governance.md`
- `contracts/PARAMETERS.md`
- `frontend/src/lib/timeCurvePodiumMath.ts`

The docs and frontend helpers emphasize a **1.275×** launch anchor (product raised from the **1.2×** figure in this review snapshot — [GitLab #158](https://gitlab.com/PlasticDigits/yieldomega/-/issues/158)): DOUB/CL8Y locked liquidity should seed at **1.275×** the final per-CHARM clearing price, making a participant's CHARM projected CL8Y-at-launch non-decreasing in the no-referral path. That is a powerful believer-facing claim.

The actual LP fee sink is a governed sink/custody surface, not a contract that enforces the **1.275×** pool creation, lock timing, Kumbaya band, or DOUB/CL8Y ratio. If launch liquidity is delayed, manually seeded at a different price, partially funded, or arbitraged before ordinary participants can act, the reported CL8Y-at-launch value can become misleading.

Impact:

- Early believers may optimize for a projected CL8Y launch value that is operationally fragile.
- Sharks may arbitrage between TimeCurve implied value, launch pool price, and Rabbit redemption assumptions.
- If LP execution lags redemption or podium payout gates, post-sale users can face confusing or stale valuation signals.

Recommendation:

- Add a launch runbook gate: before enabling redemption/podium payouts, verify final price, DOUB amount, CL8Y amount, LP lock, Kumbaya band, and onchain transaction hashes.
- Keep frontend projected launch value explicitly labeled as policy until the LP is actually seeded and locked.
- Consider moving critical launch-anchor enforcement into a dedicated contract if the **documented launch-anchor multiplier** guarantee is meant to be protocol-enforced rather than operational.

Suggested severity: Medium. This is an operational/economic guarantee risk, not a Solidity exploit.

### L-01: UTC steal cap boundaries allow short-window burst pressure

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `docs/product/primitives.md`

WarBow limits normal steals to three per victim per UTC day and three per attacker per UTC day before a 50 CL8Y bypass burn is required. Since `day = block.timestamp / 86400`, attackers can time steals just before and just after UTC rollover. A high-BP early believer can therefore receive up to six normal-cost steals in a short real-time window from a coordinated set, before bypass burns become necessary.

Impact:

- Guarded or unguarded leaders can experience sudden BP drawdown around UTC boundaries.
- UX that shows "daily cap hit" can be misleading near rollover.
- Sharks may concentrate attacks at predictable global boundaries.

Recommendation:

- Document UTC rollover burst behavior in WarBow strategy/UX.
- Model UTC rollover attack windows.
- If this is not desired, consider rolling 24h windows instead of calendar-day buckets, accepting higher state/storage complexity.

Suggested severity: Low.

### L-02: Flag claim/penalty ordering is intentionally adversarial but likely under-disclosed

Affected code and docs:

- `contracts/src/TimeCurve.sol`
- `docs/product/primitives.md`

If a buyer plants a WarBow flag, waits 300 seconds, and no other buyer interrupts, `claimWarBowFlag` awards 1000 BP. If another buyer purchases after the silence window but before the claim lands, the former holder loses 2000 BP. Claim and buy ordering in the same block is therefore a high-value ordering game.

This can be good shark-vs-shark design: it creates a visible trap and forces predators to monitor each other. It can also surprise ordinary believers who assume waiting out the timer creates a safe claim.

Impact:

- Searchers/builders can reorder around claim/buy races.
- A believer can lose more BP than the flag would have awarded.
- The mechanic can turn passive holding into a liability after the claim window opens.

Recommendation:

- Present flag planting as an explicit high-risk PvP opt-in, not a passive reward.
- Encourage claim automation or fast claim UX only if the project is comfortable with automation arms races.
- Include same-block flag claim vs interrupt-buy scenarios in simulations and manual QA.

Suggested severity: Low.

### I-01: Existing simulations do not yet model the main shark-vs-shark failure modes

Affected files:

- `simulations/timecurve_sim/model.py`
- `simulations/timecurve_sim/monte_carlo.py`
- `simulations/tests/test_timecurve.py`

The simulation suite is useful for TimeCurve parameter tuning. It aligns with canonical timer policy, CHARM-envelope growth, buy-path WarBow BP, defended streaks, and concentration metrics. However, the PvP steal model is explicitly a toy random 10% drain and does not include the 2x rule, CL8Y burn costs, guard, revenge, daily caps, UTC rollover, flag penalties, referrals, presale CHARM weight, Kumbaya pay modes, or WarBow candidate finalization.

This matters because the unmodeled mechanics are exactly where shark-vs-shark behavior can stop benefiting early believers.

Recommendation:

- Add a dedicated `ecostrategy` simulation suite or extend `timecurve_sim` with strategy agents.
- Include metrics for early-believer retained value, late-shark ROI, controlled-wallet referral share, podium capture, WarBow BP capture, and sale duration grief.
- Treat simulation output as parameter evidence, not consensus logic.

Suggested severity: Informational.

## Intentional Shark Behavior

The following mechanics are adversarial by design and should generally be disclosed, modeled, and monitored rather than removed outright:

| Mechanic | Why it helps the game | Main risk to believers |
|----------|-----------------------|-------------------------|
| Last-buy podium | Forces late sharks to keep buying and funding the sale. | MEV/order flow can dominate final seconds. |
| Timer hard reset below 13m | Turns the endgame into visible, expensive contention. | Reset loops can extend the sale if prize EV exceeds buy cost. |
| Time-booster podium | Rewards participants who add actual time under cap. | Sybil wallets can farm many small extensions. |
| Defended streak | Rewards repeated defense near expiry. | Other wallets can bait and break streaks for BP. |
| WarBow steals | Lets lower-ranked players attack leaders, keeping sharks from entrenching. | Early high-BP believers are natural targets. |
| Guard | Makes defense available without full immunity. | Protection is expensive and still permits 1% drains. |
| Flag planting | Creates a PvP opt-in trap/reward. | Claimable flags become high-risk ordering races. |
| Referral CHARM | Incentivizes distribution without reserve rebates. | Common-control wallets can manufacture unpaid CHARM weight. |

The desired design target is not "no sharks." It is "sharks must pay the system or each other more than they extract from early believers." Several current mechanics plausibly meet that target, but the report findings above identify where the proof is missing.

## Believer Outcome Matrix

| Mechanic | Believer-positive effect | Believer-negative effect | Current confidence |
|----------|--------------------------|--------------------------|--------------------|
| Later no-referral buys | Increase implied CL8Y per DOUB and launch-anchor value. | Dilute DOUB per CHARM numerically. | High; documented invariant. |
| Referral buys | Increase gross raise and viral reach. | Add unpaid CHARM weight, diluting non-referred buyers. | Medium; needs scenario modeling. |
| Presale buyer bonus | Rewards pre-launch support. | Adds unpaid CHARM weight on every beneficiary buy. | Medium; intended but materially dilutive. |
| Per-wallet cooldown | Slows honest single-wallet repeat buys. | Does not slow multi-wallet operators. | High. |
| Last-buy podium | Funds race from late contenders. | Prize can be sniped by order-flow specialists. | Medium. |
| WarBow BP from buys | Makes ordinary buys count in PvP. | Base BP per buy favors many small sybil transactions. | Medium. |
| WarBow steals | Sharks attack each other instead of passively sitting on rank. | Early high-BP believers become prey. | Medium-low until modeled. |
| Guard/revenge | Gives leaders response tools. | Costs CL8Y and may recover less than stolen. | Medium-low. |
| Podium residual routing | Prevents empty-category funds from being stuck. | Residual destination benefits governance, not participants. | High; intentional ops policy. |
| Launch LP anchor | Turns late sale activity into early-holder projected value. | Operationally enforced, not protocol-enforced unless moved onchain. | Medium-low before launch evidence. |
| Rabbit fee slice | Should strengthen ecosystem reserves. | Direct transfers may not book into Rabbit accounting. | Low until H-01 resolved. |

## Strategy Scenarios To Model Before Mainnet

### Scenario A: Honest Believers vs No-Referral Late Sharks

Parameters:

- Early cohort buys in first 24 hours and never participates in WarBow.
- Late sharks buy without referrals across final windows.
- Measure early cohort CL8Y-at-launch projection, DOUB share, podium leakage, and sale duration.

Expected healthy result: early cohort's launch-anchor value increases as late sharks fight over reserve prizes.

### Scenario B: Controlled Referral Shark Cluster

Parameters:

- One operator controls referrer wallet plus N buyer wallets.
- Vary referred-buy share from 25% to 80%.
- Include presale beneficiary and non-beneficiary versions.

Expected healthy result: growth benefit from referred volume exceeds unpaid CHARM dilution to ordinary early buyers. If not, cap or disclose.

### Scenario C: WarBow Predator Swarm Against Early BP Leader

Parameters:

- Early believer builds high BP through buys/flag.
- Multiple low-BP sharks attack under 2x rule, including UTC rollover, guard, revenge, and bypass burns.
- Measure net BP transfer, CL8Y burned, WarBow podium probability, and early believer retained value.

Expected healthy result: attacks burn enough CL8Y and/or expose enough counterplay that early leaders are not systematically farmed.

### Scenario D: Final-Window MEV and Flag Ordering

Parameters:

- Competing buys and flag claims enter the same block.
- Builder ordering varies across claim-before-buy and buy-before-claim.
- Include hard-reset threshold, clutch bonus, last-buy slot, and flag penalty.

Expected healthy result: ordering risk is explicit and economically acceptable, not hidden from opt-in users.

### Scenario E: Rabbit and Launch Anchor Settlement

Parameters:

- TimeCurve ends at several raise levels.
- Test LP anchor execution on time, delayed, mispriced, and partially seeded.
- Test Rabbit fee booking through direct transfer vs `receiveFee`.

Expected healthy result: buyer-facing launch value and Rabbit health charts match onchain accounting.

## Recommended Remediation Queue

1. Resolve H-01 by defining and testing the Rabbit fee-routing integration path.
2. Extend simulations to include referral/presale weight and real WarBow PvP.
3. Add a launch-anchor operational checklist with required tx hashes and gates before redemption messaging becomes final.
4. Add WarBow finalization candidate runbook and independent candidate reconciliation.
5. Improve UX disclosures for referral dilution, WarBow BP contestability, flag penalty risk, and UTC cap boundaries.
6. Decide whether sybil cooldown bypass is accepted game texture or needs parameter changes that make per-buy rewards less attractive.

## Conclusion

Yieldomega's current TimeCurve design has the right ingredients for shark-vs-shark behavior that benefits early believers: late contestability, reserve-funded prize races, rising gross raise, burn/liquidity routing, and a launch-anchor narrative. The design is strongest when shark activity is forced to add CL8Y value to the system.

The unresolved question is whether sharks can extract more through unpaid CHARM weight, sybil pacing, WarBow predation, operational finalization, and launch/Rabbit coupling than they contribute through gross buys and burns. That question is answerable with targeted modeling and one critical accounting integration fix. Until then, the system should avoid overclaiming guaranteed early-buyer protection and should describe several mechanics as adversarial opt-in games, not passive rewards.
