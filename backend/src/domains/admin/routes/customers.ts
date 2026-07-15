import { Router, Request, Response } from 'express';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { TransactionRepository } from '../../../repositories/TransactionRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { DatabaseService } from '../../../services/DatabaseService';

const router = Router();

// Get all customers grouped by shop
router.get('/grouped-by-shop',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const customerRepo = new CustomerRepository();
      const transactionRepo = new TransactionRepository();
      const shopRepo = new ShopRepository();

      // Use singleton database service
      const db = DatabaseService.getInstance();

      // Get all shops
      const shopsResult = await db.query('SELECT * FROM shops WHERE active = true AND verified = true ORDER BY name');
      const shops = shopsResult.rows;
      
      // Get all customers
      const allCustomers = await customerRepo.getAllCustomers(10000, 0);
      
      // Build a map of customer addresses to customer data
      const customerMap = new Map();
      allCustomers.forEach(customer => {
        customerMap.set(customer.address.toLowerCase(), customer);
      });

      // Get all mint transactions to map customers to shops
      const query = `
        SELECT DISTINCT 
          t.shop_id,
          t.customer_address,
          SUM(t.amount) as total_earned,
          MAX(t.created_at) as last_transaction,
          COUNT(*) as transaction_count
        FROM transactions t
        WHERE t.type = 'mint'
        GROUP BY t.shop_id, t.customer_address
        ORDER BY t.shop_id, total_earned DESC
      `;
      
      const result = await db.query(query);
      const transactions = result.rows;

      // Build shop-customer mapping
      const shopCustomerMap = new Map();
      const customersWithTransactions = new Set();

      transactions.forEach(tx => {
        const shopId = tx.shop_id;
        const customerAddress = tx.customer_address.toLowerCase();
        customersWithTransactions.add(customerAddress);

        if (!shopCustomerMap.has(shopId)) {
          shopCustomerMap.set(shopId, []);
        }

        const customerData = customerMap.get(customerAddress) || {
          address: customerAddress,
          name: null,
          tier: 'BRONZE',
          isActive: true
        };

        shopCustomerMap.get(shopId).push({
          address: customerAddress,
          name: customerData.name,
          tier: customerData.tier,
          lifetimeEarnings: parseFloat(tx.total_earned),
          lastTransactionDate: tx.last_transaction,
          totalTransactions: parseInt(tx.transaction_count),
          isActive: customerData.isActive !== false,
          joinDate: customerData.joinDate,
          importSource: customerData.importSource ?? null,
          isPlaceholder: customerAddress.startsWith('0xmanual')
        });
      });

      // Also group customers assigned to a shop via home_shop_id (e.g. imported/migrated customers
      // that have no transactions yet) so they show under their shop, not as "without shops".
      const homeShopAddrs = new Set<string>();
      const homeShopRows = await db.query(
        `SELECT LOWER(address) AS address, home_shop_id, name, email, tier,
                COALESCE(lifetime_earnings, 0)::float AS lifetime_earnings, is_active, created_at, import_source
           FROM customers WHERE home_shop_id IS NOT NULL`
      );
      homeShopRows.rows.forEach((c: any) => {
        const addr = c.address;
        homeShopAddrs.add(addr);
        const shopId = c.home_shop_id;
        if (!shopCustomerMap.has(shopId)) shopCustomerMap.set(shopId, []);
        const bucket = shopCustomerMap.get(shopId);
        if (bucket.some((x: any) => String(x.address).toLowerCase() === addr)) return; // already via transactions
        bucket.push({
          address: addr,
          name: c.name,
          email: c.email,
          tier: c.tier,
          lifetimeEarnings: parseFloat(c.lifetime_earnings) || 0,
          lastTransactionDate: null,
          totalTransactions: 0,
          isActive: c.is_active !== false,
          joinDate: c.created_at,
          importSource: c.import_source ?? null,
          isPlaceholder: addr.startsWith('0xmanual')
        });
      });

      // Build response with shops and their customers
      const shopsWithCustomers = shops
        .filter(shop => shop.active && shop.verified)
        .map(shop => ({
          shopId: shop.shop_id,
          shopName: shop.name,
          totalCustomers: shopCustomerMap.get(shop.shop_id)?.length || 0,
          customers: shopCustomerMap.get(shop.shop_id) || []
        }))
        .sort((a, b) => b.totalCustomers - a.totalCustomers);

      // Find customers with neither shop transactions NOR a home shop (truly unattached).
      const customersWithoutShops = allCustomers
        .filter(customer => !customersWithTransactions.has(customer.address.toLowerCase())
          && !homeShopAddrs.has(customer.address.toLowerCase()))
        .map(customer => ({
          address: customer.address,
          name: customer.name,
          // include contact so the admin search (name/email) finds imported/wallet-less customers
          email: (customer as any).email,
          first_name: (customer as any).first_name,
          last_name: (customer as any).last_name,
          phone: (customer as any).phone,
          tier: customer.tier,
          lifetimeEarnings: customer.lifetimeEarnings || 0,
          isActive: customer.isActive !== false,
          joinDate: customer.joinDate,
          referralCode: customer.referralCode,
          importSource: (customer as any).importSource ?? null,
          isPlaceholder: String(customer.address).toLowerCase().startsWith('0xmanual')
        }));

      res.json({
        success: true,
        data: {
          totalShops: shopsWithCustomers.length,
          totalCustomersWithShops: customersWithTransactions.size,
          totalCustomersWithoutShops: customersWithoutShops.length,
          totalCustomers: allCustomers.length,
          shopsWithCustomers,
          customersWithoutShops
        }
      });


    } catch (error) {
      logger.error('Error getting grouped customers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get grouped customer data'
      });
    }
  }
);

// Get customers without shop transactions
router.get('/without-shops',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const customerRepo = new CustomerRepository();
      const transactionRepo = new TransactionRepository();

      // Use singleton database service
      const db = DatabaseService.getInstance();

      // Get customers who have never earned from any shop
      const query = `
        SELECT 
          c.wallet_address,
          c.name,
          c.tier,
          c.lifetime_earnings,
          c.is_active,
          c.created_at,
          c.referral_code,
          c.referred_by
        FROM customers c
        WHERE c.home_shop_id IS NULL
          AND NOT EXISTS (
          SELECT 1
          FROM transactions t 
          WHERE t.customer_address = c.wallet_address 
          AND t.type = 'mint'
        )
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const offset = (Number(page) - 1) * Number(limit);
      const result = await db.query(query, [limit, offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM customers c
        WHERE c.home_shop_id IS NULL
          AND NOT EXISTS (
          SELECT 1
          FROM transactions t 
          WHERE t.customer_address = c.wallet_address 
          AND t.type = 'mint'
        )
      `;
      const countResult = await db.query(countQuery);
      const totalItems = parseInt(countResult.rows[0].count);

      const customers = result.rows.map(row => ({
        address: row.wallet_address,
        name: row.name,
        tier: row.tier,
        lifetimeEarnings: parseFloat(row.lifetime_earnings || 0),
        isActive: row.is_active,
        joinDate: row.created_at,
        referralCode: row.referral_code,
        referredBy: row.referred_by
      }));

      res.json({
        success: true,
        data: {
          customers,
          totalItems,
          totalPages: Math.ceil(totalItems / Number(limit)),
          currentPage: Number(page)
        }
      });


    } catch (error) {
      logger.error('Error getting customers without shops:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get customers without shop transactions'
      });
    }
  }
);

export default router;