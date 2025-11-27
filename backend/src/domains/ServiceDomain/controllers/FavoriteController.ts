// backend/src/domains/ServiceDomain/controllers/FavoriteController.ts
import { Request, Response } from 'express';
import { FavoriteRepository } from '../../../repositories/FavoriteRepository';
import { logger } from '../../../utils/logger';

const favoriteRepository = new FavoriteRepository();

export class FavoriteController {
  /**
   * Add service to favorites
   * POST /api/services/favorites
   */
  async addFavorite(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!serviceId) {
        res.status(400).json({ error: 'Service ID is required' });
        return;
      }

      const favorite = await favoriteRepository.addFavorite(customerAddress, serviceId);

      res.status(201).json({
        success: true,
        data: favorite
      });
    } catch (error) {
      logger.error('Error adding favorite:', error);
      res.status(500).json({
        error: 'Failed to add favorite'
      });
    }
  }

  /**
   * Remove service from favorites
   * DELETE /api/services/favorites/:serviceId
   */
  async removeFavorite(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await favoriteRepository.removeFavorite(customerAddress, serviceId);

      res.json({
        success: true,
        message: 'Service removed from favorites'
      });
    } catch (error) {
      logger.error('Error removing favorite:', error);
      res.status(500).json({
        error: 'Failed to remove favorite'
      });
    }
  }

  /**
   * Check if service is favorited
   * GET /api/services/favorites/check/:serviceId
   */
  async checkFavorite(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const isFavorited = await favoriteRepository.isFavorited(customerAddress, serviceId);

      res.json({
        success: true,
        data: { isFavorited }
      });
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      res.status(500).json({
        error: 'Failed to check favorite status'
      });
    }
  }

  /**
   * Get customer's favorite services
   * GET /api/services/favorites
   */
  async getCustomerFavorites(req: Request, res: Response): Promise<void> {
    try {
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await favoriteRepository.getCustomerFavorites(customerAddress, {
        page,
        limit
      });

      // Transform data to match frontend ShopServiceWithShopInfo interface
      const transformedItems = result.items.map((item: any) => ({
        serviceId: item.serviceId,
        shopId: item.shopId,
        serviceName: item.serviceName,
        description: item.description,
        priceUsd: item.priceUsd,
        durationMinutes: item.durationMinutes,
        category: item.category,
        imageUrl: item.imageUrl,
        tags: item.tags,
        averageRating: item.averageRating,
        reviewCount: item.reviewCount,
        active: true,
        companyName: item.shopName, // Map shopName to companyName
        shopAddress: item.shopAddress,
        shopIsVerified: item.shopIsVerified || false,
        createdAt: item.createdAt
      }));

      res.json({
        success: true,
        data: transformedItems,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error fetching customer favorites:', error);
      res.status(500).json({
        error: 'Failed to fetch favorites'
      });
    }
  }

  /**
   * Get favorite count for a service
   * GET /api/services/:serviceId/favorites/count
   */
  async getServiceFavoriteCount(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;

      const count = await favoriteRepository.getServiceFavoriteCount(serviceId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      logger.error('Error fetching favorite count:', error);
      res.status(500).json({
        error: 'Failed to fetch favorite count'
      });
    }
  }
}
