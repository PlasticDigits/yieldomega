// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {IReferralRegistry} from "./interfaces/IReferralRegistry.sol";
import {ITimeArenaReferralBurn} from "./interfaces/ITimeArenaReferralBurn.sol";

/// @title ReferralRegistry — short codes registered by burning DOUB
/// @notice Registration burn = `epochCharmAnchorWad` from linked `TimeArena` (DOUB wei per 1e18 CHARM
///         at the start of the current Last Buy epoch). Re-anchors when the epoch rolls.
///         See docs/product/referrals.md for code rules and economics.
///         Production: UUPS proxy; **proxy address** is canonical (GitLab #54).
contract ReferralRegistry is Initializable, Ownable2StepUpgradeable, UUPSUpgradeable, IReferralRegistry {
    using SafeERC20 for IERC20;

    /// @dev Irreversible burn sink (not EOA-controlled).
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @dev Linked `TimeArena` proxy — set once after deploy (`setTimeArena`).
    address public timeArena;
    /// @dev Deprecated fixed CL8Y burn slot (v1). Retained for UUPS layout; amount is dynamic from `timeArena`.
    uint256 private __deprecatedRegistrationBurnAmount;

    mapping(bytes32 codeHash => address owner) public codeOwner;
    mapping(address owner => bytes32 codeHash) public ownerCode;

    event ReferralCodeRegistered(address indexed owner, bytes32 indexed codeHash, string normalizedCode);
    event TimeArenaLinked(address indexed arena);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
        __Ownable2Step_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Wire the canonical `TimeArena` proxy once (DeployDev / DeployProduction).
    function setTimeArena(address arena) external onlyOwner {
        require(arena != address(0), "ReferralRegistry: zero arena");
        require(timeArena == address(0), "ReferralRegistry: arena set");
        timeArena = arena;
        emit TimeArenaLinked(arena);
    }

    /// @notice DOUB token burned on `registerCode` (from `TimeArena.doub()`).
    function doubToken() external view returns (address) {
        return address(_doub());
    }

    /// @notice Legacy ABI alias — returns `doubToken()` for older clients.
    function cl8yToken() external view returns (address) {
        return address(_doub());
    }

    /// @notice Current registration burn in DOUB wei (= Last Buy epoch `epochCharmAnchorWad`).
    function registrationBurnAmount() external view returns (uint256) {
        return _registrationBurnDoub();
    }

    /// @notice Hash used by `TimeArena.buy(charmWad, codeHash)`; same as `keccak256(bytes(normalized))`.
    function hashCode(string calldata code) external pure returns (bytes32) {
        return _hashNormalized(_normalizeToBytes(code));
    }

    /// @inheritdoc IReferralRegistry
    function ownerOfCode(bytes32 codeHash) external view returns (address owner) {
        return codeOwner[codeHash];
    }

    /// @notice Register a unique code; burns `_registrationBurnDoub()` DOUB from the caller on success only.
    /// @dev Code ownership follows the **first successful inclusion** among competing `registerCode` calls—there is no
    ///      mempool FIFO or offchain reservation. The normalized string is plain calldata **before execution**, so
    ///      public observers may race the same slug; the DOUB burn (paid only after uniqueness checks pass)
    ///      is the deliberate economic deterrent to casual squatting. Product disclosure: docs/product/referrals.md —
    ///      Registration ordering (#121).
    function registerCode(string calldata code) external {
        bytes memory norm = _normalizeToBytes(code);
        bytes32 h = _hashNormalized(norm);
        require(h != bytes32(0), "ReferralRegistry: invalid code");
        require(codeOwner[h] == address(0), "ReferralRegistry: code taken");
        require(ownerCode[msg.sender] == bytes32(0), "ReferralRegistry: already registered");

        uint256 burnAmt = _registrationBurnDoub();
        IERC20 doub = _doub();
        uint256 burnSinkBefore = doub.balanceOf(BURN_ADDRESS);
        doub.safeTransferFrom(msg.sender, BURN_ADDRESS, burnAmt);
        require(doub.balanceOf(BURN_ADDRESS) - burnSinkBefore == burnAmt, "ReferralRegistry: ERC20 parity");

        codeOwner[h] = msg.sender;
        ownerCode[msg.sender] = h;

        emit ReferralCodeRegistered(msg.sender, h, string(norm));
    }

    function _registrationBurnDoub() internal view returns (uint256) {
        require(timeArena != address(0), "ReferralRegistry: arena unset");
        ITimeArenaReferralBurn arena = ITimeArenaReferralBurn(timeArena);
        uint256 anchor = arena.epochCharmAnchorWad();
        if (anchor == 0) anchor = arena.charmPriceWad();
        require(anchor > 0, "ReferralRegistry: zero burn");
        return anchor;
    }

    function _doub() internal view returns (IERC20) {
        require(timeArena != address(0), "ReferralRegistry: arena unset");
        return ITimeArenaReferralBurn(timeArena).doub();
    }

    function _hashNormalized(bytes memory norm) internal pure returns (bytes32) {
        return keccak256(norm);
    }

    /// @dev Lowercase A–Z, length 3–16, charset a–z and 0–9 after normalization.
    function _normalizeToBytes(string calldata code) internal pure returns (bytes memory b) {
        b = bytes(code);
        require(b.length >= 3 && b.length <= 16, "ReferralRegistry: invalid length");

        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                c += 32;
                b[i] = bytes1(c);
            }
            require((c >= 97 && c <= 122) || (c >= 48 && c <= 57), "ReferralRegistry: invalid charset");
        }
    }

    uint256[49] private __gap;
}
