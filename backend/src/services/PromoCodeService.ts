import { DatabaseService } from './DatabaseService';
import { PromoCodeRepository, PromoCode, CreatePromoCodeData, PromoCodeValidation } from '../repositories/PromoCodeRepository';
import { eventBus } from '../events/EventBus';

export interface PromoCodeBonus {
  isValid: boolean;
  errorMessage?: string;
  bonusAmount: number;
  promoCodeId?: number;
  promoCodeName?: string;
}

export class PromoCodeService {
  private promoCodeRepo: PromoCodeRepository;
  private db: DatabaseService;

  constructor() {
    this.promoCodeRepo = new PromoCodeRepository();
    this.db = DatabaseService.getInstance();
  }

  async createPromoCode(shopId: string, data: Omit<CreatePromoCodeData, 'shop_id'>): Promise<PromoCode> {
    // Validate code uniqueness
    const existing = await this.promoCodeRepo.findByCode(data.code);
    if (existing) {
      throw new Error('A promo code with this code already exists');
    }

    // Validate dates
    if (new Date(data.start_date) >= new Date(data.end_date)) {
      throw new Error('End date must be after start date');
    }

    // Validate bonus value
    if (data.bonus_type === 'percentage' && (data.bonus_value <= 0 || data.bonus_value > 100)) {
      throw new Error('Percentage bonus must be between 1 and 100');
    }

    if (data.bonus_type === 'fixed' && data.bonus_value <= 0) {
      throw new Error('Fixed bonus must be greater than 0');
    }

    const promoCode = await this.promoCodeRepo.create({
      ...data,
      shop_id: shopId
    });

    eventBus.publish({
      type: 'promo_code:created',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'PromoCodeService',
      version: 1,
      data: {
        shopId,
        promoCodeId: promoCode.id,
        code: promoCode.code,
        name: promoCode.name
      }
    });

    // PromoCode is already in the correct format from repository
    return promoCode;
  }

  async getShopPromoCodes(shopId: string, onlyActive = false): Promise<PromoCode[]> {
    // Repository already returns PromoCode objects with proper mapping
    return this.promoCodeRepo.findByShop(shopId, onlyActive);
  }

  async updatePromoCode(
    shopId: string, 
    promoCodeId: number, 
    updates: Partial<PromoCode>
  ): Promise<PromoCode> {
    // Verify ownership
    const existing = await this.promoCodeRepo.findByShop(shopId);
    const promoCode = existing.find(pc => pc.id === promoCodeId);
    
    if (!promoCode) {
      throw new Error('Promo code not found or you do not have permission to update it');
    }

    // Don't allow code changes
    delete updates.code;
    delete updates.shop_id;

    const updated = await this.promoCodeRepo.update(promoCodeId, updates);
    if (!updated) {
      throw new Error('Failed to update promo code');
    }

    eventBus.publish({
      type: 'promo_code:updated',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'PromoCodeService',
      version: 1,
      data: {
        shopId,
        promoCodeId,
        updates
      }
    });

    // Repository already returns PromoCode object with proper mapping
    return updated;
  }

  async deactivatePromoCode(shopId: string, promoCodeId: number): Promise<void> {
    // Verify ownership
    const existing = await this.promoCodeRepo.findByShop(shopId);
    const promoCode = existing.find(pc => pc.id === promoCodeId);
    
    if (!promoCode) {
      throw new Error('Promo code not found or you do not have permission to deactivate it');
    }

    await this.promoCodeRepo.deactivate(promoCodeId);

    eventBus.publish({
      type: 'promo_code:deactivated',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'PromoCodeService',
      version: 1,
      data: {
        shopId,
        promoCodeId,
        code: promoCode.code
      }
    });
  }

  async calculatePromoBonus(
    code: string,
    shopId: string,
    customerAddress: string,
    baseReward: number
  ): Promise<PromoCodeBonus> {
    if (!code) {
      return { isValid: false, bonusAmount: 0 };
    }

    const validation = await this.promoCodeRepo.validate(code, shopId, customerAddress);

    if (!validation.is_valid) {
      return {
        isValid: false,
        errorMessage: validation.error_message,
        bonusAmount: 0
      };
    }

    let bonusAmount = 0;
    
    if (validation.bonus_type === 'fixed') {
      bonusAmount = validation.bonus_value || 0;
    } else if (validation.bonus_type === 'percentage') {
      bonusAmount = (baseReward * (validation.bonus_value || 0)) / 100;
      
      // Apply max bonus if specified
      const promoCode = await this.promoCodeRepo.findByCode(code, shopId);
      if (promoCode?.max_bonus && bonusAmount > promoCode.max_bonus) {
        bonusAmount = promoCode.max_bonus;
      }
    }

    return {
      isValid: true,
      bonusAmount,
      promoCodeId: validation.promo_code_id,
      promoCodeName: code
    };
  }

  async recordPromoCodeUse(
    promoCodeId: number,
    customerAddress: string,
    shopId: string,
    baseReward: number,
    bonusAmount: number,
    transactionId?: number
  ): Promise<void> {
    const use = await this.promoCodeRepo.recordUse(
      promoCodeId,
      customerAddress,
      shopId,
      baseReward,
      bonusAmount,
      transactionId
    );

    eventBus.publish({
      type: 'promo_code:used',
      aggregateId: shopId,
      timestamp: new Date(),
      source: 'PromoCodeService',
      version: 1,
      data: {
        shopId,
        promoCodeId,
        customerAddress,
        bonusAmount,
        transactionId,
        useId: use.id
      }
    });
  }

  async getPromoCodeStats(shopId: string, promoCodeId: number) {
    // Verify ownership
    const existing = await this.promoCodeRepo.findByShop(shopId);
    const promoCode = existing.find(pc => pc.id === promoCodeId);
    
    if (!promoCode) {
      throw new Error('Promo code not found or you do not have permission to view its stats');
    }

    const stats = await this.promoCodeRepo.getUsageStats(promoCodeId);
    
    return {
      promoCode,
      stats
    };
  }

  async getCustomerPromoHistory(customerAddress: string) {
    return this.promoCodeRepo.getCustomerUsage(customerAddress);
  }

  async validatePromoCode(code: string, shopId: string, customerAddress: string): Promise<PromoCodeValidation> {
    console.log('PromoCodeService.validatePromoCode called:', { code, shopId, customerAddress });
    try {
      const result = await this.promoCodeRepo.validate(code, shopId, customerAddress);
      console.log('PromoCodeService validation result:', result);
      return result;
    } catch (error) {
      console.error('PromoCodeService.validatePromoCode error:', error);
      throw error;
    }
  }

  // Admin methods
  async getAllPromoCodes(limit = 100, offset = 0) {
    const query = `
      SELECT 
        pc.id,
        pc.code,
        pc.code as name,
        pc.shop_id,
        s.name as shop_name,
        pc.discount_type as bonus_type,
        pc.discount_value as bonus_value,
        pc.status = 'active' as is_active,
        pc.used_count as times_used,
        (pc.discount_value * pc.used_count) as total_bonus_issued,
        pc.valid_from as start_date,
        pc.valid_until as end_date,
        pc.created_at
      FROM promo_codes pc
      JOIN shops s ON pc.shop_id = s.shop_id
      ORDER BY pc.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.db.query(query, [limit, offset]);
    return result.rows;
  }

  async getPromoCodeAnalytics() {
    const query = `
      SELECT 
        COUNT(DISTINCT pc.id) as total_codes,
        COUNT(DISTINCT CASE WHEN pc.status = 'active' THEN pc.id END) as active_codes,
        COUNT(DISTINCT pc.shop_id) as shops_with_codes,
        SUM(pc.used_count) as total_uses,
        COALESCE(SUM(pc.discount_value * pc.used_count), 0) as total_bonus_issued,
        AVG(pc.used_count) as avg_uses_per_code
      FROM promo_codes pc
    `;

    const topCodesQuery = `
      SELECT 
        pc.code,
        pc.code as name,
        pc.shop_id,
        s.name as shop_name,
        pc.used_count as times_used,
        (pc.discount_value * pc.used_count) as total_bonus_issued
      FROM promo_codes pc
      JOIN shops s ON pc.shop_id = s.shop_id
      ORDER BY pc.used_count DESC
      LIMIT 10
    `;

    const [analyticsResult, topCodesResult] = await Promise.all([
      this.db.query(query),
      this.db.query(topCodesQuery)
    ]);

    return {
      summary: analyticsResult.rows[0],
      topCodes: topCodesResult.rows
    };
  }

}