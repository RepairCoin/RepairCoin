import { DomainModule } from './types';
import { logger } from '../utils/logger';

class DomainRegistry {
  private domains = new Map<string, DomainModule>();

  register(domain: DomainModule): void {
    this.domains.set(domain.name, domain);
    logger.info(`Domain registered: ${domain.name}`);
  }

  async initializeAll(): Promise<void> {
    logger.info('Initializing all domains...');
    
    for (const [name, domain] of this.domains) {
      try {
        await domain.initialize();
        logger.info(`✅ Domain initialized: ${name}`);
      } catch (error) {
        logger.error(`❌ Failed to initialize domain ${name}:`, error);
        throw error;
      }
    }
  }

  getRoutes(): { [path: string]: any } {
    const routes: { [path: string]: any } = {};
    for (const [name, domain] of this.domains) {
      routes[`/${name}`] = domain.routes;
    }
    return routes;
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up domains...');
    
    for (const [name, domain] of this.domains) {
      if (domain.cleanup) {
        try {
          await domain.cleanup();
          logger.info(`✅ Domain cleaned up: ${name}`);
        } catch (error) {
          logger.error(`❌ Failed to cleanup domain ${name}:`, error);
        }
      }
    }
  }

  getDomain(name: string): DomainModule | undefined {
    return this.domains.get(name);
  }

  getAllDomains(): DomainModule[] {
    return Array.from(this.domains.values());
  }
}

export const domainRegistry = new DomainRegistry();