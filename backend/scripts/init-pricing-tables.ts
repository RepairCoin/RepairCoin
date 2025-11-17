import { getPricingService } from '../src/services/PricingService';
import { logger } from '../src/utils/logger';

async function initializePricingTables() {
  try {
    logger.info('Initializing pricing tables...');

    const pricingService = getPricingService();
    await pricingService.initializePricingTables();

    logger.info('Pricing tables initialized successfully');

    // Verify the data was inserted
    const allPricing = await pricingService.getAllTierPricing();
    logger.info('Current pricing:', allPricing);

    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize pricing tables:', error);
    process.exit(1);
  }
}

initializePricingTables();
