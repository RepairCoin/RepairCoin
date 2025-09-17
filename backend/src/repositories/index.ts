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

// Create singleton instances
import { CustomerRepository } from './CustomerRepository';
import { ShopRepository } from './ShopRepository';
import { TransactionRepository } from './TransactionRepository';
import { AdminRepository } from './AdminRepository';
import { WebhookRepository } from './WebhookRepository';
import { TreasuryRepository } from './TreasuryRepository';
import { RedemptionSessionRepository } from './RedemptionSessionRepository';
import { ShopSubscriptionRepository } from './ShopSubscriptionRepository';

export const customerRepository = new CustomerRepository();
export const shopRepository = new ShopRepository();
export const transactionRepository = new TransactionRepository();
export const adminRepository = new AdminRepository();
export const webhookRepository = new WebhookRepository();
export const treasuryRepository = new TreasuryRepository();
export const redemptionSessionRepository = new RedemptionSessionRepository();
export const shopSubscriptionRepository = new ShopSubscriptionRepository();