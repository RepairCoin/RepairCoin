import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

interface TransactionRecord {
  id: string;
  type: 'mint' | 'redeem' | 'transfer' | 'transfer_in' | 'transfer_out' | 'tier_bonus' | 'shop_purchase' | 'rejected_redemption' | 'cancelled_redemption';
  customerAddress: string;
  shopId?: string;
  amount: number;
  reason?: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  metadata?: any;
  shopName?: string;
  customerName?: string;
  createdAt?: Date;
}

export interface TransactionFilters {
  customerAddress?: string;
  shopId?: string;
  type?: 'mint' | 'redeem' | 'transfer' | 'tier_bonus' | 'shop_purchase';
  status?: 'pending' | 'confirmed' | 'failed';
  startDate?: string;
  endDate?: string;
}

export class TransactionRepository extends BaseRepository {
  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    try {
      const query = `
        INSERT INTO transactions (
          type, customer_address, shop_id, amount, reason,
          transaction_hash, block_number, timestamp, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await this.pool.query(query, [
        transaction.type,
        transaction.customerAddress.toLowerCase(),
        transaction.shopId,
        transaction.amount,
        transaction.reason,
        transaction.transactionHash,
        transaction.blockNumber,
        transaction.timestamp,
        transaction.status,
        JSON.stringify(transaction.metadata || {})
      ]);
      
      logger.info('Transaction recorded', { 
        id: transaction.id, 
        type: transaction.type,
        amount: transaction.amount 
      });
    } catch (error) {
      logger.error('Error recording transaction:', error);
      throw new Error('Failed to record transaction');
    }
  }

  async getTransaction(id: string): Promise<TransactionRecord | null> {
    try {
      const query = 'SELECT * FROM transactions WHERE id = $1';
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapToTransactionRecord(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching transaction:', error);
      throw new Error('Failed to fetch transaction');
    }
  }

  async getTransactionsByCustomer(
    customerAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT t.*, s.name as shop_name 
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        WHERE t.customer_address = $1
        ORDER BY t.timestamp DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [
        customerAddress.toLowerCase(),
        limit,
        offset
      ]);
      
      return result.rows.map(row => this.mapToTransactionRecord(row));
    } catch (error) {
      logger.error('Error fetching customer transactions:', error);
      throw new Error('Failed to fetch customer transactions');
    }
  }

  async getTransactionsByShop(
    shopId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT t.*, c.name as customer_name 
        FROM transactions t
        LEFT JOIN customers c ON t.customer_address = c.address
        WHERE t.shop_id = $1
        ORDER BY t.timestamp DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [shopId, limit, offset]);
      
      return result.rows.map(row => this.mapToTransactionRecord(row));
    } catch (error) {
      logger.error('Error fetching shop transactions:', error);
      throw new Error('Failed to fetch shop transactions');
    }
  }

  async getTransactionsPaginated(
    filters: TransactionFilters & { page: number; limit: number }
  ): Promise<PaginatedResult<TransactionRecord>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.customerAddress) {
        paramCount++;
        whereClause += ` AND t.customer_address = $${paramCount}`;
        params.push(filters.customerAddress.toLowerCase());
      }

      if (filters.shopId) {
        paramCount++;
        whereClause += ` AND t.shop_id = $${paramCount}`;
        params.push(filters.shopId);
      }

      if (filters.type) {
        paramCount++;
        whereClause += ` AND t.type = $${paramCount}`;
        params.push(filters.type);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND t.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        whereClause += ` AND t.timestamp >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereClause += ` AND t.timestamp <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM transactions t ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT t.*, s.name as shop_name, c.name as customer_name
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        LEFT JOIN customers c ON t.customer_address = c.address
        ${whereClause}
        ORDER BY t.timestamp DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const transactions = result.rows.map(row => this.mapToTransactionRecord(row));
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: transactions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting paginated transactions:', error);
      throw new Error('Failed to get transactions');
    }
  }

  async getByTransactionHash(transactionHash: string): Promise<TransactionRecord | null> {
    try {
      const query = 'SELECT * FROM transactions WHERE transaction_hash = $1';
      const result = await this.pool.query(query, [transactionHash]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapToTransactionRecord(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching transaction by hash:', error);
      throw new Error('Failed to fetch transaction by hash');
    }
  }

  async create(transaction: Omit<TransactionRecord, 'id' | 'createdAt'>): Promise<TransactionRecord> {
    try {
      const query = `
        INSERT INTO transactions (
          type, customer_address, shop_id, amount, reason,
          transaction_hash, block_number, timestamp, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        transaction.type,
        transaction.customerAddress.toLowerCase(),
        transaction.shopId,
        transaction.amount,
        transaction.reason,
        transaction.transactionHash,
        transaction.blockNumber,
        transaction.timestamp,
        transaction.status,
        JSON.stringify(transaction.metadata || {})
      ]);
      
      const createdTransaction = this.mapToTransactionRecord(result.rows[0]);
      logger.info('Transaction created', { 
        id: createdTransaction.id, 
        type: createdTransaction.type,
        amount: createdTransaction.amount 
      });
      
      return createdTransaction;
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }
  }

  async getTransferHistory(
    customerAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT * FROM transactions
        WHERE customer_address = $1 
        AND type IN ('transfer_in', 'transfer_out')
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [
        customerAddress.toLowerCase(),
        limit,
        offset
      ]);
      
      return result.rows.map(row => this.mapToTransactionRecord(row));
    } catch (error) {
      logger.error('Error fetching transfer history:', error);
      throw new Error('Failed to fetch transfer history');
    }
  }

  async getTransferHistoryCount(customerAddress: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count FROM transactions
        WHERE customer_address = $1 
        AND type IN ('transfer_in', 'transfer_out')
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting transfer history count:', error);
      throw new Error('Failed to get transfer history count');
    }
  }

  async updateTransactionStatus(
    id: string, 
    status: 'pending' | 'confirmed' | 'failed' | 'completed',
    blockNumber?: number
  ): Promise<void> {
    try {
      let query = `
        UPDATE transactions 
        SET status = $1, updated_at = NOW()
      `;
      const params: any[] = [status];
      let paramCount = 1;

      if (blockNumber !== undefined) {
        paramCount++;
        query += `, block_number = $${paramCount}`;
        params.push(blockNumber);
      }

      paramCount++;
      query += ` WHERE id = $${paramCount}`;
      params.push(id);

      await this.pool.query(query, params);
      logger.info('Transaction status updated', { id, status });
    } catch (error) {
      logger.error('Error updating transaction status:', error);
      throw new Error('Failed to update transaction status');
    }
  }

  async getRecentTransactions(
    limit: number = 10
  ): Promise<TransactionRecord[]> {
    try {
      const query = `
        SELECT t.*, s.name as shop_name, c.name as customer_name
        FROM transactions t
        LEFT JOIN shops s ON t.shop_id = s.shop_id
        LEFT JOIN customers c ON t.customer_address = c.address
        WHERE t.status = 'confirmed'
        ORDER BY t.timestamp DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => this.mapToTransactionRecord(row));
    } catch (error) {
      logger.error('Error fetching recent transactions:', error);
      throw new Error('Failed to fetch recent transactions');
    }
  }

  async getTransactionStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalTransactions: number;
    totalMinted: number;
    totalRedeemed: number;
    totalVolume: number;
  }> {
    try {
      let whereClause = "WHERE status = 'confirmed'";
      const params: any[] = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        whereClause += ` AND timestamp >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        whereClause += ` AND timestamp <= $${paramCount}`;
        params.push(endDate);
      }

      const query = `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as total_minted,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redeemed,
          COALESCE(SUM(amount), 0) as total_volume
        FROM transactions
        ${whereClause}
      `;
      
      const result = await this.pool.query(query, params);
      const row = result.rows[0];
      
      return {
        totalTransactions: parseInt(row.total_transactions),
        totalMinted: parseFloat(row.total_minted),
        totalRedeemed: parseFloat(row.total_redeemed),
        totalVolume: parseFloat(row.total_volume)
      };
    } catch (error) {
      logger.error('Error getting transaction stats:', error);
      throw new Error('Failed to get transaction stats');
    }
  }

  async getShopTransactions(
    shopId: string,
    filters: {
      page: number;
      limit: number;
      type?: string;
    }
  ): Promise<{
    items: any[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    try {
      const offset = (filters.page - 1) * filters.limit;
      let whereClause = 'WHERE t.shop_id = $1';
      const params: any[] = [shopId];
      let paramCount = 1;

      // Add type filter if provided
      if (filters.type) {
        paramCount++;
        if (filters.type === 'rewards') {
          whereClause += ` AND t.type = 'mint'`;
        } else if (filters.type === 'redemptions') {
          whereClause += ` AND t.type = 'redeem'`;
        } else if (filters.type === 'failed') {
          whereClause += ` AND t.status = 'failed'`;
        }
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM transactions t
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const query = `
        SELECT 
          t.*,
          c.name as customer_name
        FROM transactions t
        LEFT JOIN customers c ON t.customer_address = c.address
        ${whereClause}
        ORDER BY t.timestamp DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(filters.limit, offset);
      
      const result = await this.pool.query(query, params);
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: result.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting shop transactions:', error);
      throw new Error('Failed to get shop transactions');
    }
  }

  private mapToTransactionRecord(row: any): TransactionRecord {
    return {
      id: row.id,
      type: row.type,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      amount: parseFloat(row.amount),
      reason: row.reason,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      timestamp: row.timestamp,
      status: row.status,
      metadata: row.metadata,
      // Additional fields from joins
      ...(row.shop_name && { shopName: row.shop_name }),
      ...(row.customer_name && { customerName: row.customer_name })
    };
  }
}