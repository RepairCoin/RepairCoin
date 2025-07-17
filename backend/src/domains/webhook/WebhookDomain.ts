import { DomainModule } from '../types';
import { eventBus, createDomainEvent } from '../../events/EventBus';
import { logger } from '../../utils/logger';
import webhookRoutes from './routes/webhooks'; // Use your existing route
import { WebhookService } from './services/WebhookService';

export class WebhookDomain implements DomainModule {
  name = 'webhooks';
  routes = webhookRoutes; // Use your existing webhook route
  private webhookService!: WebhookService;

  async initialize(): Promise<void> {
    this.webhookService = new WebhookService();
    // Webhooks don't typically subscribe to events, they publish them
    logger.info('Webhook domain initialized');
  }

  // Enhanced webhook processing that publishes events
  async processWebhookEvent(event: string, data: any): Promise<void> {
    try {
      // Publish webhook event for other domains to handle
      await eventBus.publish(createDomainEvent(
        `webhook.${event}`,
        data.customer_wallet_address || data.referrer_wallet_address || 'unknown',
        data,
        'WebhookDomain'
      ));

      logger.info(`Webhook event published: webhook.${event}`);
    } catch (error) {
      logger.error('Failed to publish webhook event:', error);
      throw error;
    }
  }
}