import { createThirdwebClient, getContract } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';

interface PriceData {
  price: number;
  lastUpdated: Date;
  source: 'uniswap' | 'manual' | 'oracle';
}

class RCGPriceService {
  private static instance: RCGPriceService;
  private priceCache: PriceData | null = null;
  private cacheTimeout = 15 * 60 * 1000; // 15 minutes

  private constructor() {}

  static getInstance(): RCGPriceService {
    if (!RCGPriceService.instance) {
      RCGPriceService.instance = new RCGPriceService();
    }
    return RCGPriceService.instance;
  }

  async getCurrentPrice(): Promise<PriceData> {
    // Check cache first
    if (this.priceCache && 
        new Date().getTime() - this.priceCache.lastUpdated.getTime() < this.cacheTimeout) {
      return this.priceCache;
    }

    try {
      // In production, this would fetch from Uniswap V3 pool
      // For now, return a mock price
      const mockPrice = this.getMockPrice();
      
      this.priceCache = {
        price: mockPrice,
        lastUpdated: new Date(),
        source: 'manual'
      };

      return this.priceCache;
    } catch (error) {
      console.error('Failed to fetch RCG price:', error);
      
      // Fallback to last known price or default
      return this.priceCache || {
        price: 0.25,
        lastUpdated: new Date(),
        source: 'manual'
      };
    }
  }

  private getMockPrice(): number {
    // Testnet mock price - no real trading yet
    // Using fixed price for demo purposes
    return 0.25;
  }

  async getPriceWithPremium(premium: number = 0.05): Promise<number> {
    const priceData = await this.getCurrentPrice();
    return priceData.price * (1 + premium);
  }

  async calculateBulkPrice(amount: number, premium: number = 0.05): Promise<{
    marketPrice: number;
    premiumRate: number;
    effectivePrice: number;
    totalCost: number;
  }> {
    const priceData = await this.getCurrentPrice();
    const effectivePrice = priceData.price * (1 + premium);
    
    return {
      marketPrice: priceData.price,
      premiumRate: premium,
      effectivePrice,
      totalCost: amount * effectivePrice
    };
  }

  // For private sales, apply volume discounts
  async getPrivateSalePrice(amount: number): Promise<{
    basePrice: number;
    discount: number;
    finalPrice: number;
    totalCost: number;
  }> {
    const priceData = await this.getCurrentPrice();
    let discount = 0;

    // Volume-based discounts
    if (amount >= 1000000) {
      discount = 0.15; // 15% discount for 1M+ RCG
    } else if (amount >= 500000) {
      discount = 0.10; // 10% discount for 500K+ RCG
    } else if (amount >= 100000) {
      discount = 0.05; // 5% discount for 100K+ RCG
    }

    const finalPrice = priceData.price * (1 - discount);

    return {
      basePrice: priceData.price,
      discount,
      finalPrice,
      totalCost: amount * finalPrice
    };
  }
}

export const rcgPriceService = RCGPriceService.getInstance();