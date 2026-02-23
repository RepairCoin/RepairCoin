// backend/src/controllers/CustomerController.ts
import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { ResponseHelper } from '../../../utils/responseHelper';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  async getCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const result = await this.customerService.getCustomerDetails(address);
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async registerCustomer(req: Request, res: Response) {
    try {
      const {
        walletAddress,
        email,
        name,
        first_name,
        last_name,
        phone,
        fixflowCustomerId,
        referralCode,
        walletType = 'external',
        authMethod = 'wallet'
      } = req.body;

      const result = await this.customerService.registerCustomer({
        walletAddress,
        email,
        name,
        first_name,
        last_name,
        phone,
        fixflowCustomerId,
        referralCode,
        walletType,
        authMethod
      });
      
      ResponseHelper.created(res, result, 'Customer registered successfully');
    } catch (error: any) {
      if (error.message.includes('already registered') || error.message.includes('already in use')) {
        ResponseHelper.conflict(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async listCustomers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 100, search = '' } = req.query;
      
      const result = await this.customerService.listCustomers({
        page: Number(page),
        limit: Number(limit),
        search: search as string
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  async updateCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { name, first_name, last_name, email, phone, profile_image_url } = req.body;

      const result = await this.customerService.updateCustomer(
        address,
        { name, first_name, last_name, email, phone, profile_image_url },
        req.user?.address,
        req.user?.role
      );
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else if (error.message === 'Can only update your own customer data') {
        ResponseHelper.forbidden(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async getTransactionHistory(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { limit = '50', offset = '0', type } = req.query;
      
      const result = await this.customerService.getTransactionHistory(
        address,
        parseInt(limit as string),
        type as string,
        req.user?.address,
        req.user?.role
      );
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else if (error.message === 'Can only view your own transaction history') {
        ResponseHelper.forbidden(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async getCustomerAnalytics(req: Request, res: Response) {
    try {
      const { address } = req.params;
      
      const analytics = await this.customerService.getCustomerAnalytics(
        address,
        req.user?.address,
        req.user?.role
      );
      
      ResponseHelper.success(res, analytics);
    } catch (error: any) {
      if (error.message === 'Can only view your own analytics') {
        ResponseHelper.forbidden(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async manualMint(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { amount, reason, shopId = 'admin_system' } = req.body;
      
      const result = await this.customerService.manualMintToCustomer(
        address,
        amount,
        reason,
        req.user?.address,
        shopId
      );
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 400);
      }
    }
  }

  async checkRedemptionEligibility(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { shopId, amount } = req.query;
      
      const result = await this.customerService.checkRedemptionEligibility({
        customerAddress: address,
        shopId: shopId as string,
        amount: parseFloat(amount as string)
      });
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found' || error.message === 'Shop not found') {
        ResponseHelper.notFound(res, error.message);
      } else if (error.message === 'Insufficient balance') {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async getCustomersByTier(req: Request, res: Response) {
    try {
      const { tierLevel } = req.params;
      
      const result = await this.customerService.getCustomersByTier(tierLevel);
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message.includes('Invalid tier level')) {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async deactivateCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { reason } = req.body;
      
      const result = await this.customerService.deactivateCustomer(
        address,
        reason,
        req.user?.address
      );
      
      ResponseHelper.success(res, result);
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else if (error.message === 'Customer already inactive') {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async requestUnsuspend(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { reason } = req.body;
      
      // Note: This endpoint is public to allow suspended customers to request unsuspension
      // Rate limiting is applied at the route level to prevent abuse
      
      const result = await this.customerService.requestUnsuspend(address, reason);
      
      ResponseHelper.success(res, result, 'Unsuspend request submitted successfully');
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else if (error.message === 'Customer is not suspended') {
        ResponseHelper.badRequest(res, error.message);
      } else if (error.message.includes('pending request')) {
        ResponseHelper.badRequest(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  /**
   * Get customer's no-show status
   * GET /api/customers/:address/no-show-status?shopId=xxx
   */
  async getNoShowStatus(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { shopId } = req.query;

      if (!shopId) {
        return ResponseHelper.badRequest(res, 'shopId query parameter is required');
      }

      const noShowPolicyService = require('../../../services/NoShowPolicyService').default;
      const status = await noShowPolicyService.getCustomerStatus(address, shopId as string);

      ResponseHelper.success(res, {
        customerAddress: status.customerAddress,
        noShowCount: status.noShowCount,
        tier: status.tier,
        depositRequired: status.depositRequired,
        lastNoShowAt: status.lastNoShowAt,
        bookingSuspendedUntil: status.bookingSuspendedUntil,
        successfulAppointmentsSinceTier3: status.successfulAppointmentsSinceTier3,
        canBook: status.canBook,
        requiresDeposit: status.requiresDeposit,
        minimumAdvanceHours: status.minimumAdvanceHours,
        restrictions: status.restrictions
      });
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  /**
   * Get customer's no-show history
   * GET /api/customers/:address/no-show-history?limit=10
   */
  async getNoShowHistory(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const noShowPolicyService = require('../../../services/NoShowPolicyService').default;
      const history = await noShowPolicyService.getCustomerHistory(address, limit);

      ResponseHelper.success(res, {
        history,
        count: history.length
      });
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get customer's overall no-show status (shop-agnostic)
   * GET /api/customers/:address/overall-no-show-status
   * This endpoint returns the customer's global no-show tier without requiring a shopId
   * Useful for dashboard and settings pages
   */
  async getOverallNoShowStatus(req: Request, res: Response) {
    try {
      const { address } = req.params;

      const noShowPolicyService = require('../../../services/NoShowPolicyService').default;
      const status = await noShowPolicyService.getOverallCustomerStatus(address);

      ResponseHelper.success(res, {
        customerAddress: status.customerAddress,
        noShowCount: status.noShowCount,
        tier: status.tier,
        depositRequired: status.depositRequired,
        lastNoShowAt: status.lastNoShowAt,
        bookingSuspendedUntil: status.bookingSuspendedUntil,
        successfulAppointmentsSinceTier3: status.successfulAppointmentsSinceTier3,
        canBook: status.canBook,
        requiresDeposit: status.requiresDeposit,
        minimumAdvanceHours: status.minimumAdvanceHours,
        restrictions: status.restrictions
      });
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        ResponseHelper.notFound(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }
}