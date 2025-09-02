// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RepairCoin V2
 * @dev Pure utility token for RepairCoin loyalty system
 * - Unlimited supply (no cap)
 * - Mintable by owner only
 * - Burnable by anyone (for redemptions)
 * - Pausable for emergencies
 */
contract RepairCoinV2 is ERC20, ERC20Burnable, Ownable, Pausable {
    // Events
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    
    // State variables
    uint256 public totalMinted;
    uint256 public totalBurned;
    
    // Optional: Track shop addresses for special permissions
    mapping(address => bool) public authorizedShops;
    
    constructor(address initialOwner) 
        ERC20("RepairCoin", "RCN") 
        Ownable(initialOwner) 
    {
        // No initial supply - pure utility model
    }
    
    /**
     * @dev Mint new tokens - only owner (admin)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param reason Reason for minting (for tracking)
     */
    function mint(address to, uint256 amount, string memory reason) public onlyOwner whenNotPaused {
        _mint(to, amount);
        totalMinted += amount;
        emit TokensMinted(to, amount, reason);
    }
    
    /**
     * @dev Override burn to track total burned
     */
    function burn(uint256 amount) public override whenNotPaused {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(_msgSender(), amount, "redemption");
    }
    
    /**
     * @dev Burn tokens from another address (with approval)
     */
    function burnFrom(address account, uint256 amount) public override whenNotPaused {
        super.burnFrom(account, amount);
        totalBurned += amount;
        emit TokensBurned(account, amount, "redemption");
    }
    
    /**
     * @dev Get circulating supply (minted - burned)
     */
    function circulatingSupply() public view returns (uint256) {
        return totalMinted - totalBurned;
    }
    
    /**
     * @dev Pause token transfers (emergency use only)
     */
    function pause() public onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Optional: Add/remove authorized shops
     */
    function setShopAuthorization(address shop, bool authorized) public onlyOwner {
        authorizedShops[shop] = authorized;
    }
    
    /**
     * @dev Override transfer to add pause functionality
     */
    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        super._update(from, to, amount);
    }
    
    /**
     * @dev Optional: Disable transfers between customers (utility token only)
     * Uncomment to restrict transfers to/from shops only
     */
    /*
    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        require(
            from == address(0) || // Minting
            to == address(0) ||   // Burning
            owner() == from ||    // From admin
            owner() == to ||      // To admin
            authorizedShops[from] || // From shop
            authorizedShops[to],     // To shop
            "Transfers restricted to shops only"
        );
        super._update(from, to, amount);
    }
    */
}