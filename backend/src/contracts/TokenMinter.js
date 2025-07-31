"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenMinter = void 0;
// contracts/TokenMinter.ts
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
// Load environment variables from root directory
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, '..', '.env') });
const chains_1 = require("thirdweb/chains");
const wallets_1 = require("thirdweb/wallets");
const TierManager_1 = require("./TierManager");
const thirdweb_1 = require("thirdweb");
class TokenMinter {
    constructor() {
        // Check for THIRDWEB_CLIENT_ID or NEXT_PUBLIC_THIRDWEB_CLIENT_ID
        const clientId = process.env.THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
        const secretKey = process.env.THIRDWEB_SECRET_KEY;
        const privateKey = process.env.PRIVATE_KEY;
        if (!clientId || !secretKey || !privateKey) {
            throw new Error("Missing required environment variables");
        }
        this.client = (0, thirdweb_1.createThirdwebClient)({
            clientId: clientId,
            secretKey: secretKey,
        });
        this.account = (0, wallets_1.privateKeyToAccount)({
            client: this.client,
            privateKey: privateKey,
        });
        this.contractAddress = process.env.REPAIRCOIN_CONTRACT_ADDRESS;
        this.tierManager = new TierManager_1.TierManager();
    }
    // Main function: Mint tokens for repair jobs
    async mintRepairTokens(customerAddress, repairAmount, shopId, customerData) {
        try {
            console.log(`🔨 Processing repair: $${repairAmount} for ${customerAddress} at shop ${shopId}`);
            // Validate inputs
            if (repairAmount < 50) {
                return {
                    success: false,
                    message: `Repair amount $${repairAmount} too low. Minimum $50 required.`
                };
            }
            if (!this.isValidAddress(customerAddress)) {
                return {
                    success: false,
                    message: "Invalid customer address format"
                };
            }
            // Calculate tokens based on RepairCoin business rules
            let tokensToMint;
            if (repairAmount >= 100) {
                tokensToMint = 25; // $100+ repair = 25 RCN
            }
            else if (repairAmount >= 50) {
                tokensToMint = 10; // $50-99 repair = 10 RCN
            }
            else {
                return {
                    success: false,
                    message: `Repair amount $${repairAmount} too low. Minimum $50 required.`
                };
            }
            // Check earning limits
            if (!this.tierManager.canEarnToday(customerData, tokensToMint)) {
                return {
                    success: false,
                    message: "Daily earning limit (40 RCN) exceeded"
                };
            }
            if (!this.tierManager.canEarnThisMonth(customerData, tokensToMint)) {
                return {
                    success: false,
                    message: "Monthly earning limit (500 RCN) exceeded"
                };
            }
            // Mint the tokens
            const result = await this.mintTokens(customerAddress, tokensToMint, `repair_${shopId}_${Date.now()}`);
            if (result.success) {
                // Calculate new tier after earning
                const newLifetimeEarnings = customerData.lifetimeEarnings + tokensToMint;
                const newTier = this.tierManager.calculateTier(newLifetimeEarnings);
                return {
                    ...result,
                    message: `Minted ${tokensToMint} RCN for $${repairAmount} repair at shop ${shopId}`,
                    newTier: newTier
                };
            }
            return result;
        }
        catch (error) {
            console.error("Error in mintRepairTokens:", error);
            return {
                success: false,
                error: `Repair token minting failed: ${error.message}`
            };
        }
    }
    // Mint tokens for successful referrals
    async mintReferralTokens(referrerAddress, refereeAddress, shopId) {
        try {
            console.log(`👥 Processing referral: ${referrerAddress} → ${refereeAddress}`);
            // Validate addresses
            if (!this.isValidAddress(referrerAddress) || !this.isValidAddress(refereeAddress)) {
                return {
                    success: false,
                    message: "Invalid referrer or referee address format"
                };
            }
            if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
                return {
                    success: false,
                    message: "Referrer and referee cannot be the same address"
                };
            }
            const referralId = `referral_${Date.now()}`;
            // Mint 25 RCN to referrer
            const referrerResult = await this.mintTokens(referrerAddress, 25, `${referralId}_referrer`);
            if (!referrerResult.success) {
                return {
                    ...referrerResult,
                    message: `Failed to mint referrer tokens: ${referrerResult.error}`
                };
            }
            // Mint 10 RCN to referee  
            const refereeResult = await this.mintTokens(refereeAddress, 10, `${referralId}_referee`);
            if (!refereeResult.success) {
                // Log warning but don't fail completely since referrer was already paid
                console.warn("Referee minting failed but referrer was paid:", refereeResult.error);
                return {
                    success: false,
                    message: `Referrer paid but referee minting failed: ${refereeResult.error}`,
                    tokensToMint: 25 // Referrer still got paid
                };
            }
            return {
                success: true,
                message: `Referral rewards minted: 25 RCN to referrer, 10 RCN to referee`,
                tokensToMint: 35, // Total minted
                transactionHash: refereeResult.transactionHash // Use last transaction hash
            };
        }
        catch (error) {
            console.error("Error in mintReferralTokens:", error);
            return {
                success: false,
                error: `Referral token minting failed: ${error.message}`
            };
        }
    }
    // Mint tokens for platform engagement (ads, forms, etc.)
    async mintEngagementTokens(params) {
        try {
            console.log(`🎯 Processing engagement: ${params.engagementType} for ${params.customerAddress}`);
            // Get tier multiplier
            const multiplier = this.tierManager.getEngagementMultiplier(params.customerData.tier);
            const tokensToMint = Math.floor(params.baseAmount * multiplier);
            // Check earning limits
            if (!this.tierManager.canEarnToday(params.customerData, tokensToMint)) {
                return {
                    success: false,
                    message: "Daily earning limit (40 RCN) exceeded"
                };
            }
            if (!this.tierManager.canEarnThisMonth(params.customerData, tokensToMint)) {
                return {
                    success: false,
                    message: "Monthly earning limit (500 RCN) exceeded"
                };
            }
            // Mint the tokens
            const result = await this.mintTokens(params.customerAddress, tokensToMint, `engagement_${params.engagementType}_${Date.now()}`);
            if (result.success) {
                return {
                    ...result,
                    message: `Minted ${tokensToMint} RCN for ${params.engagementType} (${multiplier}x ${params.customerData.tier} multiplier)`
                };
            }
            return result;
        }
        catch (error) {
            console.error("Error in mintEngagementTokens:", error);
            return {
                success: false,
                error: `Engagement token minting failed: ${error.message}`
            };
        }
    }
    // Emergency functions for admin use
    async pauseContract() {
        try {
            console.log("⏸️  Attempting to pause contract...");
            const contract = await this.getContract();
            const transaction = (0, thirdweb_1.prepareContractCall)({
                contract,
                method: "pause", // Type assertion
                params: []
            });
            const result = await (0, thirdweb_1.sendTransaction)({
                transaction,
                account: this.account,
            });
            return {
                success: true,
                message: "Contract paused successfully",
                transactionHash: result.transactionHash
            };
        }
        catch (error) {
            console.log("Pause method not supported on this contract");
            return {
                success: false,
                error: "Pause not supported: " + error.message
            };
        }
    }
    async unpauseContract() {
        try {
            console.log("▶️  Attempting to unpause contract...");
            const contract = await this.getContract();
            const transaction = (0, thirdweb_1.prepareContractCall)({
                contract,
                method: "unpause", // Type assertion
                params: []
            });
            const result = await (0, thirdweb_1.sendTransaction)({
                transaction,
                account: this.account,
            });
            return {
                success: true,
                message: "Contract unpaused successfully",
                transactionHash: result.transactionHash
            };
        }
        catch (error) {
            console.log("Unpause method not supported on this contract");
            return {
                success: false,
                error: "Unpause not supported: " + error.message
            };
        }
    }
    // Check if contract is paused
    async isContractPaused() {
        try {
            const contract = await this.getContract();
            try {
                // Try the most common pause method
                const paused = await (0, thirdweb_1.readContract)({
                    contract,
                    method: "paused", // Type assertion to bypass strict typing
                    params: []
                });
                console.log(`✅ Pause status: ${paused}`);
                return !!paused; // Convert to boolean
            }
            catch (error) {
                // If pause method doesn't exist, just assume not paused
                console.log("ℹ️  No pause method found, assuming unpaused");
                return false;
            }
        }
        catch (error) {
            console.warn("Could not check pause status, assuming unpaused");
            return false;
        }
    }
    // Get contract balance and statistics
    async getContractStats() {
        try {
            const contract = await this.getContract();
            const stats = {
                contractAddress: this.contractAddress,
                network: "Base Sepolia",
                isPaused: false,
                totalSupplyReadable: 0
            };
            // Try to get total supply (most contracts have this)
            try {
                const totalSupply = await (0, thirdweb_1.readContract)({
                    contract,
                    method: "function totalSupply() view returns (uint256)",
                    params: []
                });
                stats.totalSupply = totalSupply.toString();
                stats.totalSupplyReadable = Number(totalSupply) / Math.pow(10, 18);
            }
            catch (error) {
                console.warn("Could not get total supply");
                stats.totalSupplyReadable = 0;
            }
            // Try to get pause status
            stats.isPaused = await this.isContractPaused();
            // Try to get contract name and symbol
            try {
                const name = await (0, thirdweb_1.readContract)({
                    contract,
                    method: "name",
                    params: []
                });
                const symbol = await (0, thirdweb_1.readContract)({
                    contract,
                    method: "symbol",
                    params: []
                });
                stats.name = name;
                stats.symbol = symbol;
            }
            catch (error) {
                console.warn("Could not get contract name/symbol");
            }
            return stats;
        }
        catch (error) {
            console.error("Error getting contract stats:", error);
            return {
                contractAddress: this.contractAddress,
                network: "Base Sepolia",
                error: "Could not fetch contract stats",
                totalSupplyReadable: 0,
                isPaused: false
            };
        }
    }
    // Private function to mint tokens to an address
    async mintTokens(toAddress, amount, reference) {
        try {
            console.log(`🪙 Minting ${amount} RCN to ${toAddress}${reference ? ` (ref: ${reference})` : ''}`);
            // Check if contract is paused
            const paused = await this.isContractPaused();
            if (paused) {
                return {
                    success: false,
                    error: "Contract is currently paused"
                };
            }
            const contract = await this.getContract();
            const mintAmount = BigInt(amount * Math.pow(10, 18)); // Convert to wei (18 decimals)
            const transaction = (0, thirdweb_1.prepareContractCall)({
                contract,
                method: "function mintTo(address to, uint256 amount) public",
                params: [toAddress, mintAmount]
            });
            const result = await (0, thirdweb_1.sendTransaction)({
                transaction,
                account: this.account,
            });
            console.log(`✅ Minted ${amount} RCN successfully. TX: ${result.transactionHash}`);
            return {
                success: true,
                tokensToMint: amount,
                transactionHash: result.transactionHash,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error("Error in mintTokens:", error);
            // Provide specific error messages
            if (error.message.includes("AccessControl")) {
                return {
                    success: false,
                    error: "Insufficient permissions to mint tokens. Grant MINTER_ROLE to this wallet."
                };
            }
            else if (error.message.includes("insufficient funds")) {
                return {
                    success: false,
                    error: "Insufficient ETH for gas fees. Fund your wallet with Base Sepolia ETH."
                };
            }
            else if (error.message.includes("paused")) {
                return {
                    success: false,
                    error: "Contract is paused. Unpause to continue minting."
                };
            }
            return {
                success: false,
                error: error.message
            };
        }
    }
    // Helper function to get contract instance
    async getContract() {
        return (0, thirdweb_1.getContract)({
            client: this.client,
            chain: chains_1.baseSepolia,
            address: this.contractAddress,
        });
    }
    // Helper function to validate Ethereum addresses
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    // Get customer balance
    async getCustomerBalance(customerAddress) {
        try {
            const contract = await this.getContract();
            const balance = await (0, thirdweb_1.readContract)({
                contract,
                method: "function balanceOf(address) view returns (uint256)",
                params: [customerAddress]
            });
            return Number(balance) / Math.pow(10, 18);
        }
        catch (error) {
            console.error("Error getting customer balance:", error);
            return null;
        }
    }
    // Batch mint for multiple customers (admin function)
    async batchMintTokens(recipients) {
        console.log(`🔄 Batch minting to ${recipients.length} recipients...`);
        const results = [];
        for (const recipient of recipients) {
            try {
                const result = await this.mintTokens(recipient.address, recipient.amount, recipient.reason);
                results.push(result);
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                results.push({
                    success: false,
                    error: `Batch mint failed for ${recipient.address}: ${error.message}`
                });
            }
        }
        const successful = results.filter(r => r.success).length;
        console.log(`✅ Batch mint complete: ${successful}/${recipients.length} successful`);
        return results;
    }
}
exports.TokenMinter = TokenMinter;
