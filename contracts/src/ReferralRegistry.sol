// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IReferralRegistry} from "./interfaces/IReferralRegistry.sol";

/// @title ReferralRegistry — short codes registered by burning CL8Y
/// @notice See docs/product/referrals.md for code rules and economics.
contract ReferralRegistry is IReferralRegistry {
    using SafeERC20 for IERC20;

    /// @dev Irreversible burn sink (not EOA-controlled).
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    IERC20 public immutable cl8yToken;
    uint256 public immutable registrationBurnAmount;

    mapping(bytes32 codeHash => address owner) public codeOwner;
    mapping(address owner => bytes32 codeHash) public ownerCode;

    event ReferralCodeRegistered(address indexed owner, bytes32 indexed codeHash, string normalizedCode);

    constructor(IERC20 _cl8yToken, uint256 _registrationBurnAmount) {
        require(address(_cl8yToken) != address(0), "ReferralRegistry: zero CL8Y");
        require(_registrationBurnAmount > 0, "ReferralRegistry: zero burn");
        cl8yToken = _cl8yToken;
        registrationBurnAmount = _registrationBurnAmount;
    }

    /// @notice Hash used by `TimeCurve.buy(amount, codeHash)`; same as `keccak256(bytes(normalized))`.
    function hashCode(string calldata code) external pure returns (bytes32) {
        return _hashNormalized(_normalizeToBytes(code));
    }

    /// @inheritdoc IReferralRegistry
    function ownerOfCode(bytes32 codeHash) external view returns (address owner) {
        return codeOwner[codeHash];
    }

    /// @notice Register a unique code; burns `registrationBurnAmount` of CL8Y from the caller.
    function registerCode(string calldata code) external {
        bytes memory norm = _normalizeToBytes(code);
        bytes32 h = _hashNormalized(norm);
        require(h != bytes32(0), "ReferralRegistry: invalid code");
        require(codeOwner[h] == address(0), "ReferralRegistry: code taken");
        require(ownerCode[msg.sender] == bytes32(0), "ReferralRegistry: already registered");

        cl8yToken.safeTransferFrom(msg.sender, BURN_ADDRESS, registrationBurnAmount);

        codeOwner[h] = msg.sender;
        ownerCode[msg.sender] = h;

        emit ReferralCodeRegistered(msg.sender, h, string(norm));
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
            require(
                (c >= 97 && c <= 122) || (c >= 48 && c <= 57),
                "ReferralRegistry: invalid charset"
            );
        }
    }
}
