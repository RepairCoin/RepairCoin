import { BaseRepository } from '../repositories/BaseRepository';
import { logger } from '../utils/logger';

export interface TierPricing {
  tier: 'standard' | 'premium' | 'elite';
  pricePerRcn: number;
  discountPercentage: number;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

export interface PricingHistory {
  id: number;
  tier: 'standard' | 'premium' | 'elite';
  oldPrice: number;
  newPrice: number;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

export class PricingService extends BaseRepository {
  private readonly DEFAULT_PRICING = {
    standard: 0.10,
    premium: 0.08,
    elite: 0.06
  };

  async getTierPricing(tier: 'standard' | 'premium' | 'elite'): Promise<number> {
    try {
      const query = `
        SELECT price_per_rcn 
        FROM tier_pricing 
        WHERE tier = $1 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [tier]);
      
      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].price_per_rcn);
      }
      
      // Return default pricing if no custom pricing found
      return this.DEFAULT_PRICING[tier];
    } catch (error) {
      logger.warn(`Error fetching tier pricing for ${tier}, using default:`, error);
      return this.DEFAULT_PRICING[tier];
    }
  }

  async getAllTierPricing(): Promise<Record<'standard' | 'premium' | 'elite', TierPricing>> {
    try {
      const query = `
        SELECT DISTINCT ON (tier) 
          tier, 
          price_per_rcn, 
          discount_percentage,
          updated_at,
          updated_by,
          reason
        FROM tier_pricing 
        ORDER BY tier, updated_at DESC
      `;
      
      const result = await this.pool.query(query);
      
      const pricing: any = {};
      
      // Initialize with defaults
      Object.keys(this.DEFAULT_PRICING).forEach(tier => {
        pricing[tier] = {
          tier,
          pricePerRcn: this.DEFAULT_PRICING[tier as keyof typeof this.DEFAULT_PRICING],
          discountPercentage: tier === 'standard' ? 0 : tier === 'premium' ? 20 : 40,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          reason: 'Default pricing'
        };
      });
      
      // Override with database values if available
      result.rows.forEach(row => {
        pricing[row.tier] = {
          tier: row.tier,
          pricePerRcn: parseFloat(row.price_per_rcn),
          discountPercentage: parseFloat(row.discount_percentage || 0),
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
          reason: row.reason
        };
      });
      
      return pricing;
    } catch (error) {
      logger.error('Error fetching all tier pricing:', error);
      // Return defaults on error
      return {
        standard: {
          tier: 'standard',
          pricePerRcn: 0.10,
          discountPercentage: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          reason: 'Default pricing (error fallback)'
        },
        premium: {
          tier: 'premium', 
          pricePerRcn: 0.08,
          discountPercentage: 20,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          reason: 'Default pricing (error fallback)'
        },
        elite: {
          tier: 'elite',
          pricePerRcn: 0.06,
          discountPercentage: 40,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          reason: 'Default pricing (error fallback)'
        }
      };
    }
  }

  async updateTierPricing(
    tier: 'standard' | 'premium' | 'elite',
    newPrice: number,
    adminAddress: string,
    reason: string
  ): Promise<void> {
    try {
      // Get current price for history
      const currentPrice = await this.getTierPricing(tier);
      
      // Calculate discount percentage (standard is base price)
      const standardPrice = await this.getTierPricing('standard');
      const discountPercentage = tier === 'standard' ? 0 : 
        Math.round(((standardPrice - newPrice) / standardPrice) * 100);
      
      // Insert new pricing
      const insertQuery = `
        INSERT INTO tier_pricing (
          tier, 
          price_per_rcn, 
          discount_percentage,
          updated_by, 
          reason, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await this.pool.query(insertQuery, [
        tier,
        newPrice,
        discountPercentage,
        adminAddress,
        reason
      ]);
      
      // Record in pricing history
      const historyQuery = `
        INSERT INTO pricing_history (
          tier,
          old_price,
          new_price,
          reason,
          updated_by,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await this.pool.query(historyQuery, [
        tier,
        currentPrice,
        newPrice,
        reason,
        adminAddress
      ]);
      
      logger.info('Tier pricing updated successfully', {
        tier,
        oldPrice: currentPrice,
        newPrice,
        discountPercentage,
        adminAddress,
        reason
      });
    } catch (error) {
      logger.error('Error updating tier pricing:', error);
      throw new Error('Failed to update tier pricing');
    }
  }

  async getPricingHistory(
    tier?: 'standard' | 'premium' | 'elite',
    limit: number = 50
  ): Promise<PricingHistory[]> {
    try {
      let query = `
        SELECT 
          id,
          tier,
          old_price,
          new_price,
          reason,
          updated_by,
          updated_at
        FROM pricing_history
      `;
      
      const params: any[] = [];
      
      if (tier) {
        query += ' WHERE tier = $1';
        params.push(tier);
      }
      
      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await this.pool.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        tier: row.tier,
        oldPrice: parseFloat(row.old_price),
        newPrice: parseFloat(row.new_price),
        reason: row.reason,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Error fetching pricing history:', error);
      return [];
    }
  }

  async initializePricingTables(): Promise<void> {
    try {
      // Create tier_pricing table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tier_pricing (
          id SERIAL PRIMARY KEY,
          tier VARCHAR(20) NOT NULL,
          price_per_rcn DECIMAL(10, 4) NOT NULL,
          discount_percentage INTEGER DEFAULT 0,
          updated_by VARCHAR(255) NOT NULL,
          reason TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create pricing_history table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS pricing_history (
          id SERIAL PRIMARY KEY,
          tier VARCHAR(20) NOT NULL,
          old_price DECIMAL(10, 4) NOT NULL,
          new_price DECIMAL(10, 4) NOT NULL,
          reason TEXT NOT NULL,
          updated_by VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Check if we need to initialize default pricing
      const countQuery = await this.pool.query('SELECT COUNT(*) as count FROM tier_pricing');
      const count = parseInt(countQuery.rows[0].count);
      
      if (count === 0) {
        // Initialize with default pricing
        const defaultPricing = [
          { tier: 'standard', price: 0.10, discount: 0 },
          { tier: 'premium', price: 0.08, discount: 20 },
          { tier: 'elite', price: 0.06, discount: 40 }
        ];
        
        for (const pricing of defaultPricing) {
          await this.pool.query(`
            INSERT INTO tier_pricing (tier, price_per_rcn, discount_percentage, updated_by, reason)
            VALUES ($1, $2, $3, 'system', 'Initial default pricing')
          `, [pricing.tier, pricing.price, pricing.discount]);
        }
        
        logger.info('Initialized default tier pricing');
      }
    } catch (error) {
      logger.error('Error initializing pricing tables:', error);
      throw new Error('Failed to initialize pricing tables');
    }
  }
}

// Singleton instance
let pricingService: PricingService | null = null;

export function getPricingService(): PricingService {
  if (!pricingService) {
    pricingService = new PricingService();
  }
  return pricingService;
}