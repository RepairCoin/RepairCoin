// backend/src/handlers/webhookHandlers.ts
import { TokenMinter } from "../contracts/TokenMinter";
import { TierManager } from "../contracts/TierManager";
import { customerRepository, shopRepository, transactionRepository } from "../repositories";
import { logger } from "../utils/logger";

interface TransactionRecord {
  id: string;
  type: 'mint' | 'redeem' | 'transfer' | 'tier_bonus' | 'shop_purchase' | 'rejected_redemption' | 'cancelled_redemption';
  customerAddress: string;
  shopId?: string;
  amount: number;
  reason?: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  metadata?: any;
}

// Lazy loading helpers
let tokenMinter: TokenMinter | null = null;
let tierManager: TierManager | null = null;

const getTokenMinter = (): TokenMinter => {
  if (!tokenMinter) {
    tokenMinter = new TokenMinter();
  }
  return tokenMinter;
};

const getTierManager = (): TierManager => {
  if (!tierManager) {
    tierManager = new TierManager();
  }
  return tierManager;
};

export interface WebhookResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  message?: string;
}

// Handle repair completed event
export async function handleRepairCompleted(data: any, webhookId: string): Promise<WebhookResult> {
  try {
    const { 
      customer_id, 
      customer_wallet_address, 
      shop_id, 
      repair_amount, 
      repair_id,
      customer_email,
      customer_phone 
    } = data;
    
    // Validate required fields
    if (!customer_wallet_address || !shop_id || !repair_amount) {
      return {
        success: false,
        error: "Missing required fields: customer_wallet_address, shop_id, repair_amount"
      };
    }
    
    // Get or create customer
    let customer = await customerRepository.getCustomer(customer_wallet_address);
    
    if (!customer) {
      // Create new customer
      customer = TierManager.createNewCustomer(
        customer_wallet_address,
        customer_email,
        customer_phone,
        customer_id
      );
      await customerRepository.createCustomer(customer);
      logger.info(`New customer created: ${customer_wallet_address}`);
    }
    
    // Mint repair tokens
    const mintResult = await getTokenMinter().mintRepairTokens(
      customer_wallet_address,
      parseFloat(repair_amount),
      shop_id,
      customer
    );
    
    if (!mintResult.success) {
      return {
        success: false,
        error: mintResult.error || mintResult.message || "Token minting failed"
      };
    }
    
    // Update customer data in database
    if (mintResult.tokensToMint && mintResult.newTier) {
      await customerRepository.updateCustomerAfterEarning(
        customer_wallet_address,
        mintResult.tokensToMint,
        mintResult.newTier as any
      );
    }
    
    // Record transaction
    const transactionRecord: TransactionRecord = {
      id: `repair_${repair_id || Date.now()}`,
      type: "mint",
      customerAddress: customer_wallet_address.toLowerCase(),
      shopId: shop_id,
      amount: mintResult.tokensToMint || 0,
      reason: `Repair completion - $${repair_amount}`,
      transactionHash: mintResult.transactionHash || "",
      timestamp: new Date().toISOString(),
      status: "confirmed",
      metadata: {
        repairAmount: parseFloat(repair_amount),
        webhookId
      }
    };
    
    await transactionRepository.recordTransaction(transactionRecord);
    
    // Update shop statistics
    const shop = await shopRepository.getShop(shop_id);
    if (shop) {
      await shopRepository.updateShop(shop_id, {
        totalTokensIssued: shop.totalTokensIssued + (mintResult.tokensToMint || 0),
        lastActivity: new Date().toISOString()
      });
    }
    
    return {
      success: true,
      transactionHash: mintResult.transactionHash,
      message: `Minted ${mintResult.tokensToMint} RCN for $${repair_amount} repair`
    };
    
  } catch (error: any) {
    logger.error("Error handling repair completed:", error);
    return {
      success: false,
      error: `Repair processing failed: ${error.message}`
    };
  }
}

// Handle referral verified event
export async function handleReferralVerified(data: any, webhookId: string): Promise<WebhookResult> {
  try {
    const {
      referrer_wallet_address,
      referee_wallet_address,
      referrer_id,
      referee_id,
      shop_id,
      referee_email,
      referee_phone
    } = data;
    
    // Validate required fields
    if (!referrer_wallet_address || !referee_wallet_address) {
      return {
        success: false,
        error: "Missing required fields: referrer_wallet_address, referee_wallet_address"
      };
    }
    
    // Ensure referee is new customer or create them
    let referee = await customerRepository.getCustomer(referee_wallet_address);
    if (!referee) {
      referee = TierManager.createNewCustomer(
        referee_wallet_address,
        referee_email,
        referee_phone,
        referee_id
      );
      await customerRepository.createCustomer(referee);
    }
    
    // Mint referral tokens
    const mintResult = await getTokenMinter().mintReferralTokens(
      referrer_wallet_address,
      referee_wallet_address,
      shop_id
    );
    
    if (!mintResult.success) {
      return {
        success: false,
        error: mintResult.error || "Referral token minting failed"
      };
    }
    
    // Update both customer records
    const [referrer, updatedReferee] = await Promise.all([
      customerRepository.getCustomer(referrer_wallet_address),
      customerRepository.getCustomer(referee_wallet_address)
    ]);
    
    if (referrer) {
      const newReferrerTier = getTierManager().calculateTier(referrer.lifetimeEarnings + 25);
      await customerRepository.updateCustomerAfterEarning(referrer_wallet_address, 25, newReferrerTier);
    }
    
    if (updatedReferee) {
      const newRefereeTier = getTierManager().calculateTier(updatedReferee.lifetimeEarnings + 10);
      await customerRepository.updateCustomerAfterEarning(referee_wallet_address, 10, newRefereeTier);
    }
    
    // Record transaction
    const transactionRecord: TransactionRecord = {
      id: `referral_${Date.now()}`,
      type: "mint",
      customerAddress: referrer_wallet_address.toLowerCase(),
      shopId: shop_id || "referral_system",
      amount: 35, // Total tokens minted (25 + 10)
      reason: `Referral reward: ${referrer_wallet_address} → ${referee_wallet_address}`,
      transactionHash: mintResult.transactionHash || "",
      timestamp: new Date().toISOString(),
      status: "confirmed",
      metadata: {
        referralId: `${referrer_id}_${referee_id}`,
        webhookId
      }
    };
    
    await transactionRepository.recordTransaction(transactionRecord);
    
    return {
      success: true,
      transactionHash: mintResult.transactionHash,
      message: "Referral rewards minted: 25 RCN to referrer, 10 RCN to referee"
    };
    
  } catch (error: any) {
    logger.error("Error handling referral verified:", error);
    return {
      success: false,
      error: `Referral processing failed: ${error.message}`
    };
  }
}

// Handle ad funnel conversion event
export async function handleAdFunnelConversion(data: any, webhookId: string): Promise<WebhookResult> {
  try {
    const {
      customer_wallet_address,
      engagement_type,
      base_amount = 1,
      shop_id
    } = data;
    
    if (!customer_wallet_address || !engagement_type) {
      return {
        success: false,
        error: "Missing required fields: customer_wallet_address, engagement_type"
      };
    }
    
    // Get customer data
    const customer = await customerRepository.getCustomer(customer_wallet_address);
    if (!customer) {
      return {
        success: false,
        error: "Customer not found. Customer must be registered first."
      };
    }
    
    // Mint engagement tokens
    const mintResult = await getTokenMinter().mintEngagementTokens({
      customerAddress: customer_wallet_address,
      engagementType: engagement_type,
      baseAmount: parseFloat(base_amount),
      customerData: customer
    });
    
    if (!mintResult.success) {
      return {
        success: false,
        error: mintResult.error || "Engagement token minting failed"
      };
    }
    
    // Update customer data
    if (mintResult.tokensToMint) {
      const newTier = getTierManager().calculateTier(customer.lifetimeEarnings + mintResult.tokensToMint);
      await customerRepository.updateCustomerAfterEarning(
        customer_wallet_address,
        mintResult.tokensToMint,
        newTier
      );
    }
    
    // Record transaction
    const transactionRecord: TransactionRecord = {
      id: `engagement_${Date.now()}`,
      type: "mint",
      customerAddress: customer_wallet_address.toLowerCase(),
      shopId: shop_id || "engagement_system",
      amount: mintResult.tokensToMint || 0,
      reason: `Engagement reward: ${engagement_type}`,
      transactionHash: mintResult.transactionHash || "",
      timestamp: new Date().toISOString(),
      status: "confirmed",
      metadata: {
        engagementType: engagement_type,
        webhookId
      }
    };
    
    await transactionRepository.recordTransaction(transactionRecord);
    
    return {
      success: true,
      transactionHash: mintResult.transactionHash,
      message: `Minted ${mintResult.tokensToMint} RCN for ${engagement_type} engagement`
    };
    
  } catch (error: any) {
    logger.error("Error handling ad funnel conversion:", error);
    return {
      success: false,
      error: `Engagement processing failed: ${error.message}`
    };
  }
}

// Handle customer registered event
export async function handleCustomerRegistered(data: any, webhookId: string): Promise<WebhookResult> {
  try {
    const {
      customer_id,
      customer_wallet_address,
      customer_email,
      customer_phone,
      shop_id
    } = data;
    
    if (!customer_wallet_address) {
      return {
        success: false,
        error: "Missing required field: customer_wallet_address"
      };
    }
    
    // Check if customer already exists
    const existingCustomer = await customerRepository.getCustomer(customer_wallet_address);
    if (existingCustomer) {
      return {
        success: true,
        message: "Customer already registered"
      };
    }
    
    // Create new customer
    const newCustomer = TierManager.createNewCustomer(
      customer_wallet_address,
      customer_email,
      customer_phone,
      customer_id
    );
    
    await customerRepository.createCustomer(newCustomer);
    
    logger.info(`New customer registered: ${customer_wallet_address}`, { 
      customerId: customer_id,
      shopId: shop_id,
      webhookId 
    });
    
    return {
      success: true,
      message: `Customer ${customer_wallet_address} registered successfully`
    };
    
  } catch (error: any) {
    logger.error("Error handling customer registered:", error);
    return {
      success: false,
      error: `Customer registration failed: ${error.message}`
    };
  }
}