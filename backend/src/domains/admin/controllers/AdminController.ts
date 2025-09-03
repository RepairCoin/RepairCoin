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
        active: active === 'all' ? undefined : active === 'true',
        verified: verified === 'all' ? undefined : verified === 'true'
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
      
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can create new admins', 403);
      }
      
      const result = await this.adminService.createAdmin({
        walletAddress,
        name,
        email,
        permissions,
        createdBy: requesterAddress
      });
      
      ResponseHelper.success(res, result, 'Admin created successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async suspendCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { reason } = req.body;
      
      const result = await this.adminService.suspendCustomer(address, reason, req.user?.address);
      ResponseHelper.success(res, result, 'Customer suspended successfully');
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async unsuspendCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      
      const result = await this.adminService.unsuspendCustomer(address, req.user?.address);
      ResponseHelper.success(res, result, 'Customer unsuspended successfully');
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async suspendShop(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      const { reason } = req.body;
      
      const result = await this.adminService.suspendShop(shopId, reason, req.user?.address);
      ResponseHelper.success(res, result, 'Shop suspended successfully');
    } catch (error: any) {
      if (error.message === 'Shop not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async unsuspendShop(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      
      const result = await this.adminService.unsuspendShop(shopId, req.user?.address);
      ResponseHelper.success(res, result, 'Shop unsuspended successfully');
    } catch (error: any) {
      if (error.message === 'Shop not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async updateShop(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      const updates = req.body;
      
      const result = await this.adminService.updateShop(shopId, updates, req.user?.address);
      ResponseHelper.success(res, result, 'Shop updated successfully');
    } catch (error: any) {
      if (error.message === 'Shop not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async verifyShop(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      
      const result = await this.adminService.verifyShop(shopId, req.user?.address);
      ResponseHelper.success(res, result, 'Shop verified successfully');
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

  async mintShopBalance(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      
      const result = await this.adminService.mintShopBalance(shopId);
      
      ResponseHelper.success(res, result, 'Shop balance minted successfully');
    } catch (error: any) {
      if (error.message === 'Shop not found') {
        ResponseHelper.error(res, error.message, 404);
      } else if (error.message === 'No balance to mint') {
        ResponseHelper.error(res, error.message, 400);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async getUnsuspendRequests(req: Request, res: Response) {
    try {
      const { status = 'pending', entityType } = req.query;
      
      const result = await this.adminService.getUnsuspendRequests({
        status: status as string,
        entityType: entityType as string
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async approveUnsuspendRequest(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const { notes } = req.body;
      
      const result = await this.adminService.approveUnsuspendRequest(
        parseInt(requestId),
        req.user?.address,
        notes
      );
      
      ResponseHelper.success(res, result, 'Unsuspend request approved');
    } catch (error: any) {
      if (error.message === 'Request not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async rejectUnsuspendRequest(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const { notes } = req.body;
      
      const result = await this.adminService.rejectUnsuspendRequest(
        parseInt(requestId),
        req.user?.address,
        notes
      );
      
      ResponseHelper.success(res, result, 'Unsuspend request rejected');
    } catch (error: any) {
      if (error.message === 'Request not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  // Admin Management Methods (Super Admin Only)
  
  async getAllAdmins(req: Request, res: Response) {
    try {
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can view all admins', 403);
      }
      
      const admins = await this.adminService.getAllAdmins();
      ResponseHelper.success(res, admins, 'Admins retrieved successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message);
    }
  }

  async getAdmin(req: Request, res: Response) {
    try {
      const { adminId } = req.params;
      
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can view admin details', 403);
      }
      
      const admin = await this.adminService.getAdminById(adminId);
      
      if (!admin) {
        return ResponseHelper.error(res, 'Admin not found', 404);
      }
      
      ResponseHelper.success(res, admin, 'Admin retrieved successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message);
    }
  }

  async updateAdmin(req: Request, res: Response) {
    try {
      const { adminId } = req.params;
      const updateData = req.body;
      
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can update admins', 403);
      }
      
      const result = await this.adminService.updateAdmin(adminId, updateData);
      ResponseHelper.success(res, result, 'Admin updated successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message);
    }
  }

  async deleteAdmin(req: Request, res: Response) {
    try {
      const { adminId } = req.params;
      
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can delete admins', 403);
      }
      
      // Prevent deletion of super admin from env
      const admin = await this.adminService.getAdminById(adminId);
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (admin?.walletAddress?.toLowerCase() === adminAddresses[0]) {
        return ResponseHelper.error(res, 'Cannot delete the primary super admin', 400);
      }
      
      await this.adminService.deleteAdmin(adminId);
      ResponseHelper.success(res, null, 'Admin deleted successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message);
    }
  }

  async updateAdminPermissions(req: Request, res: Response) {
    try {
      const { adminId } = req.params;
      const { permissions } = req.body;
      
      // Check if requester is super admin
      const requesterAddress = req.user?.address;
      const isSuperAdmin = await this.checkIfSuperAdmin(requesterAddress);
      
      if (!isSuperAdmin) {
        return ResponseHelper.error(res, 'Only super admin can update permissions', 403);
      }
      
      // Get the admin to get their wallet address
      const admin = await this.adminService.getAdminById(adminId);
      if (!admin) {
        return ResponseHelper.error(res, 'Admin not found', 404);
      }
      
      // AdminService.updateAdminPermissions expects walletAddress, not adminId
      const result = await this.adminService.updateAdminPermissions(admin.walletAddress, permissions, requesterAddress);
      ResponseHelper.success(res, result, 'Admin permissions updated successfully');
    } catch (error: any) {
      ResponseHelper.error(res, error.message);
    }
  }

  async getAdminProfile(req: Request, res: Response) {
    try {
      const walletAddress = req.user?.address;
      
      if (!walletAddress) {
        return ResponseHelper.error(res, 'No authenticated user', 401);
      }
      
      const adminProfile = await this.adminService.getAdminProfile(walletAddress);
      
      ResponseHelper.success(res, adminProfile, 'Admin profile retrieved successfully');
    } catch (error: any) {
      if (error.message === 'Admin not found') {
        ResponseHelper.error(res, error.message, 404);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  // Helper method to check if user is super admin
  private async checkIfSuperAdmin(address?: string): Promise<boolean> {
    if (!address) return false;
    
    // Check if this is the super admin from .env (first address in ADMIN_ADDRESSES)
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
    const superAdminAddress = adminAddresses[0]; // First address is super admin
    if (superAdminAddress === address.toLowerCase()) {
      return true;
    }
    
    // Check if user is super admin in database
    const admin = await this.adminService.getAdminByWalletAddress(address);
    return admin?.isSuperAdmin === true;
  }
}