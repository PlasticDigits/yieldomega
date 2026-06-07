// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ArenaBuyRouting} from "./libraries/ArenaBuyRouting.sol";

/// @notice Registry + balance holder for four active + four seed + four future DOUB podium pools.
contract PodiumVaults is Ownable {
    IERC20 public immutable doub;
    address public arena;
    address[4] public activePools;
    address[4] public seedPools;
    address[4] public futurePools;

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
        if (amtFirst > 0 && first != address(0)) doub.transfer(first, amtFirst);
        if (amtSecond > 0 && second != address(0)) doub.transfer(second, amtSecond);
        if (amtThird > 0 && third != address(0)) doub.transfer(third, amtThird);
    }

    /// @dev Manual top-up path: promote seed → active only (GitLab #261).
    function rollSeedToActive(uint8 podiumId) external returns (uint256 moved) {
        require(msg.sender == arena, "PodiumVaults: not arena");
        address seed = seedPools[podiumId];
        address active = activePools[podiumId];
        moved = doub.balanceOf(seed);
        if (moved > 0) {
            doub.transfer(active, moved);
        }
    }

    /// @dev Buy epoch tranches: future → seed, then seed → active (GitLab #300).
    function rollEpochTranches(uint8 podiumId) external returns (uint256 movedToSeed, uint256 movedToActive) {
        require(msg.sender == arena, "PodiumVaults: not arena");
        address future = futurePools[podiumId];
        address seed = seedPools[podiumId];
        address active = activePools[podiumId];
        movedToSeed = doub.balanceOf(future);
        if (movedToSeed > 0) {
            doub.transfer(seed, movedToSeed);
        }
        movedToActive = doub.balanceOf(seed);
        if (movedToActive > 0) {
            doub.transfer(active, movedToActive);
        }
    }

    function activePoolBalance(uint8 podiumId) external view returns (uint256) {
        return doub.balanceOf(activePools[podiumId]);
    }

    function seedPoolBalance(uint8 podiumId) external view returns (uint256) {
        return doub.balanceOf(seedPools[podiumId]);
    }

    function futurePoolBalance(uint8 podiumId) external view returns (uint256) {
        return doub.balanceOf(futurePools[podiumId]);
    }
}
