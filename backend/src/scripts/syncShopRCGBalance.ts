import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { ShopRepository } from '../repositories/ShopRepository';
import { getRCGService } from '../services/RCGService';

async function syncShopRCGBalance(shopId: string) {
  try {
    console.log(`Syncing RCG balance for shop: ${shopId}`);
    
    const shopRepo = new ShopRepository();
    const rcgService = getRCGService();
    
    // Get shop data
    const shop = await shopRepo.getShop(shopId);
    if (!shop) {
      console.error(`Shop ${shopId} not found`);
      return;
    }
    
    console.log(`Shop wallet address: ${shop.walletAddress}`);
    
    // Get RCG balance from blockchain
    const rcgReader = rcgService.getRCGTokenReader();
    const balance = await rcgReader.getBalance(shop.walletAddress);
    const tier = await rcgReader.getShopTier(shop.walletAddress);
    
    console.log(`Blockchain RCG balance: ${balance}`);
    console.log(`Calculated tier: ${tier}`);
    
    // Parse the balance correctly
    const balanceNum = parseFloat(balance);
    console.log(`Parsed balance: ${balanceNum}`);
    
    // Determine operational status
    let operationalStatus: 'pending' | 'rcg_qualified' | 'commitment_qualified' | 'not_qualified' = 'pending';
    
    if (balanceNum >= 10000) {
      operationalStatus = 'rcg_qualified';
    } else if (shop.commitment_enrolled) {
      operationalStatus = 'commitment_qualified';
    } else {
      operationalStatus = 'not_qualified';
    }
    
    console.log(`Operational status: ${operationalStatus}`);
    
    // Update shop in database
    await shopRepo.updateShop(shopId, {
      rcg_balance: balanceNum,
      rcg_tier: tier,
      tier_updated_at: new Date().toISOString(),
      operational_status: operationalStatus
    });
    
    console.log('✅ Shop RCG balance synced successfully');
    
    // Verify update
    const updatedShop = await shopRepo.getShop(shopId);
    console.log('Updated shop data:', {
      shopId: updatedShop?.shopId,
      rcg_balance: updatedShop?.rcg_balance,
      rcg_tier: updatedShop?.rcg_tier,
      operational_status: updatedShop?.operational_status
    });
    
  } catch (error) {
    console.error('Error syncing shop RCG balance:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
const shopId = process.argv[2] || 'shop001';
syncShopRCGBalance(shopId);