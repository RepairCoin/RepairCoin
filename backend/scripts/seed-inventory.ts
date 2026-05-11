/**
 * Seed Inventory Data Script
 * Seeds sample inventory items, categories, and vendors for testing
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface InventoryCategory {
  name: string;
  description: string;
}

interface InventoryVendor {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
}

interface InventoryItem {
  name: string;
  description: string;
  sku: string;
  barcode?: string;
  categoryName: string;
  vendorName: string;
  price: number;
  cost: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  images?: string[];
  notes?: string;
}

const categories: InventoryCategory[] = [
  { name: 'Electronics', description: 'Electronic devices and components' },
  { name: 'Tools', description: 'Repair tools and equipment' },
  { name: 'Parts', description: 'Replacement parts and components' },
  { name: 'Accessories', description: 'Device accessories and add-ons' },
  { name: 'Consumables', description: 'Consumable repair materials' },
];

const vendors: InventoryVendor[] = [
  {
    name: 'Tech Supplies Inc',
    contactName: 'John Smith',
    email: 'john@techsupplies.com',
    phone: '555-0101',
    address: '123 Tech Street, Silicon Valley, CA 94025',
  },
  {
    name: 'Parts Warehouse',
    contactName: 'Jane Doe',
    email: 'jane@partswarehouse.com',
    phone: '555-0102',
    address: '456 Parts Ave, Austin, TX 78701',
  },
  {
    name: 'Repair Pro Distributors',
    contactName: 'Mike Johnson',
    email: 'mike@repairpro.com',
    phone: '555-0103',
    address: '789 Repair Blvd, New York, NY 10001',
  },
];

const items: InventoryItem[] = [
  // Electronics
  {
    name: 'iPhone 13 LCD Screen',
    description: 'High-quality replacement LCD screen for iPhone 13',
    sku: 'IP13-LCD-001',
    barcode: '1234567890123',
    categoryName: 'Parts',
    vendorName: 'Tech Supplies Inc',
    price: 89.99,
    cost: 45.00,
    stockQuantity: 25,
    lowStockThreshold: 10,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1592286927505-34bce1c0ca74?w=400&h=400&fit=crop'],
    notes: 'Premium quality, includes installation kit',
  },
  {
    name: 'Samsung Galaxy S21 Battery',
    description: 'Original capacity battery for Galaxy S21',
    sku: 'SGS21-BAT-001',
    barcode: '1234567890124',
    categoryName: 'Parts',
    vendorName: 'Parts Warehouse',
    price: 29.99,
    cost: 15.00,
    stockQuantity: 50,
    lowStockThreshold: 20,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop'],
    notes: 'High capacity 4000mAh',
  },
  // Tools
  {
    name: 'Precision Screwdriver Set',
    description: '32-piece precision screwdriver set for electronics',
    sku: 'TOOL-SD-032',
    barcode: '1234567890125',
    categoryName: 'Tools',
    vendorName: 'Repair Pro Distributors',
    price: 24.99,
    cost: 12.00,
    stockQuantity: 15,
    lowStockThreshold: 5,
    unit: 'set',
    images: ['https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=400&fit=crop'],
    notes: 'Includes magnetic bits and case',
  },
  {
    name: 'Heat Gun 1800W',
    description: 'Professional heat gun for phone repairs',
    sku: 'TOOL-HG-1800',
    barcode: '1234567890126',
    categoryName: 'Tools',
    vendorName: 'Repair Pro Distributors',
    price: 45.99,
    cost: 25.00,
    stockQuantity: 8,
    lowStockThreshold: 3,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop'],
    notes: 'Variable temperature control',
  },
  // Consumables
  {
    name: 'B-7000 Adhesive Glue',
    description: 'Industrial strength adhesive for screen repairs',
    sku: 'CONS-GLUE-B7K',
    barcode: '1234567890127',
    categoryName: 'Consumables',
    vendorName: 'Tech Supplies Inc',
    price: 8.99,
    cost: 3.50,
    stockQuantity: 100,
    lowStockThreshold: 30,
    unit: 'tube',
    images: ['https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=400&h=400&fit=crop'],
    notes: '110ml tube, clear drying',
  },
  {
    name: 'Isopropyl Alcohol 99%',
    description: 'Electronic grade cleaning alcohol',
    sku: 'CONS-IPA-99',
    barcode: '1234567890128',
    categoryName: 'Consumables',
    vendorName: 'Parts Warehouse',
    price: 12.99,
    cost: 6.00,
    stockQuantity: 3,
    lowStockThreshold: 10,
    unit: 'bottle',
    images: ['https://images.unsplash.com/photo-1585559700398-1385b3a8aeb6?w=400&h=400&fit=crop'],
    notes: '500ml bottle - LOW STOCK!',
  },
  // Accessories
  {
    name: 'USB-C Cable 6ft',
    description: 'Fast charging USB-C to USB-C cable',
    sku: 'ACC-USBC-6FT',
    barcode: '1234567890129',
    categoryName: 'Accessories',
    vendorName: 'Tech Supplies Inc',
    price: 14.99,
    cost: 7.00,
    stockQuantity: 45,
    lowStockThreshold: 15,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop'],
    notes: 'Braided nylon, 100W PD support',
  },
  {
    name: 'Wireless Charger Pad',
    description: '15W Qi wireless charging pad',
    sku: 'ACC-QIPAD-15W',
    barcode: '1234567890130',
    categoryName: 'Accessories',
    vendorName: 'Parts Warehouse',
    price: 19.99,
    cost: 10.00,
    stockQuantity: 20,
    lowStockThreshold: 8,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1591290619762-d118f7bb50b2?w=400&h=400&fit=crop'],
    notes: 'Compatible with all Qi devices',
  },
  // More Parts
  {
    name: 'iPhone 12 Charging Port',
    description: 'Replacement lightning charging port flex cable',
    sku: 'IP12-CHG-001',
    barcode: '1234567890131',
    categoryName: 'Parts',
    vendorName: 'Tech Supplies Inc',
    price: 15.99,
    cost: 8.00,
    stockQuantity: 0,
    lowStockThreshold: 5,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=400&h=400&fit=crop'],
    notes: 'OUT OF STOCK - Reorder needed!',
  },
  {
    name: 'MacBook Pro M1 SSD 256GB',
    description: 'Replacement SSD for MacBook Pro M1',
    sku: 'MBP-M1-SSD256',
    barcode: '1234567890132',
    categoryName: 'Parts',
    vendorName: 'Repair Pro Distributors',
    price: 129.99,
    cost: 75.00,
    stockQuantity: 12,
    lowStockThreshold: 5,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&fit=crop'],
    notes: 'Original Apple part',
  },
  // Additional tools
  {
    name: 'ESD Anti-Static Mat',
    description: 'Professional ESD-safe work surface',
    sku: 'TOOL-ESD-MAT',
    barcode: '1234567890133',
    categoryName: 'Tools',
    vendorName: 'Repair Pro Distributors',
    price: 34.99,
    cost: 18.00,
    stockQuantity: 6,
    lowStockThreshold: 2,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=400&fit=crop'],
    notes: '24x18 inch, with grounding cord',
  },
  {
    name: 'Digital Multimeter',
    description: 'Professional digital multimeter for diagnostics',
    sku: 'TOOL-DMULT-PRO',
    barcode: '1234567890134',
    categoryName: 'Tools',
    vendorName: 'Parts Warehouse',
    price: 39.99,
    cost: 22.00,
    stockQuantity: 10,
    lowStockThreshold: 4,
    unit: 'piece',
    images: ['https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=400&fit=crop'],
    notes: 'Auto-ranging, with continuity tester',
  },
];

async function seedInventory(shopWalletAddress: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get or create shop
    let shopResult = await client.query(
      'SELECT shop_id FROM shops WHERE wallet_address = $1',
      [shopWalletAddress.toLowerCase()]
    );

    let shopId: string;

    if (shopResult.rows.length === 0) {
      console.log(`\n⚠️  Shop not found, creating test shop for wallet: ${shopWalletAddress}`);

      // Create a test shop
      const createResult = await client.query(
        `INSERT INTO shops (
          shop_id, wallet_address, name, address, phone, email,
          verified, active, cross_shop_enabled,
          total_tokens_issued, total_redemptions, total_reimbursements,
          join_date, last_activity
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING shop_id`,
        [
          `shop-test-${Date.now()}`,
          shopWalletAddress.toLowerCase(),
          'Test Repair Shop',
          '123 Test Street, Test City, TC 12345',
          '555-TEST-123',
          'test@repairshop.com',
          true, // verified
          true, // active
          true, // cross_shop_enabled
          0, // total_tokens_issued
          0, // total_redemptions
          0, // total_reimbursements
        ]
      );

      shopId = createResult.rows[0].shop_id;
      console.log(`  ✓ Created shop ID: ${shopId}`);
    } else {
      shopId = shopResult.rows[0].shop_id;
      console.log(`\n✓ Found shop ID: ${shopId}`);
    }

    // Clear existing data
    console.log('\nClearing existing inventory data...');
    await client.query('DELETE FROM inventory_adjustments WHERE item_id IN (SELECT id FROM inventory_items WHERE shop_id = $1)', [shopId]);
    await client.query('DELETE FROM inventory_items WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM inventory_vendors WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM inventory_categories WHERE shop_id = $1', [shopId]);
    console.log('✓ Cleared existing data');

    // Insert categories
    console.log('\nSeeding categories...');
    const categoryMap = new Map<string, string>();
    for (const category of categories) {
      const result = await client.query(
        `INSERT INTO inventory_categories (shop_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [shopId, category.name, category.description]
      );
      categoryMap.set(category.name, result.rows[0].id);
      console.log(`  ✓ Created category: ${category.name}`);
    }

    // Insert vendors
    console.log('\nSeeding vendors...');
    const vendorMap = new Map<string, string>();
    for (const vendor of vendors) {
      const result = await client.query(
        `INSERT INTO inventory_vendors (shop_id, name, contact_name, email, phone, address, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        [shopId, vendor.name, vendor.contactName, vendor.email, vendor.phone, vendor.address]
      );
      vendorMap.set(vendor.name, result.rows[0].id);
      console.log(`  ✓ Created vendor: ${vendor.name}`);
    }

    // Insert inventory items
    console.log('\nSeeding inventory items...');
    for (const item of items) {
      const categoryId = categoryMap.get(item.categoryName);
      const vendorId = vendorMap.get(item.vendorName);

      if (!categoryId || !vendorId) {
        console.warn(`  ⚠ Skipping ${item.name}: Missing category or vendor`);
        continue;
      }

      const metadata = item.notes ? { notes: item.notes } : {};

      await client.query(
        `INSERT INTO inventory_items (
          shop_id, category_id, vendor_id, name, description, sku, barcode,
          price, cost, stock_quantity, reserved_quantity, low_stock_threshold,
          status, images, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        [
          shopId,
          categoryId,
          vendorId,
          item.name,
          item.description,
          item.sku,
          item.barcode || null,
          item.price,
          item.cost,
          item.stockQuantity,
          0, // reserved_quantity
          item.lowStockThreshold,
          item.stockQuantity === 0 ? 'out_of_stock' : item.stockQuantity <= item.lowStockThreshold ? 'low_stock' : 'available',
          item.images ? JSON.stringify(item.images) : '[]',
          JSON.stringify(metadata),
        ]
      );

      const status = item.stockQuantity === 0 ? '📦 OUT OF STOCK' :
                     item.stockQuantity <= item.lowStockThreshold ? '⚠️  LOW STOCK' :
                     '✓';
      console.log(`  ${status} ${item.name} (${item.stockQuantity} ${item.unit}s)`);
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log('✅ INVENTORY SEEDING COMPLETE!');
    console.log('='.repeat(60));

    const totalValue = items.reduce((sum, item) => sum + (item.price * item.stockQuantity), 0);
    const lowStockCount = items.filter(i => i.stockQuantity <= i.lowStockThreshold && i.stockQuantity > 0).length;
    const outOfStockCount = items.filter(i => i.stockQuantity === 0).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Vendors: ${vendors.length}`);
    console.log(`   Items: ${items.length}`);
    console.log(`   Total Value: $${totalValue.toFixed(2)}`);
    console.log(`   Low Stock Items: ${lowStockCount}`);
    console.log(`   Out of Stock: ${outOfStockCount}`);
    console.log('');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding inventory:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
const shopWalletAddress = process.argv[2];

if (!shopWalletAddress) {
  console.error('Usage: npm run seed:inventory <shop-wallet-address>');
  process.exit(1);
}

seedInventory(shopWalletAddress)
  .then(() => {
    console.log('✓ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
