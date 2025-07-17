import { DomainEvent } from '../domains/types';
import { logger } from '../utils/logger';

type EventHandler = (event: DomainEvent) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private eventHistory: DomainEvent[] = [];
  private maxHistorySize = 1000;

  subscribe(eventType: string, handler: EventHandler, subscriber?: string): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    this.handlers.get(eventType)!.push(handler);
    
    logger.info(`Event subscription added`, {
      eventType,
      subscriber: subscriber || 'anonymous',
      totalHandlers: this.handlers.get(eventType)!.length
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    const handlers = this.handlers.get(event.type) || [];
    
    logger.info(`Publishing event: ${event.type}`, {
      eventType: event.type,
      aggregateId: event.aggregateId,
      handlerCount: handlers.length,
      source: event.source
    });

    if (handlers.length === 0) {
      logger.warn(`No handlers found for event: ${event.type}`);
      return;
    }

    // Execute handlers in parallel but handle errors gracefully
    const results = await Promise.allSettled(
      handlers.map(async (handler, index) => {
        try {
          await handler(event);
          logger.debug(`Event handler ${index} completed for ${event.type}`);
        } catch (error) {
          logger.error(`Event handler ${index} failed for ${event.type}:`, error);
          throw error;
        }
      })
    );

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    if (failures > 0) {
      logger.error(`Event processing completed with errors`, {
        eventType: event.type,
        successes,
        failures,
        totalHandlers: handlers.length
      });
    } else {
      logger.info(`Event processing completed successfully`, {
        eventType: event.type,
        handlerCount: handlers.length
      });
    }
  }

  getEventHistory(eventType?: string): DomainEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  getSubscriptions(): { [eventType: string]: number } {
    const subscriptions: { [eventType: string]: number } = {};
    for (const [eventType, handlers] of this.handlers) {
      subscriptions[eventType] = handlers.length;
    }
    return subscriptions;
  }

  clear(): void {
    this.handlers.clear();
    this.eventHistory = [];
    logger.info('EventBus cleared');
  }
}

export const eventBus = new EventBus();

// Helper function to create events
export function createDomainEvent(
  type: string,
  aggregateId: string,
  data: any,
  source: string
): DomainEvent {
  return {
    type,
    aggregateId,
    data,
    timestamp: new Date(),
    source,
    version: 1
  };
}