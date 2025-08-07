// contracts/TokenMinter.ts
import { config } from 'dotenv';
import path from 'path';
// Load environment variables from root directory
config({ path: path.join(__dirname, '..', '.env') }); 
import { baseSepolia } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { TierManager, CustomerData } from "./TierManager";


import { createThirdwebClient, getContract, prepareContractCall, sendTransaction, readContract } from "thirdweb";

export interface MintResult {
  success: boolean;
  tokensToMint?: number;
  transactionHash?: string;
  message?: string;
  error?: string;
  newTier?: string;
  gasUsed?: string;
  timestamp?: string;
}

export interface EngagementMintParams {
  customerAddress: string;
  engagementType: 'ad_click' | 'form_completion' | 'referral_signup' | 'social_share';
  baseAmount: number;
  customerData: CustomerData;
}

export class TokenMinter {
  private client: any;
  private account: any;
  private contractAddress: string;
  private tierManager: TierManager;

  constructor() {
    // Check for THIRDWEB_CLIENT_ID or NEXT_PUBLIC_THIRDWEB_CLIENT_ID
    const clientId = process.env.THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!clientId || !secretKey || !privateKey) {
      throw new Error("Missing required environment variables");
    }

    this.client = createThirdwebClient({
      clientId: clientId,
      secretKey: secretKey,
    });
    
    this.account = privateKeyToAccount({
      client: this.client,
      privateKey: privateKey,
    });
    
    this.contractAddress = process.env.REPAIRCOIN_CONTRACT_ADDRESS!;
    this.tierManager = new TierManager();
  }

  // Burn tokens when customer redeems at shop
  async burnTokens(
    customerAddress: string,
    amount: number,
    shopId: string,
    reason: string = "Shop redemption"
  ): Promise<MintResult> {
    try {
      console.log(`🔥 Burning ${amount} RCN from ${customerAddress} for redemption at ${shopId}`);

      if (!this.isValidAddress(customerAddress)) {
        return {
          success: false,
          message: "Invalid customer address format"
        };
      }

      // Check customer balance first
      const balance = await this.getCustomerBalance(customerAddress);
      if (balance < amount) {
        return {
          success: false,
          message: `Insufficient balance. Customer has ${balance} RCN, attempting to burn ${amount} RCN`
        };
      }

      // Get the contract
      const contract = getContract({
        client: this.client,
        chain: baseSepolia,
        address: this.contractAddress,
      });

      // Prepare burn transaction
      // Note: Standard ERC20 uses "burn" or "burnFrom" function
      // If using burnFrom, shop would need allowance from customer
      const burnTx = prepareContractCall({
        contract,
        method: "function burn(uint256 amount)",
        params: [BigInt(amount * 10 ** 18)] // Convert to wei (18 decimals)
      });

      // Send transaction
      const result = await sendTransaction({
        transaction: burnTx,
        account: this.account,
      });

      console.log(`✅ Burn successful! Hash: ${result.transactionHash}`);

      return {
        success: true,
        tokensToMint: -amount, // Negative to indicate burn
        transactionHash: result.transactionHash,
        message: `Successfully burned ${amount} RCN for ${reason}`,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ Burn error:', error);
      
      // Check if it's because burn function doesn't exist
      if (error.message?.includes('function selector was not recognized')) {
        return {
          success: false,
          error: "Contract does not support burning. Consider tracking redemptions off-chain instead.",
          message: "Burn function not available in current contract"
        };
      }
      
      return {
        success: false,
        error: error.message || 'Burn failed',
        message: `Failed to burn ${amount} RCN: ${error.message}`
      };
    }
  }

  // Main function: Mint tokens for repair jobs
  async mintRepairTokens(
    customerAddress: string, 
    repairAmount: number,
    shopId: string,
    customerData: CustomerData
  ): Promise<MintResult> {
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
      let tokensToMint: number;
      
      if (repairAmount >= 100) {
        tokensToMint = 25; // $100+ repair = 25 RCN
      } else if (repairAmount >= 50) {
        tokensToMint = 10; // $50-99 repair = 10 RCN
      } else {
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

    } catch (error: any) {
      console.error("Error in mintRepairTokens:", error);
      return { 
        success: false, 
        error: `Repair token minting failed: ${error.message}` 
      };
    }
  }

  // Mint tokens for successful referrals
  async mintReferralTokens(
    referrerAddress: string, 
    refereeAddress: string,
    shopId?: string
  ): Promise<MintResult> {
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

    } catch (error: any) {
      console.error("Error in mintReferralTokens:", error);
      return { 
        success: false, 
        error: `Referral token minting failed: ${error.message}` 
      };
    }
  }

  // Mint tokens for platform engagement (ads, forms, etc.)
  async mintEngagementTokens(params: EngagementMintParams): Promise<MintResult> {
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
      const result = await this.mintTokens(
        params.customerAddress, 
        tokensToMint, 
        `engagement_${params.engagementType}_${Date.now()}`
      );
      
      if (result.success) {
        return {
          ...result,
          message: `Minted ${tokensToMint} RCN for ${params.engagementType} (${multiplier}x ${params.customerData.tier} multiplier)`
        };
      }

      return result;

    } catch (error: any) {
      console.error("Error in mintEngagementTokens:", error);
      return { 
        success: false, 
        error: `Engagement token minting failed: ${error.message}` 
      };
    }
  }

  // Emergency functions for admin use
async pauseContract(): Promise<MintResult> {
    try {
      console.log("⏸️  Attempting to pause contract...");
      
      const contract = await this.getContract();
      
      const transaction = prepareContractCall({
        contract,
        method: "pause" as any, // Type assertion
        params: []
      });

      const result = await sendTransaction({
        transaction,
        account: this.account,
      });

      return {
        success: true,
        message: "Contract paused successfully",
        transactionHash: result.transactionHash
      };
    } catch (error: any) {
      console.log("Pause method not supported on this contract");
      return {
        success: false,
        error: "Pause not supported: " + error.message
      };
    }
  }

async unpauseContract(): Promise<MintResult> {
    try {
      console.log("▶️  Attempting to unpause contract...");
      
      const contract = await this.getContract();
      
      const transaction = prepareContractCall({
        contract,
        method: "unpause" as any, // Type assertion
        params: []
      });

      const result = await sendTransaction({
        transaction,
        account: this.account,
      });

      return {
        success: true,
        message: "Contract unpaused successfully",
        transactionHash: result.transactionHash
      };
    } catch (error: any) {
      console.log("Unpause method not supported on this contract");
      return {
        success: false,
        error: "Unpause not supported: " + error.message
      };
    }
  }

  // Check if contract is paused
  async isContractPaused(): Promise<boolean> {
    try {
      const contract = await this.getContract();
      
      try {
        // Try the most common pause method
        const paused = await readContract({
          contract,
          method: "paused" as any, // Type assertion to bypass strict typing
          params: []
        });
        console.log(`✅ Pause status: ${paused}`);
        return !!paused; // Convert to boolean
      } catch (error) {
        // If pause method doesn't exist, just assume not paused
        console.log("ℹ️  No pause method found, assuming unpaused");
        return false;
      }
    } catch (error) {
      console.warn("Could not check pause status, assuming unpaused");
      return false;
    }
  }


  // Get contract balance and statistics
  async getContractStats(): Promise<any> {
    try {
      const contract = await this.getContract();
      
      const stats: any = {
        contractAddress: this.contractAddress,
        network: "Base Sepolia",
        isPaused: false,
        totalSupplyReadable: 0
      };

      // Try to get total supply (most contracts have this)
      try {
        const totalSupply = await readContract({
          contract,
          method: "function totalSupply() view returns (uint256)" as any,
          params: []
        });
        stats.totalSupply = totalSupply.toString();
        stats.totalSupplyReadable = Number(totalSupply) / Math.pow(10, 18);
      } catch (error) {
        console.warn("Could not get total supply");
        stats.totalSupplyReadable = 0;
      }

      // Try to get pause status
      stats.isPaused = await this.isContractPaused();

      // Try to get contract name and symbol
      try {
        const name = await readContract({
          contract,
          method: "name" as any,
          params: []
        });
        const symbol = await readContract({
          contract,
          method: "symbol" as any,
          params: []
        });
        stats.name = name;
        stats.symbol = symbol;
      } catch (error) {
        console.warn("Could not get contract name/symbol");
      }

      return stats;
    } catch (error: any) {
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
  private async mintTokens(toAddress: string, amount: number, reference?: string): Promise<MintResult> {
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

      const transaction = prepareContractCall({
        contract,
        method: "function mintTo(address to, uint256 amount) public",
        params: [toAddress, mintAmount]
      });

      const result = await sendTransaction({
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

    } catch (error: any) {
      console.error("Error in mintTokens:", error);
      
      // Provide specific error messages
      if (error.message.includes("AccessControl")) {
        return {
          success: false,
          error: "Insufficient permissions to mint tokens. Grant MINTER_ROLE to this wallet."
        };
      } else if (error.message.includes("insufficient funds")) {
        return {
          success: false,
          error: "Insufficient ETH for gas fees. Fund your wallet with Base Sepolia ETH."
        };
      } else if (error.message.includes("paused")) {
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
  private async getContract() {
    return getContract({
      client: this.client,
      chain: baseSepolia,
      address: this.contractAddress,
    });
  }

  // Helper function to validate Ethereum addresses
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Get customer balance
  async getCustomerBalance(customerAddress: string): Promise<number | null> {
    try {
      const contract = await this.getContract();
      const balance = await readContract({
        contract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [customerAddress]
      });
      
      return Number(balance) / Math.pow(10, 18);
    } catch (error: any) {
      console.error("Error getting customer balance:", error);
      return null;
    }
  }

  // Batch mint for multiple customers (admin function)
  async batchMintTokens(recipients: Array<{address: string, amount: number, reason: string}>): Promise<MintResult[]> {
    console.log(`🔄 Batch minting to ${recipients.length} recipients...`);
    
    const results: MintResult[] = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.mintTokens(recipient.address, recipient.amount, recipient.reason);
        results.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
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

  // Transfer tokens from one address to another
  async transferTokens(toAddress: string, amount: number, reason: string): Promise<MintResult> {
    try {
      console.log(`💸 Transferring ${amount} RCN to ${toAddress}`);
      console.log(`📝 Reason: ${reason}`);

      const contract = await this.getContract();
      
      // Prepare transfer transaction with proper ERC20 function signature
      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [toAddress, BigInt(amount) * BigInt(10 ** 18)] // Convert to wei
      });

      // Send the transaction from the admin wallet
      const result = await sendTransaction({
        transaction,
        account: this.account,
      });

      console.log(`✅ Transfer successful! TxHash: ${result.transactionHash}`);

      return {
        success: true,
        message: `Successfully transferred ${amount} RCN`,
        transactionHash: result.transactionHash,
        tokensToMint: amount
      };
    } catch (error: any) {
      console.error("❌ Transfer failed:", error);
      return {
        success: false,
        error: `Transfer failed: ${error.message}`
      };
    }
  }

  // Batch transfer tokens to multiple recipients
  async batchTransferTokens(recipients: Array<{address: string, amount: number, reason: string}>): Promise<MintResult[]> {
    console.log(`🔄 Batch transferring to ${recipients.length} recipients...`);
    
    const results: MintResult[] = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.transferTokens(recipient.address, recipient.amount, recipient.reason);
        results.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        results.push({
          success: false,
          error: `Batch transfer failed for ${recipient.address}: ${error.message}`
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Batch transfer complete: ${successful}/${recipients.length} successful`);
    
    return results;
  }
}

// Singleton instance
let tokenMinterInstance: TokenMinter | null = null;

export function getTokenMinter(): TokenMinter {
  if (!tokenMinterInstance) {
    tokenMinterInstance = new TokenMinter();
  }
  return tokenMinterInstance;
}