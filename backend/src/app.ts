// backend/src/app.ts - Updated with all domains including Admin
// Deploy trigger: Added uuid dependency
import dotenv from 'dotenv';

// Load environment variables FIRST - look in backend directory
import path from 'path';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Config } from './config';
import { logger } from './utils/logger';
import { setupSwagger } from './docs/swagger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Domain imports
import { domainRegistry } from './domains/DomainRegistry';
import { CustomerDomain } from './domains/customer/CustomerDomain';
import { TokenDomain } from './domains/token/TokenDomain';
import { WebhookDomain } from './domains/webhook/WebhookDomain';
import { ShopDomain } from './domains/shop/ShopDomain';
import { AdminDomain } from './domains/admin/AdminDomain'; 
import { eventBus } from './events/EventBus';
import { monitoringService } from './services/MonitoringService';

// Your existing route imports (for non-domain routes)
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import authRoutes from './routes/auth';
import referralRoutes from './routes/referral';
import setupRoutes from './routes/setup';

// Middleware imports
import { metricsMiddleware } from './utils/metrics';
import { generalCache } from './utils/cache';
import { requestIdMiddleware } from './middleware/errorHandler';
import { errorTrackingMiddleware, getErrorSummary, clearErrorMetrics, monitorErrors } from './middleware/errorTracking';

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
    // CORS must come before helmet to handle preflight requests properly
    this.app.use(cors({
      origin: function(origin, callback) {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:3002',
          'http://localhost:3003',
          'https://repaircoin.ai',
          'https://www.repaircoin.ai',
          process.env.FRONTEND_URL
        ].filter(Boolean);
        
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // In production, only allow specified origins
          if (process.env.NODE_ENV === 'production') {
            callback(new Error('Not allowed by CORS'));
          } else {
            callback(null, true); // Allow all origins in development
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      preflightContinue: false,
      optionsSuccessStatus: 204
    }));
    
    // Helmet with adjusted settings for CORS compatibility
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add request ID middleware
    this.app.use(requestIdMiddleware);
    
    // Add request timeout middleware (30 seconds)
    this.app.use((req, res, next) => {
      // Set timeout for all requests
      req.setTimeout(30000, () => {
        logger.error('Request timeout', {
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      });
      next();
    });
    
    // Manual OPTIONS handler as fallback
    this.app.options('*', (req, res) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.sendStatus(204);
    });
    
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined', {
        stream: { write: (message) => logger.info(message.trim()) }
      }));
    }
    
    // Add metrics if available
    if (metricsMiddleware) {
      this.app.use(metricsMiddleware);
    }
    
    // Add error tracking middleware
    this.app.use(errorTrackingMiddleware);
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
    
    // Setup routes (TEMPORARY - REMOVE AFTER USE)
    this.app.use('/api/setup', setupRoutes);
    
    // Authentication routes
    this.app.use('/api/auth', authRoutes);
    
    // Referral routes
    this.app.use('/api/referrals', referralRoutes);
    
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
    
    // Error tracking routes
    this.app.get('/api/errors/summary', getErrorSummary);
    this.app.delete('/api/errors/clear', clearErrorMetrics);

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
    // 404 handler should be before error handler
    this.app.use(notFoundHandler);
    
    // Use the comprehensive error handler from errorHandler.ts
    this.app.use(errorHandler);
    
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
      monitoringService.stopMonitoring();
      
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
    const port = parseInt(process.env.PORT || '5000');
    
    console.log('\n🔍 BACKEND PORT CONFIGURATION:');
    console.log(`- process.env.PORT from .env: ${process.env.PORT}`);
    console.log(`- Default if not set: 5000`);
    console.log(`- Actually using port: ${port}`);
    console.log(`- Full backend URL: http://localhost:${port}`);
    console.log('');
    
    this.app.listen(port, () => {
      logger.info(`🚀 RepairCoin API running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/api/health`);
      logger.info(`📚 API docs: http://localhost:${port}/api-docs`);
      logger.info(`🔧 System info: http://localhost:${port}/api/system/info`);
      logger.info(`📈 Events: http://localhost:${port}/api/events/history`);
      logger.info(`🏛️  Domains: ${domainRegistry.getAllDomains().map(d => d.name).join(', ')}`);
      logger.info(`🏗️  Architecture: Enhanced Domains`);
      
      // Start monitoring service
      monitoringService.startMonitoring(30); // Run checks every 30 minutes
      
      // Start subscription automated workflows
      import('./services/SubscriptionService').then(({ subscriptionService }) => {
        subscriptionService.startAutomatedWorkflows();
        logger.info('💳 Subscription automated workflows started');
      }).catch(error => {
        logger.error('Failed to start subscription workflows:', error);
      });
      logger.info(`🔍 Monitoring service started`);
      
      // Start error monitoring
      monitorErrors();
      logger.info(`🚨 Error monitoring started`);
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