// backend/src/controllers/AdminController.ts
import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService';
import { ResponseHelper } from '../../../utils/responseHelper';

export class AdminController {
  constructor(private adminService: AdminService) {}

  async getPlatformStats(req: Request, res: Response) {
    try {
      const stats = await this.adminService.getPlatformStatistics();
      ResponseHelper.success(res, stats);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async getCustomers(req: Request, res: Response) {
    try {
      const { page = '1', limit = '50', tier, active = 'true' } = req.query;
      
      const result = await this.adminService.getCustomers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        tier: tier as string,
        active: active === 'true'
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async getShops(req: Request, res: Response) {
    try {
      const { active = 'true', verified = 'true' } = req.query;
      
      const result = await this.adminService.getShops({
        active: active === 'true',
        verified: verified === 'true'
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async manualMint(req: Request, res: Response) {
    try {
      const { customerAddress, amount, reason } = req.body;
      
      const result = await this.adminService.manualMint({
        customerAddress,
        amount,
        reason,
        adminAddress: req.user?.address
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async pauseContract(req: Request, res: Response) {
    try {
      const result = await this.adminService.pauseContract(req.user?.address);
      
      ResponseHelper.success(res, {
        message: 'Contract paused successfully',
        transactionHash: result.transactionHash
      });
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 400);
    }
  }

  async unpauseContract(req: Request, res: Response) {
    try {
      const result = await this.adminService.unpauseContract(req.user?.address);
      
      ResponseHelper.success(res, {
        message: 'Contract unpaused successfully',
        transactionHash: result.transactionHash
      });
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 400);
    }
  }

  async approveShop(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      
      const result = await this.adminService.approveShop(shopId, req.user?.address);
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Shop not found') {
        ResponseHelper.error(res, error.message, 404);
      } else if (error.message === 'Shop already verified') {
        ResponseHelper.error(res, error.message, 400);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async getFailedWebhooks(req: Request, res: Response) {
    try {
      const { limit = '20' } = req.query;
      
      const result = await this.adminService.getFailedWebhooks(parseInt(limit as string));
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async cleanupWebhooks(req: Request, res: Response) {
    try {
      const { daysOld = 30 } = req.body;
      
      const result = await this.adminService.cleanupWebhookLogs(daysOld);
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async archiveTransactions(req: Request, res: Response) {
    try {
      const { daysOld = 365 } = req.body;
      
      const result = await this.adminService.archiveTransactions(daysOld);
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async createShop(req: Request, res: Response) {
    try {
      const shopData = req.body;
      
      // Map frontend field names to database field names
      const dbShopData = {
        shopId: shopData.shop_id,
        name: shopData.name,
        address: shopData.address,
        phone: shopData.phone,
        email: shopData.email,
        walletAddress: shopData.wallet_address,
        reimbursementAddress: shopData.reimbursement_address || shopData.wallet_address,
        verified: shopData.verified || false,
        active: shopData.active !== false,
        crossShopEnabled: shopData.cross_shop_enabled || false,
        fixflowShopId: shopData.fixflow_shop_id,
        location: {
          lat: shopData.location_lat ? parseFloat(shopData.location_lat) : undefined,
          lng: shopData.location_lng ? parseFloat(shopData.location_lng) : undefined,
          city: shopData.location_city,
          state: shopData.location_state,
          zipCode: shopData.location_zip_code
        }
      };

      const result = await this.adminService.createShop(dbShopData);
      ResponseHelper.success(res, result, 'Shop created successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async createAdmin(req: Request, res: Response) {
    try {
      const { walletAddress, name, email, permissions } = req.body;
      
      const result = await this.adminService.createAdmin({
        walletAddress,
        name,
        email,
        permissions
      });
      
      ResponseHelper.success(res, result, 'Admin created successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }
}