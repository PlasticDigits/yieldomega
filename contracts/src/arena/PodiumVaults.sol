// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ArenaBuyRouting} from "./libraries/ArenaBuyRouting.sol";
import {PodiumTranchePool} from "./PodiumTranchePool.sol";

/// @notice Registry + balance holder for four active + four seed + four future DOUB podium pools.
contract PodiumVaults is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable doub;
    address public arena;
    address[4] public activePools;
    address[4] public seedPools;
    address[4] public futurePools;

    /// @dev Per-category tranche balances when pools share `address(this)` (default wiring).
    uint256[4] private _activeLedger;
    uint256[4] private _seedLedger;
    uint256[4] private _futureLedger;

    event PodiumFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);
    event SeedFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);
    /// @dev Buy routing: funds a specific target epoch pool (GitLab #300).
    event PodiumEpochFunded(uint8 indexed category, uint256 indexed epoch, uint256 amount, address indexed pool);

    constructor(IERC20 doubToken, address owner_) Ownable(owner_) {
        require(address(doubToken) != address(0), "PodiumVaults: zero doub");
        doub = doubToken;
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            activePools[i] = address(this);
            seedPools[i] = address(this);
            futurePools[i] = address(this);
        }
    }

    function setArena(address arena_) external onlyOwner {
        require(arena_ != address(0), "PodiumVaults: zero arena");
        arena = arena_;
    }

    function setActivePool(uint8 podiumId, address pool) external onlyOwner {
        require(podiumId < ArenaBuyRouting.NUM_PODIUMS, "PodiumVaults: bad id");
        require(pool != address(0), "PodiumVaults: zero pool");
        activePools[podiumId] = pool;
    }

    function setSeedPool(uint8 podiumId, address pool) external onlyOwner {
        require(podiumId < ArenaBuyRouting.NUM_PODIUMS, "PodiumVaults: bad id");
        require(pool != address(0), "PodiumVaults: zero pool");
        seedPools[podiumId] = pool;
    }

    function setFuturePool(uint8 podiumId, address pool) external onlyOwner {
        require(podiumId < ArenaBuyRouting.NUM_PODIUMS, "PodiumVaults: bad id");
        require(pool != address(0), "PodiumVaults: zero pool");
        futurePools[podiumId] = pool;
    }

    function notifyPodiumFunded(uint8 podiumId, uint256 amount, address pool) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        emit PodiumFunded(podiumId, amount, pool);
    }

    function notifySeedFunded(uint8 podiumId, uint256 amount, address pool) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        emit SeedFunded(podiumId, amount, pool);
    }

    function notifyPodiumEpochFunded(uint8 category, uint256 epoch, uint256 amount, address pool) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        emit PodiumEpochFunded(category, epoch, amount, pool);
    }

    /// @dev Credit a category tranche when DOUB is routed to a commingled pool (`address(this)`).
    /// @param tranche 0=active, 1=seed, 2=future.
    function creditTranche(uint8 podiumId, uint8 tranche, uint256 amount) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        require(podiumId < ArenaBuyRouting.NUM_PODIUMS, "PodiumVaults: bad id");
        require(tranche <= 2, "PodiumVaults: bad tranche");
        if (amount == 0) return;
        address pool = tranche == 0
            ? activePools[podiumId]
            : (tranche == 1 ? seedPools[podiumId] : futurePools[podiumId]);
        if (pool != address(this)) return;
        if (tranche == 0) {
            _activeLedger[podiumId] += amount;
        } else if (tranche == 1) {
            _seedLedger[podiumId] += amount;
        } else {
            _futureLedger[podiumId] += amount;
        }
    }

    /// @notice Pay 4:2:1 from active pool and roll seed → active (caller settles accounting).
    function payPodiumWinners(
        uint8 podiumId,
        address first,
        address second,
        address third,
        uint256 amtFirst,
        uint256 amtSecond,
        uint256 amtThird
    ) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        uint256 total = amtFirst + amtSecond + amtThird;
        if (activePools[podiumId] == address(this) && total > 0) {
            require(_activeLedger[podiumId] >= total, "PodiumVaults: ledger underflow");
            _activeLedger[podiumId] -= total;
        }
        address active = activePools[podiumId];
        if (amtFirst > 0 && first != address(0)) _moveFromPool(active, first, amtFirst);
        if (amtSecond > 0 && second != address(0)) _moveFromPool(active, second, amtSecond);
        if (amtThird > 0 && third != address(0)) _moveFromPool(active, third, amtThird);
    }

    /// @dev Manual top-up path: promote seed → active only (GitLab #261).
    function rollSeedToActive(uint8 podiumId) external returns (uint256 moved) {
        require(msg.sender == arena, "PodiumVaults: not arena");
        address seed = seedPools[podiumId];
        address active = activePools[podiumId];
        if (seed == address(this) && active == address(this)) {
            moved = _seedLedger[podiumId];
            if (moved > 0) {
                _seedLedger[podiumId] = 0;
                _activeLedger[podiumId] += moved;
            }
            return moved;
        }
        moved = doub.balanceOf(seed);
        if (moved > 0) {
            _moveFromPool(seed, active, moved);
        }
    }

    /// @dev Buy epoch tranches: future → seed, then seed → active (GitLab #300).
    function rollEpochTranches(uint8 podiumId) external returns (uint256 movedToSeed, uint256 movedToActive) {
        require(msg.sender == arena, "PodiumVaults: not arena");
        address future = futurePools[podiumId];
        address seed = seedPools[podiumId];
        address active = activePools[podiumId];
        if (future == address(this) && seed == address(this) && active == address(this)) {
            movedToSeed = _futureLedger[podiumId];
            if (movedToSeed > 0) {
                _futureLedger[podiumId] = 0;
                _seedLedger[podiumId] += movedToSeed;
            }
            movedToActive = _seedLedger[podiumId];
            if (movedToActive > 0) {
                _seedLedger[podiumId] = 0;
                _activeLedger[podiumId] += movedToActive;
            }
            return (movedToSeed, movedToActive);
        }
        movedToSeed = doub.balanceOf(future);
        if (movedToSeed > 0) {
            _moveFromPool(future, seed, movedToSeed);
        }
        movedToActive = doub.balanceOf(seed);
        if (movedToActive > 0) {
            _moveFromPool(seed, active, movedToActive);
        }
    }

    /// @dev Commingled pools debit `address(this)`; external pools use `PodiumTranchePool.pushTo`.
    function _moveFromPool(address from, address to, uint256 amount) private {
        if (amount == 0) return;
        if (from == address(this)) {
            doub.safeTransfer(to, amount);
        } else {
            require(from.code.length > 0, "PodiumVaults: external pool not contract");
            PodiumTranchePool(from).pushTo(to, amount);
        }
    }

    function activePoolBalance(uint8 podiumId) external view returns (uint256) {
        if (activePools[podiumId] == address(this)) {
            return _activeLedger[podiumId];
        }
        return doub.balanceOf(activePools[podiumId]);
    }

    function seedPoolBalance(uint8 podiumId) external view returns (uint256) {
        if (seedPools[podiumId] == address(this)) {
            return _seedLedger[podiumId];
        }
        return doub.balanceOf(seedPools[podiumId]);
    }

    function futurePoolBalance(uint8 podiumId) external view returns (uint256) {
        if (futurePools[podiumId] == address(this)) {
            return _futureLedger[podiumId];
        }
        return doub.balanceOf(futurePools[podiumId]);
    }
}
