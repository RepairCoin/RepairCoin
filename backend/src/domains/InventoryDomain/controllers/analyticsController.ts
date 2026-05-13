// backend/src/domains/InventoryDomain/controllers/analyticsController.ts
import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';

const pool = getSharedPool();

/**
 * Get inventory analytics overview
 */
export async function getInventoryAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { period = '30' } = req.query; // days

    const periodDays = parseInt(period as string);

    // Get inventory value and counts
    const inventoryQuery = `
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'available') as available_items,
        COUNT(*) FILTER (WHERE status = 'low_stock') as low_stock_items,
        COUNT(*) FILTER (WHERE status = 'out_of_stock') as out_of_stock_items,
        COALESCE(SUM(price * stock_quantity), 0) as total_inventory_value,
        COALESCE(SUM(cost * stock_quantity), 0) as total_inventory_cost,
        COALESCE(SUM((price - cost) * stock_quantity), 0) as potential_profit
      FROM inventory_items
      WHERE shop_id = $1
        AND deleted_at IS NULL
    `;

    const inventoryResult = await pool.query(inventoryQuery, [shopId]);
    const inventoryStats = inventoryResult.rows[0];

    // Get stock adjustments in period
    const adjustmentsQuery = `
      SELECT
        adjustment_type,
        COUNT(*) as count,
        SUM(ABS(quantity_change)) as total_quantity
      FROM inventory_adjustments
      WHERE shop_id = $1
        AND adjusted_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
      GROUP BY adjustment_type
    `;

    const adjustmentsResult = await pool.query(adjustmentsQuery, [shopId]);

    // Get top items by value
    const topItemsQuery = `
      SELECT
        id,
        name,
        sku,
        price,
        stock_quantity,
        (price * stock_quantity) as total_value
      FROM inventory_items
      WHERE shop_id = $1
        AND deleted_at IS NULL
        AND stock_quantity > 0
      ORDER BY total_value DESC
      LIMIT 10
    `;

    const topItemsResult = await pool.query(topItemsQuery, [shopId]);

    // Get category breakdown
    const categoryQuery = `
      SELECT
        c.name as category_name,
        COUNT(i.id) as item_count,
        SUM(i.stock_quantity) as total_stock,
        SUM(i.price * i.stock_quantity) as category_value
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.shop_id = $1
        AND i.deleted_at IS NULL
      GROUP BY c.name
      ORDER BY category_value DESC
    `;

    const categoryResult = await pool.query(categoryQuery, [shopId]);

    res.json({
      success: true,
      data: {
        overview: {
          totalItems: parseInt(inventoryStats.total_items),
          availableItems: parseInt(inventoryStats.available_items),
          lowStockItems: parseInt(inventoryStats.low_stock_items),
          outOfStockItems: parseInt(inventoryStats.out_of_stock_items),
          totalInventoryValue: parseFloat(inventoryStats.total_inventory_value),
          totalInventoryCost: parseFloat(inventoryStats.total_inventory_cost),
          potentialProfit: parseFloat(inventoryStats.potential_profit),
          profitMargin: inventoryStats.total_inventory_value > 0
            ? ((parseFloat(inventoryStats.potential_profit) / parseFloat(inventoryStats.total_inventory_value)) * 100).toFixed(2)
            : '0.00'
        },
        adjustments: adjustmentsResult.rows.map(row => ({
          type: row.adjustment_type,
          count: parseInt(row.count),
          totalQuantity: parseInt(row.total_quantity)
        })),
        topItems: topItemsResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          sku: row.sku,
          price: parseFloat(row.price),
          stockQuantity: parseInt(row.stock_quantity),
          totalValue: parseFloat(row.total_value)
        })),
        categories: categoryResult.rows.map(row => ({
          name: row.category_name || 'Uncategorized',
          itemCount: parseInt(row.item_count),
          totalStock: parseInt(row.total_stock),
          value: parseFloat(row.category_value)
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching inventory analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory analytics'
    });
  }
}

/**
 * Get inventory turnover analysis
 */
export async function getInventoryTurnover(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { period = '90' } = req.query; // days

    const periodDays = parseInt(period as string);

    // Calculate turnover based on stock adjustments
    const query = `
      WITH item_movements AS (
        SELECT
          i.id,
          i.name,
          i.sku,
          i.stock_quantity as current_stock,
          i.cost,
          COUNT(a.id) FILTER (WHERE a.adjustment_type IN ('sale', 'manual') AND a.quantity_change < 0) as sales_count,
          ABS(SUM(a.quantity_change) FILTER (WHERE a.adjustment_type IN ('sale', 'manual') AND a.quantity_change < 0)) as units_sold,
          AVG(i.stock_quantity) as avg_stock
        FROM inventory_items i
        LEFT JOIN inventory_adjustments a ON i.id = a.item_id
          AND a.adjusted_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        WHERE i.shop_id = $1
          AND i.deleted_at IS NULL
        GROUP BY i.id, i.name, i.sku, i.stock_quantity, i.cost
      )
      SELECT
        id,
        name,
        sku,
        current_stock,
        COALESCE(sales_count, 0) as sales_count,
        COALESCE(units_sold, 0) as units_sold,
        COALESCE(avg_stock, 0) as avg_stock,
        CASE
          WHEN COALESCE(avg_stock, 0) > 0
          THEN ROUND((COALESCE(units_sold, 0) / NULLIF(avg_stock, 0))::numeric, 2)
          ELSE 0
        END as turnover_ratio,
        CASE
          WHEN COALESCE(units_sold, 0) > 0
          THEN ROUND((${periodDays}::numeric / NULLIF(units_sold, 0))::numeric, 2)
          ELSE NULL
        END as days_to_sell
      FROM item_movements
      ORDER BY turnover_ratio DESC NULLS LAST
      LIMIT 50
    `;

    const result = await pool.query(query, [shopId]);

    const items = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      currentStock: parseInt(row.current_stock),
      salesCount: parseInt(row.sales_count),
      unitsSold: parseInt(row.units_sold),
      avgStock: parseFloat(row.avg_stock),
      turnoverRatio: parseFloat(row.turnover_ratio),
      daysToSell: row.days_to_sell ? parseFloat(row.days_to_sell) : null,
      performance: row.turnover_ratio > 2 ? 'fast' : row.turnover_ratio > 1 ? 'moderate' : 'slow'
    }));

    const summary = {
      fastMoving: items.filter(i => i.performance === 'fast').length,
      moderateMoving: items.filter(i => i.performance === 'moderate').length,
      slowMoving: items.filter(i => i.performance === 'slow').length,
      totalItems: items.length
    };

    res.json({
      success: true,
      data: {
        summary,
        items,
        period: {
          days: periodDays,
          startDate: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching inventory turnover:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory turnover'
    });
  }
}

/**
 * Get profit margin analysis
 */
export async function getProfitMargins(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    const query = `
      SELECT
        i.id,
        i.name,
        i.sku,
        i.price,
        i.cost,
        i.stock_quantity,
        (i.price - i.cost) as unit_profit,
        CASE
          WHEN i.cost > 0 THEN ROUND(((i.price - i.cost) / i.cost * 100)::numeric, 2)
          ELSE 0
        END as profit_margin_percent,
        (i.price - i.cost) * i.stock_quantity as total_potential_profit,
        c.name as category_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.shop_id = $1
        AND i.deleted_at IS NULL
        AND i.cost > 0
      ORDER BY profit_margin_percent DESC
    `;

    const result = await pool.query(query, [shopId]);

    const items = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      price: parseFloat(row.price),
      cost: parseFloat(row.cost),
      stockQuantity: parseInt(row.stock_quantity),
      unitProfit: parseFloat(row.unit_profit),
      profitMarginPercent: parseFloat(row.profit_margin_percent),
      totalPotentialProfit: parseFloat(row.total_potential_profit),
      categoryName: row.category_name || 'Uncategorized',
      marginTier: row.profit_margin_percent >= 50 ? 'high' : row.profit_margin_percent >= 25 ? 'medium' : 'low'
    }));

    const summary = {
      highMargin: items.filter(i => i.marginTier === 'high').length,
      mediumMargin: items.filter(i => i.marginTier === 'medium').length,
      lowMargin: items.filter(i => i.marginTier === 'low').length,
      avgMargin: items.length > 0
        ? (items.reduce((sum, i) => sum + i.profitMarginPercent, 0) / items.length).toFixed(2)
        : '0.00',
      totalPotentialProfit: items.reduce((sum, i) => sum + i.totalPotentialProfit, 0).toFixed(2)
    };

    res.json({
      success: true,
      data: {
        summary,
        items
      }
    });
  } catch (error) {
    logger.error('Error fetching profit margins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profit margins'
    });
  }
}

/**
 * Get stock level trends
 */
export async function getStockTrends(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { period = '30' } = req.query; // days

    const periodDays = parseInt(period as string);

    // Get daily stock snapshots from adjustments
    const query = `
      WITH daily_changes AS (
        SELECT
          DATE(adjusted_at) as date,
          SUM(quantity_change) FILTER (WHERE adjustment_type IN ('restock', 'return', 'manual') AND quantity_change > 0) as added,
          ABS(SUM(quantity_change) FILTER (WHERE adjustment_type IN ('sale', 'damage', 'manual') AND quantity_change < 0)) as removed,
          SUM(quantity_change) as net_change
        FROM inventory_adjustments
        WHERE shop_id = $1
          AND adjusted_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        GROUP BY DATE(adjusted_at)
        ORDER BY DATE(adjusted_at)
      ),
      date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${periodDays} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      )
      SELECT
        ds.date,
        COALESCE(dc.added, 0) as added,
        COALESCE(dc.removed, 0) as removed,
        COALESCE(dc.net_change, 0) as net_change
      FROM date_series ds
      LEFT JOIN daily_changes dc ON ds.date = dc.date
      ORDER BY ds.date
    `;

    const result = await pool.query(query, [shopId]);

    const trends = result.rows.map(row => ({
      date: row.date,
      added: parseInt(row.added),
      removed: parseInt(row.removed),
      netChange: parseInt(row.net_change)
    }));

    const summary = {
      totalAdded: trends.reduce((sum, t) => sum + t.added, 0),
      totalRemoved: trends.reduce((sum, t) => sum + t.removed, 0),
      netChange: trends.reduce((sum, t) => sum + t.netChange, 0),
      avgDailyChange: trends.length > 0
        ? (trends.reduce((sum, t) => sum + t.netChange, 0) / trends.length).toFixed(2)
        : '0.00'
    };

    res.json({
      success: true,
      data: {
        summary,
        trends,
        period: {
          days: periodDays,
          startDate: trends[0]?.date || null,
          endDate: trends[trends.length - 1]?.date || null
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching stock trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock trends'
    });
  }
}

/**
 * Get low stock forecast
 */
export async function getLowStockForecast(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { days = '7' } = req.query; // forecast days ahead

    const forecastDays = parseInt(days as string);

    // Calculate average daily usage and forecast stock out date
    const query = `
      WITH item_usage AS (
        SELECT
          i.id,
          i.name,
          i.sku,
          i.stock_quantity,
          i.low_stock_threshold,
          COUNT(a.id) FILTER (WHERE a.quantity_change < 0) as depletion_events,
          ABS(AVG(a.quantity_change) FILTER (WHERE a.quantity_change < 0)) as avg_depletion,
          MAX(a.adjusted_at) as last_depletion
        FROM inventory_items i
        LEFT JOIN inventory_adjustments a ON i.id = a.item_id
          AND a.adjusted_at >= CURRENT_DATE - INTERVAL '30 days'
          AND a.quantity_change < 0
        WHERE i.shop_id = $1
          AND i.deleted_at IS NULL
          AND i.stock_quantity > 0
        GROUP BY i.id, i.name, i.sku, i.stock_quantity, i.low_stock_threshold
      )
      SELECT
        id,
        name,
        sku,
        stock_quantity,
        low_stock_threshold,
        depletion_events,
        COALESCE(avg_depletion, 0) as avg_daily_usage,
        CASE
          WHEN COALESCE(avg_depletion, 0) > 0
          THEN ROUND((stock_quantity / avg_depletion)::numeric, 1)
          ELSE NULL
        END as days_until_out,
        CASE
          WHEN COALESCE(avg_depletion, 0) > 0 AND (stock_quantity / avg_depletion) <= ${forecastDays}
          THEN TRUE
          ELSE FALSE
        END as will_be_low_soon
      FROM item_usage
      WHERE COALESCE(avg_depletion, 0) > 0
      ORDER BY days_until_out NULLS LAST
      LIMIT 50
    `;

    const result = await pool.query(query, [shopId]);

    const items = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      currentStock: parseInt(row.stock_quantity),
      lowStockThreshold: parseInt(row.low_stock_threshold),
      depletionEvents: parseInt(row.depletion_events),
      avgDailyUsage: parseFloat(row.avg_daily_usage),
      daysUntilOut: row.days_until_out ? parseFloat(row.days_until_out) : null,
      willBeLowSoon: row.will_be_low_soon,
      urgency: row.days_until_out <= 3 ? 'critical' : row.days_until_out <= 7 ? 'high' : 'moderate'
    }));

    const summary = {
      criticalItems: items.filter(i => i.urgency === 'critical').length,
      highUrgencyItems: items.filter(i => i.urgency === 'high').length,
      moderateUrgencyItems: items.filter(i => i.urgency === 'moderate').length,
      forecastDays
    };

    res.json({
      success: true,
      data: {
        summary,
        items
      }
    });
  } catch (error) {
    logger.error('Error fetching low stock forecast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock forecast'
    });
  }
}
