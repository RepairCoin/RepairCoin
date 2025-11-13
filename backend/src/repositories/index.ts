// Export all repositories
export { BaseRepository } from './BaseRepository';
export { CustomerRepository } from './CustomerRepository';
export { ShopRepository } from './ShopRepository';
export { TransactionRepository } from './TransactionRepository';
export { AdminRepository } from './AdminRepository';
export { WebhookRepository } from './WebhookRepository';
export { TreasuryRepository } from './TreasuryRepository';
export { RedemptionSessionRepository } from './RedemptionSessionRepository';
export { ShopSubscriptionRepository } from './ShopSubscriptionRepository';
export { HealthRepository } from './HealthRepository';
export { PromoCodeRepository } from './PromoCodeRepository';
export { RefreshTokenRepository } from './RefreshTokenRepository';

// Create singleton instances
import { CustomerRepository } from './CustomerRepository';
import { ShopRepository } from './ShopRepository';
import { TransactionRepository } from './TransactionRepository';
import { AdminRepository } from './AdminRepository';
import { WebhookRepository } from './WebhookRepository';
import { TreasuryRepository } from './TreasuryRepository';
import { RedemptionSessionRepository } from './RedemptionSessionRepository';
import { ShopSubscriptionRepository } from './ShopSubscriptionRepository';
import { HealthRepository } from './HealthRepository';
import { PromoCodeRepository } from './PromoCodeRepository';
import { RefreshTokenRepository } from './RefreshTokenRepository';

export const customerRepository = new CustomerRepository();
export const shopRepository = new ShopRepository();
export const transactionRepository = new TransactionRepository();
export const adminRepository = new AdminRepository();
export const webhookRepository = new WebhookRepository();
export const treasuryRepository = new TreasuryRepository();
export const redemptionSessionRepository = new RedemptionSessionRepository();
export const shopSubscriptionRepository = new ShopSubscriptionRepository();
export const healthRepository = new HealthRepository();
export const promoCodeRepository = new PromoCodeRepository();
export const refreshTokenRepository = new RefreshTokenRepository();