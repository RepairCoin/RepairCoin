// backend/src/domains/ServiceDomain/services/ServiceManagementService.ts
import { ServiceRepository, ShopService, CreateServiceParams, UpdateServiceParams, ServiceFilters, ShopServiceWithShopInfo } from '../../../repositories/ServiceRepository';
import { shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { PaginatedResult } from '../../../repositories/BaseRepository';

export interface CreateServiceRequest {
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
}

export interface UpdateServiceRequest {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: string;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export class ServiceManagementService {
  private repository: ServiceRepository;

  constructor() {
    this.repository = new ServiceRepository();
  }

  /**
   * Sanitize description - strip HTML tags to prevent XSS
   */
  private sanitizeDescription(description: string | undefined): string | undefined {
    if (!description) return description;
    // Strip all HTML tags
    return description.replace(/<[^>]*>/g, '');
  }

  /**
   * Validate and sanitize tags
   */
  private validateAndSanitizeTags(tags: string[] | undefined): string[] | undefined {
    if (!tags || tags.length === 0) return tags;

    // Max 5 tags
    if (tags.length > 5) {
      throw new Error('Maximum 5 tags allowed');
    }

    // Validate and sanitize each tag
    const sanitizedTags = tags.map(tag => {
      const trimmedTag = tag.trim();
      if (trimmedTag.length > 20) {
        throw new Error(`Tag "${trimmedTag.substring(0, 10)}..." exceeds 20 character limit`);
      }
      // Strip HTML from tags
      return trimmedTag.replace(/<[^>]*>/g, '');
    });

    return sanitizedTags;
  }

  /**
   * Create a new service
   */
  async createService(request: CreateServiceRequest): Promise<ShopService> {
    try {
      // Validate shop exists and is active
      const shop = await shopRepository.getShop(request.shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.active || !shop.verified) {
        throw new Error('Shop must be active and verified to create services');
      }

      // Require active subscription OR RCG qualification (10K+ RCG tokens)
      const isRcgQualified = shop.operational_status === 'rcg_qualified' ||
                             (shop.rcg_balance && parseFloat(shop.rcg_balance.toString()) >= 10000);
      const isSubscriptionQualified = shop.subscriptionActive || shop.operational_status === 'subscription_qualified';

      if (!isRcgQualified && !isSubscriptionQualified) {
        throw new Error('Active RepairCoin subscription or RCG qualification (10K+ RCG tokens) required to create services.');
      }

      // Validate service name
      if (!request.serviceName || request.serviceName.trim().length === 0) {
        throw new Error('Service name is required');
      }
      if (request.serviceName.length > 100) {
        throw new Error('Service name must be 100 characters or less');
      }

      // Validate price
      if (request.priceUsd <= 0) {
        throw new Error('Service price must be greater than 0');
      }

      // Validate duration if provided
      if (request.durationMinutes !== undefined && request.durationMinutes <= 0) {
        throw new Error('Service duration must be greater than 0');
      }

      // Validate and sanitize tags
      const sanitizedTags = this.validateAndSanitizeTags(request.tags);

      // Generate unique service ID
      const serviceId = `srv_${uuidv4()}`;

      const params: CreateServiceParams = {
        serviceId,
        shopId: request.shopId,
        serviceName: request.serviceName,
        description: this.sanitizeDescription(request.description),
        priceUsd: request.priceUsd,
        durationMinutes: request.durationMinutes,
        category: request.category,
        imageUrl: request.imageUrl,
        tags: sanitizedTags
      };

      const service = await this.repository.createService(params);

      logger.info('Service created successfully', { serviceId, shopId: request.shopId });
      return service;
    } catch (error) {
      logger.error('Error in createService:', error);
      throw error;
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(serviceId: string): Promise<ShopService | null> {
    try {
      return await this.repository.getServiceById(serviceId);
    } catch (error) {
      logger.error('Error in getServiceById:', error);
      throw error;
    }
  }

  /**
   * Get service with shop information
   */
  async getServiceWithShopInfo(serviceId: string, customerAddress?: string): Promise<ShopServiceWithShopInfo | null> {
    try {
      return await this.repository.getServiceWithShopInfo(serviceId, customerAddress);
    } catch (error) {
      logger.error('Error in getServiceWithShopInfo:', error);
      throw error;
    }
  }

  /**
   * Get all services for a shop
   */
  async getShopServices(
    shopId: string,
    options: {
      page?: number;
      limit?: number;
      activeOnly?: boolean;
      customerAddress?: string;
    } = {}
  ): Promise<PaginatedResult<ShopService>> {
    try {
      return await this.repository.getServicesByShop(shopId, options);
    } catch (error) {
      logger.error('Error in getShopServices:', error);
      throw error;
    }
  }

  /**
   * Get all services in marketplace with filters
   */
  async getMarketplaceServices(
    filters: ServiceFilters = {},
    options: {
      page?: number;
      limit?: number;
      customerAddress?: string;
    } = {}
  ): Promise<PaginatedResult<ShopServiceWithShopInfo>> {
    try {
      return await this.repository.getAllActiveServices(filters, options);
    } catch (error) {
      logger.error('Error in getMarketplaceServices:', error);
      throw error;
    }
  }

  /**
   * Update a service
   */
  async updateService(
    serviceId: string,
    shopId: string,
    updates: UpdateServiceRequest
  ): Promise<ShopService> {
    try {
      // Verify service exists and belongs to the shop
      const existingService = await this.repository.getServiceById(serviceId);
      if (!existingService) {
        throw new Error('Service not found');
      }

      if (existingService.shopId !== shopId) {
        throw new Error('Unauthorized: Service does not belong to this shop');
      }

      // Verify shop is qualified to update services
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Require active subscription OR RCG qualification (10K+ RCG tokens)
      const isRcgQualified = shop.operational_status === 'rcg_qualified' ||
                             (shop.rcg_balance && parseFloat(shop.rcg_balance.toString()) >= 10000);
      const isSubscriptionQualified = shop.subscriptionActive || shop.operational_status === 'subscription_qualified';

      if (!isRcgQualified && !isSubscriptionQualified) {
        throw new Error('Active RepairCoin subscription or RCG qualification (10K+ RCG tokens) required to update services.');
      }

      // Validate updates
      if (updates.serviceName !== undefined && updates.serviceName.length > 100) {
        throw new Error('Service name must be 100 characters or less');
      }

      if (updates.priceUsd !== undefined && updates.priceUsd <= 0) {
        throw new Error('Service price must be greater than 0');
      }

      if (updates.durationMinutes !== undefined && updates.durationMinutes <= 0) {
        throw new Error('Service duration must be greater than 0');
      }

      // Validate and sanitize tags if provided
      const sanitizedTags = updates.tags !== undefined
        ? this.validateAndSanitizeTags(updates.tags)
        : undefined;

      const params: UpdateServiceParams = {
        serviceName: updates.serviceName,
        description: this.sanitizeDescription(updates.description),
        priceUsd: updates.priceUsd,
        durationMinutes: updates.durationMinutes,
        category: updates.category,
        imageUrl: updates.imageUrl,
        tags: sanitizedTags,
        active: updates.active
      };

      const service = await this.repository.updateService(serviceId, params);

      logger.info('Service updated successfully', { serviceId, shopId });
      return service;
    } catch (error) {
      logger.error('Error in updateService:', error);
      throw error;
    }
  }

  /**
   * Delete (deactivate) a service
   */
  async deleteService(serviceId: string, shopId: string): Promise<void> {
    try {
      // Verify service exists and belongs to the shop
      const existingService = await this.repository.getServiceById(serviceId);
      if (!existingService) {
        throw new Error('Service not found');
      }

      if (existingService.shopId !== shopId) {
        throw new Error('Unauthorized: Service does not belong to this shop');
      }

      await this.repository.deleteService(serviceId);

      logger.info('Service deleted successfully', { serviceId, shopId });
    } catch (error) {
      logger.error('Error in deleteService:', error);
      throw error;
    }
  }

  /**
   * Validate service ownership
   */
  async validateServiceOwnership(serviceId: string, shopId: string): Promise<boolean> {
    try {
      const service = await this.repository.getServiceById(serviceId);
      return service !== null && service.shopId === shopId;
    } catch (error) {
      logger.error('Error validating service ownership:', error);
      return false;
    }
  }
}
