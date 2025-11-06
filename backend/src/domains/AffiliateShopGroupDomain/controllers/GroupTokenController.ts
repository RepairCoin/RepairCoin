// backend/src/domains/AffiliateShopGroupDomain/controllers/GroupTokenController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService, EarnGroupTokensRequest, RedeemGroupTokensRequest } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class GroupTokenController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
  }

  /**
   * Issue group tokens to customer (shop endpoint)
   */
  earnTokens = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const { customerAddress, amount, reason, metadata } = req.body;

      if (!customerAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Customer address and amount are required'
        });
      }

      const request: EarnGroupTokensRequest = {
        customerAddress,
        groupId,
        shopId,
        amount,
        reason,
        metadata
      };

      const result = await this.service.earnGroupTokens(request);

      res.json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.newBalance.balance,
          lifetimeEarned: result.newBalance.lifetimeEarned
        }
      });
    } catch (error: unknown) {
      logger.error('Error in earnTokens controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to issue group tokens'
      });
    }
  };

  /**
   * Redeem group tokens (shop endpoint)
   */
  redeemTokens = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const { customerAddress, amount, reason, metadata } = req.body;

      if (!customerAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Customer address and amount are required'
        });
      }

      const request: RedeemGroupTokensRequest = {
        customerAddress,
        groupId,
        shopId,
        amount,
        reason,
        metadata
      };

      const result = await this.service.redeemGroupTokens(request);

      res.json({
        success: true,
        data: {
          transaction: result.transaction,
          newBalance: result.newBalance.balance,
          lifetimeRedeemed: result.newBalance.lifetimeRedeemed
        }
      });
    } catch (error: unknown) {
      logger.error('Error in redeemTokens controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to redeem group tokens'
      });
    }
  };

  /**
   * Get customer's balance in a group
   */
  getCustomerBalance = async (req: Request, res: Response) => {
    try {
      const { groupId, customerAddress } = req.params;

      const balance = await this.service.getCustomerBalance(customerAddress, groupId);

      if (!balance) {
        return res.json({
          success: true,
          data: {
            balance: 0,
            lifetimeEarned: 0,
            lifetimeRedeemed: 0
          }
        });
      }

      res.json({
        success: true,
        data: balance
      });
    } catch (error: unknown) {
      logger.error('Error in getCustomerBalance controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer balance'
      });
    }
  };

  /**
   * Get all customer's group balances
   */
  getAllCustomerBalances = async (req: Request, res: Response) => {
    try {
      const { customerAddress } = req.params;

      const balances = await this.service.getAllCustomerBalances(customerAddress);

      res.json({
        success: true,
        data: balances
      });
    } catch (error: unknown) {
      logger.error('Error in getAllCustomerBalances controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer balances'
      });
    }
  };

  /**
   * Get group transaction history
   */
  getGroupTransactions = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as 'earn' | 'redeem' | undefined
      };

      const result = await this.service.getGroupTransactions(groupId, filters);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getGroupTransactions controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get group transactions'
      });
    }
  };

  /**
   * Get customer's transaction history in a group
   */
  getCustomerTransactions = async (req: Request, res: Response) => {
    try {
      const { groupId, customerAddress } = req.params;
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await this.service.getCustomerTransactions(customerAddress, groupId, filters);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getCustomerTransactions controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer transactions'
      });
    }
  };
}
