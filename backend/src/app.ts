// backend/src/app.ts - Updated with all domains including Admin
import dotenv from 'dotenv';

// Load environment variables FIRST - look in root directory
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Config } from './config';
import { logger } from './utils/logger';
import { setupSwagger } from './docs/swagger';

// Domain imports
import { domainRegistry } from './domains/DomainRegistry';
import { CustomerDomain } from './domains/customer/CustomerDomain';
import { TokenDomain } from './domains/token/TokenDomain';
import { WebhookDomain } from './domains/webhook/WebhookDomain';
import { ShopDomain } from './domains/shop/ShopDomain';
import { AdminDomain } from './domains/admin/AdminDomain'; 
import { eventBus } from './events/EventBus';

// Your existing route imports (for non-domain routes)
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';

// Middleware imports
import { metricsMiddleware } from './utils/metrics';
import { generalCache } from './utils/cache';
import { requestIdMiddleware } from './middleware/errorHandler';

class RepairCoinApp {
  public app = express();

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      Config.validate();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup domains
      await this.setupDomains();
      logger.info('🏗️  Enhanced domain architecture enabled');
      
      // Setup documentation (before routes to avoid 404 handler)
      this.setupDocumentation();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('RepairCoin application initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add request ID middleware
    this.app.use(requestIdMiddleware);
    
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: { write: (message) => logger.info(message.trim()) }
      }));
    }
    
    // Add metrics if available
    if (metricsMiddleware) {
      this.app.use(metricsMiddleware);
    }
  }

  private async setupDomains(): Promise<void> {
    // Register all domains including Admin
    domainRegistry.register(new CustomerDomain());
    domainRegistry.register(new TokenDomain());
    domainRegistry.register(new WebhookDomain());
    domainRegistry.register(new ShopDomain());
    domainRegistry.register(new AdminDomain()); // ✅ NEW: Register AdminDomain

    // Initialize all domains (sets up event subscriptions)
    await domainRegistry.initializeAll();
    
    logger.info('Domain setup completed', {
      domains: domainRegistry.getAllDomains().map(d => d.name)
    });
  }

  private setupRoutes(): void {
    // Health check (always first)
    this.app.use('/api/health', healthRoutes);
    
    // Domain routes
    const routes = domainRegistry.getRoutes();
    Object.entries(routes).forEach(([path, router]) => {
      this.app.use(`/api${path}`, router);
      logger.info(`Domain route registered: /api${path}`);
    });
    
    // System routes
    this.app.get('/api/events/history', (req, res) => {
      const eventType = req.query.type as string;
      const history = eventBus.getEventHistory(eventType);
      res.json({
        success: true,
        data: {
          events: history.slice(-100), // Last 100 events
          count: history.length,
          subscriptions: eventBus.getSubscriptions()
        }
      });
    });

    this.app.get('/api/system/info', (req, res) => {
      res.json({
        success: true,
        data: {
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV,
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          domains: domainRegistry.getAllDomains().map(d => d.name),
          cache: generalCache?.getStats?.() || null,
          eventSubscriptions: eventBus.getSubscriptions(),
          architecture: 'enhanced-domains'
        }
      });
    });

    // Metrics route (if available)
    if (metricsRoutes) {
      this.app.use('/api/metrics', metricsRoutes);
    }
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  private setupDocumentation(): void {
    try {
      logger.info('Setting up Swagger documentation...');
      setupSwagger(this.app);
      logger.info('📚 API documentation setup completed');
    } catch (error) {
      logger.error('Failed to setup API documentation:', error);
    }
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Global error handler:', error);
      
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
    
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => this.gracefulShutdown();
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');
    
    try {
      // Enhanced shutdown
      await domainRegistry.cleanup();
      eventBus.clear();
      
      // Common cleanup
      if (generalCache?.destroy) {
        generalCache.destroy();
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  start(): void {
    const port = parseInt(process.env.PORT || '3000');
    
    this.app.listen(port, () => {
      logger.info(`🚀 RepairCoin API running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/api/health`);
      logger.info(`📚 API docs: http://localhost:${port}/api-docs`);
      logger.info(`🔧 System info: http://localhost:${port}/api/system/info`);
      logger.info(`📈 Events: http://localhost:${port}/api/events/history`);
      logger.info(`🏛️  Domains: ${domainRegistry.getAllDomains().map(d => d.name).join(', ')}`);
      logger.info(`🏗️  Architecture: Enhanced Domains`);
    });
  }
}

// Main execution
async function main() {
  try {
    const app = new RepairCoinApp();
    await app.initialize();
    app.start();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

export default RepairCoinApp;