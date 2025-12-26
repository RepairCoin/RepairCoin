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
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}:
   *   post:
   *     tags: [Services]
   *     summary: Link service to affiliate group
   *     description: Links a service to an affiliate group, allowing customers to earn group-specific tokens when booking this service. Shop must be an active member of the group.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Service ID to link
   *         example: srv_123abc
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *         description: Affiliate group ID to link to
   *         example: grp_456def
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tokenRewardPercentage:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 500
   *                 default: 100
   *                 description: Percentage of service price to award as group tokens (0-500%)
   *                 example: 150
   *               bonusMultiplier:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 10
   *                 default: 1.0
   *                 description: Bonus multiplier for token rewards (0-10x)
   *                 example: 2.0
   *     responses:
   *       201:
   *         description: Service successfully linked to group
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ServiceGroupLink'
   *       404:
   *         description: Service not found
   *       403:
   *         description: Shop is not a member of the group
   *       409:
   *         description: Service is already linked to this group
   *       500:
   *         description: Server error
   */
  async linkServiceToGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Validate reward percentage (0-500%)
      if (tokenRewardPercentage !== undefined) {
        const percentage = parseFloat(tokenRewardPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 500) {
          res.status(400).json({
            success: false,
            error: 'Invalid token reward percentage. Must be between 0 and 500.'
          });
          return;
        }
      }

      // Validate bonus multiplier (0-10x)
      if (bonusMultiplier !== undefined) {
        const multiplier = parseFloat(bonusMultiplier);
        if (isNaN(multiplier) || multiplier < 0 || multiplier > 10) {
          res.status(400).json({
            success: false,
            error: 'Invalid bonus multiplier. Must be between 0 and 10.'
          });
          return;
        }
      }

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({
          success: false,
          error: 'Service not found. Please ensure the service exists and is active.'
        });
        return;
      }

      // Verify service is active
      if (!service.active) {
        res.status(400).json({
          success: false,
          error: 'Cannot link inactive service to group. Please activate the service first.'
        });
        return;
      }

      // Verify group exists and is active
      const group = await this.groupRepository.getGroupById(groupId);
      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Affiliate group not found. Please verify the group ID.'
        });
        return;
      }

      if (!group.active) {
        res.status(400).json({
          success: false,
          error: 'Cannot link to inactive group. This group is currently not accepting new services.'
        });
        return;
      }

      // Verify shop is member of the group
      const isMember = await this.groupRepository.isShopMemberOfGroup(groupId, service.shopId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: `Your shop must join the ${group.groupName} group before linking services. Please contact the group admin or apply for membership first.`
        });
        return;
      }

      // Check if already linked
      const existingLinks = await this.serviceRepository.getServiceGroups(serviceId);
      const alreadyLinked = existingLinks.find(link => link.groupId === groupId && link.active);

      if (alreadyLinked) {
        res.status(409).json({
          success: false,
          error: `This service is already linked to ${group.groupName}. You can update the reward settings instead of creating a duplicate link.`,
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
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}:
   *   delete:
   *     tags: [Services]
   *     summary: Unlink service from affiliate group
   *     description: Removes the link between a service and an affiliate group. Customers will no longer earn group tokens when booking this service.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Service ID to unlink
   *         example: srv_123abc
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *         description: Affiliate group ID to unlink from
   *         example: grp_456def
   *     responses:
   *       200:
   *         description: Service successfully unlinked from group
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Service unlinked from group successfully
   *       404:
   *         description: Service not found
   *       500:
   *         description: Server error
   */
  async unlinkServiceFromGroup(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({
          success: false,
          error: 'Service not found. Please ensure the service exists and is active.'
        });
        return;
      }

      // Verify the service is actually linked to this group
      const existingLinks = await this.serviceRepository.getServiceGroups(serviceId);
      const linkExists = existingLinks.find(link => link.groupId === groupId && link.active);

      if (!linkExists) {
        res.status(404).json({
          success: false,
          error: 'This service is not linked to the specified group. There is nothing to unlink.'
        });
        return;
      }

      await this.serviceRepository.unlinkServiceFromGroup(serviceId, groupId);

      logger.info('Service unlinked from group', { serviceId, groupId });
      res.json({
        success: true,
        message: `Service successfully unlinked from ${linkExists.groupName || 'the group'}. Customers will no longer earn group tokens when booking this service.`
      });
    } catch (error: unknown) {
      logger.error('Error unlinking service from group', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: errorMessage });
    }
  }

  /**
   * @swagger
   * /api/services/{serviceId}/groups:
   *   get:
   *     tags: [Services]
   *     summary: Get all affiliate groups linked to a service
   *     description: Returns a list of all affiliate groups that this service is linked to, including reward settings for each group.
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Service ID to get groups for
   *         example: srv_123abc
   *     responses:
   *       200:
   *         description: List of linked affiliate groups
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ServiceGroupLink'
   *       500:
   *         description: Server error
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
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}/rewards:
   *   put:
   *     tags: [Services]
   *     summary: Update group reward settings for a service
   *     description: Updates the token reward percentage and bonus multiplier for a specific service-group link.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Service ID
   *         example: srv_123abc
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *         description: Affiliate group ID
   *         example: grp_456def
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tokenRewardPercentage:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 500
   *                 description: Percentage of service price to award as group tokens (0-500%)
   *                 example: 200
   *               bonusMultiplier:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 10
   *                 description: Bonus multiplier for token rewards (0-10x)
   *                 example: 1.5
   *     responses:
   *       200:
   *         description: Reward settings successfully updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ServiceGroupLink'
   *       404:
   *         description: Service not found
   *       500:
   *         description: Server error
   */
  async updateGroupRewards(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, groupId } = req.params;
      const { tokenRewardPercentage, bonusMultiplier } = req.body;

      // Validate at least one field is being updated
      if (tokenRewardPercentage === undefined && bonusMultiplier === undefined) {
        res.status(400).json({
          success: false,
          error: 'Please provide at least one field to update: tokenRewardPercentage or bonusMultiplier.'
        });
        return;
      }

      // Validate reward percentage (0-500%)
      if (tokenRewardPercentage !== undefined) {
        const percentage = parseFloat(tokenRewardPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 500) {
          res.status(400).json({
            success: false,
            error: 'Invalid token reward percentage. Must be between 0 and 500.'
          });
          return;
        }
      }

      // Validate bonus multiplier (0-10x)
      if (bonusMultiplier !== undefined) {
        const multiplier = parseFloat(bonusMultiplier);
        if (isNaN(multiplier) || multiplier < 0 || multiplier > 10) {
          res.status(400).json({
            success: false,
            error: 'Invalid bonus multiplier. Must be between 0 and 10.'
          });
          return;
        }
      }

      // Verify service exists and belongs to requesting shop
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        res.status(404).json({
          success: false,
          error: 'Service not found. Please ensure the service exists and is active.'
        });
        return;
      }

      // Verify the service is actually linked to this group
      const existingLinks = await this.serviceRepository.getServiceGroups(serviceId);
      const linkExists = existingLinks.find(link => link.groupId === groupId && link.active);

      if (!linkExists) {
        res.status(404).json({
          success: false,
          error: 'This service is not linked to the specified group. Please link the service first before updating rewards.'
        });
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
   * @swagger
   * /api/groups/{groupId}/services:
   *   get:
   *     tags: [Affiliate Groups]
   *     summary: Get all services in an affiliate group
   *     description: Returns a list of all active services linked to an affiliate group, with optional filtering by category, price range, and search term. Public endpoint accessible to all customers.
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *         description: Affiliate group ID
   *         example: grp_456def
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by service category
   *         example: Repair
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *         description: Minimum price in USD
   *         example: 10
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *         description: Maximum price in USD
   *         example: 100
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for service name or description
   *         example: phone repair
   *     responses:
   *       200:
   *         description: List of services in the group
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     services:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/ServiceWithShopInfo'
   *                     count:
   *                       type: number
   *                       example: 15
   *       500:
   *         description: Server error
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
