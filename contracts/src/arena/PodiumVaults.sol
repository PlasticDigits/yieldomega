// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ArenaBuyRouting} from "./libraries/ArenaBuyRouting.sol";

/// @notice Registry + balance holder for four active + four seed DOUB podium pools.
contract PodiumVaults is Ownable {
    IERC20 public immutable doub;
    address public arena;
    address[4] public activePools;
    address[4] public seedPools;

    event PodiumFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);
    event SeedFunded(uint8 indexed podiumId, uint256 amount, address indexed pool);

    constructor(IERC20 doubToken, address owner_) Ownable(owner_) {
        require(address(doubToken) != address(0), "PodiumVaults: zero doub");
        doub = doubToken;
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            activePools[i] = address(this);
            seedPools[i] = address(this);
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

    function notifyPodiumFunded(uint8 podiumId, uint256 amount, address pool) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        emit PodiumFunded(podiumId, amount, pool);
    }

    function notifySeedFunded(uint8 podiumId, uint256 amount, address pool) external {
        require(msg.sender == arena, "PodiumVaults: not arena");
        emit SeedFunded(podiumId, amount, pool);
    }

    function activePoolBalance(uint8 podiumId) external view returns (uint256) {
        return doub.balanceOf(activePools[podiumId]);
    }

    function seedPoolBalance(uint8 podiumId) external view returns (uint256) {
        return doub.balanceOf(seedPools[podiumId]);
    }
}
