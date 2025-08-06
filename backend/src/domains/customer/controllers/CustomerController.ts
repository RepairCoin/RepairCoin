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
      const { walletAddress, email, phone, fixflowCustomerId, referralCode } = req.body;
      
      const result = await this.customerService.registerCustomer({
        walletAddress,
        email,
        phone,
        fixflowCustomerId,
        referralCode
      });
      
      ResponseHelper.created(res, result, 'Customer registered successfully');
    } catch (error: any) {
      if (error.message === 'Customer already registered') {
        ResponseHelper.conflict(res, error.message);
      } else if (error.message.includes('already registered as')) {
        // Role conflict errors
        ResponseHelper.conflict(res, error.message);
      } else {
        ResponseHelper.error(res, error.message, 500);
      }
    }
  }

  async updateCustomer(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { name, email, phone } = req.body;
      
      const result = await this.customerService.updateCustomer(
        address,
        { name, email, phone },
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
      
      // TODO: Re-enable this check once customer authentication is implemented
      // Temporarily disabled to allow suspended customers to request unsuspension
      // // Verify the requesting user is the suspended customer
      // if (req.user?.address?.toLowerCase() !== address.toLowerCase()) {
      //   return ResponseHelper.forbidden(res, 'You can only request unsuspension for your own account');
      // }
      
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
}