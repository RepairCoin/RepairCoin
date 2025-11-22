// backend/src/domains/ServiceDomain/controllers/ServiceController.ts
import { Request, Response } from 'express';
import { ServiceManagementService, CreateServiceRequest, UpdateServiceRequest } from '../services/ServiceManagementService';
import { logger } from '../../../utils/logger';

export class ServiceController {
  private service: ServiceManagementService;

  constructor() {
    this.service = new ServiceManagementService();
  }

  /**
   * Create a new service (Shop only)
   * POST /api/services
   */
  createService = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const request: CreateServiceRequest = {
        ...req.body,
        shopId
      };

      const service = await this.service.createService(request);

      res.status(201).json({
        success: true,
        data: service
      });
    } catch (error: unknown) {
      logger.error('Error in createService controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create service'
      });
    }
  };

  /**
   * Get all services (Marketplace view - Public)
   * GET /api/services
   */
  getAllServices = async (req: Request, res: Response) => {
    try {
      const filters = {
        shopId: req.query.shopId as string | undefined,
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        activeOnly: req.query.activeOnly !== 'false' // Default to true
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await this.service.getMarketplaceServices(filters, options);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getAllServices controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get services'
      });
    }
  };

  /**
   * Get service by ID with shop info (Public)
   * GET /api/services/:id
   */
  getServiceById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const service = await this.service.getServiceWithShopInfo(id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      res.json({
        success: true,
        data: service
      });
    } catch (error: unknown) {
      logger.error('Error in getServiceById controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service'
      });
    }
  };

  /**
   * Get all services for a shop (Public or Shop owner)
   * GET /api/services/shop/:shopId
   */
  getShopServices = async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const requestingShopId = req.user?.shopId;

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        // Only show active services to public, show all to shop owner
        activeOnly: requestingShopId !== shopId
      };

      const result = await this.service.getShopServices(shopId, options);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getShopServices controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop services'
      });
    }
  };

  /**
   * Update a service (Shop owner only)
   * PUT /api/services/:id
   */
  updateService = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const updates: UpdateServiceRequest = req.body;

      const service = await this.service.updateService(id, shopId, updates);

      res.json({
        success: true,
        data: service
      });
    } catch (error: unknown) {
      logger.error('Error in updateService controller:', error);

      // Handle unauthorized errors with 403
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service'
      });
    }
  };

  /**
   * Delete (deactivate) a service (Shop owner only)
   * DELETE /api/services/:id
   */
  deleteService = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;

      await this.service.deleteService(id, shopId);

      res.json({
        success: true,
        message: 'Service deleted successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in deleteService controller:', error);

      // Handle unauthorized errors with 403
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete service'
      });
    }
  };
}
