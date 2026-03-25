// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Leprechaun NFTs — collection, gameplay, and agent layer
/// @notice ERC-721 with onchain gameplay traits aligned to
///         docs/product/leprechaun-nfts.md and schemas/leprechaun-nft-metadata-v1.schema.json.
///         Series identifiers are machine-readable onchain.
contract LeprechaunNFT is ERC721Enumerable, AccessControlEnumerable {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;
    string public baseURI;

    // ── Onchain trait storage ──────────────────────────────────────────
    struct Traits {
        uint256 seriesId;
        uint8 rarityTier;        // 0=common, 1=uncommon, 2=rare, 3=epic, 4=legendary
        uint8 role;              // game role enum (implementation-defined)
        uint8 passiveEffectType;
        uint256 setId;
        uint8 setPosition;
        uint8 bonusCategory;     // 0=treasuryDeposit, 1=timerSkew, 2=feeDiscount
        uint256 bonusValue;      // fixed-point or integer within safe bounds
        uint256 synergyTag;      // composability key for cross-NFT effects
        bool agentTradable;
        bool agentLendable;
        bool factionLocked;
    }

    // ── Series config ──────────────────────────────────────────────────
    struct Series {
        uint256 maxSupply;
        uint256 minted;
        bool active;
    }

    mapping(uint256 => Traits) public tokenTraits;
    mapping(uint256 => Series) public series;
    uint256 public nextSeriesId;

    // ── Events ─────────────────────────────────────────────────────────
    event SeriesCreated(uint256 indexed seriesId, uint256 maxSupply);
    event Minted(uint256 indexed tokenId, uint256 indexed seriesId, address indexed to);

    constructor(string memory name_, string memory symbol_, string memory baseURI_, address admin)
        ERC721(name_, symbol_)
    {
        baseURI = baseURI_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ── Series management ──────────────────────────────────────────────

    function createSeries(uint256 maxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 seriesId) {
        require(maxSupply > 0, "NFT: zero supply");
        seriesId = nextSeriesId++;
        series[seriesId] = Series({maxSupply: maxSupply, minted: 0, active: true});
        emit SeriesCreated(seriesId, maxSupply);
    }

    // ── Minting ────────────────────────────────────────────────────────

    function mint(address to, Traits calldata traits) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        Series storage s = series[traits.seriesId];
        require(s.active, "NFT: series inactive");
        require(s.minted < s.maxSupply, "NFT: series full");

        tokenId = _nextTokenId++;
        s.minted += 1;
        tokenTraits[tokenId] = traits;
        _safeMint(to, tokenId);
        emit Minted(tokenId, traits.seriesId, to);
    }

    // ── Metadata ───────────────────────────────────────────────────────

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = newBaseURI;
    }

    // ── ERC-165 ────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControlEnumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
