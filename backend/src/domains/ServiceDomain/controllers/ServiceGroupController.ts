import { Request, Response } from 'express';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { AffiliateShopGroupRepository } from '../../../repositories/AffiliateShopGroupRepository';
import { logger } from '../../../utils/logger';

export class ServiceGroupController {
  private serviceRepository: ServiceRepository;
  private groupRepository: AffiliateShopGroupRepository;

  constructor() {
    this.serviceRepository = new ServiceRepository();
    this.groupRepository = new AffiliateShopGroupRepository();
  }

  /**
   * Link a service to an affiliate group
   * POST /api/services/:serviceId/groups/:groupId
   */
  async linkServiceToGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      // Verify shop is member of the group
      const isMember = await this.groupRepository.isShopMemberOfGroup(groupId, service.shopId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Shop must be an active member of the group to link services'
        });
        return;
      }

      // Check if already linked
      const existingLinks = await this.serviceRepository.getServiceGroups(serviceId);
      const alreadyLinked = existingLinks.find(link => link.groupId === groupId && link.active);

      if (alreadyLinked) {
        res.status(409).json({
          success: false,
          error: 'Service is already linked to this group',
          data: alreadyLinked
        });
        return;
      }

      // Link the service
      const link = await this.serviceRepository.linkServiceToGroup(
        serviceId,
        groupId,
        tokenRewardPercentage || 100,
        bonusMultiplier || 1.0
      );

      logger.info('Service linked to group', { serviceId, groupId, shopId: service.shopId });
      res.status(201).json({ success: true, data: link });
    } catch (error: unknown) {
      logger.error('Error linking service to group', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * Unlink a service from a group
   * DELETE /api/services/:serviceId/groups/:groupId
   */
  async unlinkServiceFromGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      await this.serviceRepository.unlinkServiceFromGroup(serviceId, groupId);

      logger.info('Service unlinked from group', { serviceId, groupId });
      res.json({ success: true, message: 'Service unlinked from group successfully' });
    } catch (error: unknown) {
      logger.error('Error unlinking service from group', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * Get all groups a service is linked to
   * GET /api/services/:serviceId/groups
   */
  async getServiceGroups(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;

      const groups = await this.serviceRepository.getServiceGroups(serviceId);

      res.json({ success: true, data: groups });
    } catch (error: unknown) {
      logger.error('Error getting service groups', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * Update group reward settings for a service
   * PUT /api/services/:serviceId/groups/:groupId/rewards
   */
  async updateGroupRewards(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({ success: false, error: 'Service not found' });
        return;
      }

      const updated = await this.serviceRepository.updateServiceGroupRewards(
        serviceId,
        groupId,
        tokenRewardPercentage,
        bonusMultiplier
      );

      logger.info('Service group rewards updated', { serviceId, groupId });
      res.json({ success: true, data: updated });
    } catch (error: unknown) {
      logger.error('Error updating service group rewards', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * Get all services in a group (public endpoint for customers)
   * GET /api/groups/:groupId/services
   */
  async getGroupServices(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { category, minPrice, maxPrice, search } = req.query;

      const filters = {
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        search: search as string
      };

      const services = await this.serviceRepository.getServicesByGroup(groupId, filters);

      res.json({
        success: true,
        data: {
          services,
          count: services.length
        }
      });
    } catch (error: unknown) {
      logger.error('Error getting group services', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }
}
