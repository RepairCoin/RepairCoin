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
        
        // Allow any Digital Ocean App Platform URL
        if (origin && origin.includes('.ondigitalocean.app')) {
          return callback(null, true);
        }
        
        // Allow any Vercel deployment URL
        if (origin && origin.includes('.vercel.app')) {
          return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // In production, only allow specified origins or DO/Vercel
          if (process.env.NODE_ENV === 'production') {
            logger.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          } else {
            callback(null, true); // Allow all origins in development
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Cache-Control', 'Pragma', 'x-payment-page'],
      preflightContinue: false,
      optionsSuccessStatus: 204
    }));
    
    // Helmet with adjusted settings for CORS compatibility
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));
    
    // Raw body parsing for Stripe webhooks (MUST be before JSON parsing)
    this.app.use('/api/shops/webhooks/stripe', 
      express.raw({ type: 'application/json' })
    );
    
    // JSON parsing for all other routes
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
    // Root endpoint - Backend status
    this.app.get('/', (req, res) => {
      res.json({
        message: 'RepairCoin Backend API is running',
        status: 'online',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          docs: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : 'disabled',
          api: '/api'
        }
      });
    });

    // Health check (always first)
    this.app.use('/api/health', healthRoutes);
    
    // Setup routes (TEMPORARY - REMOVE AFTER USE)
    this.app.use('/api/setup', setupRoutes);
    
    // Authentication routes
    this.app.use('/api/auth', authRoutes);
    
    // Referral routes
    this.app.use('/api/referrals', referralRoutes);
    
    // Domain public routes (no auth) - MUST BE MOUNTED FIRST
    domainRegistry.getAllDomains().forEach(domain => {
      if (domain.publicRoutes) {
        this.app.use(`/api/${domain.name}`, domain.publicRoutes);
        logger.info(`Domain public route registered: /api/${domain.name} (no auth)`);
      }
    });
    
    // Domain routes (with auth)
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

  async start(): Promise<void> {
    const port = parseInt(process.env.PORT || '5000');
    
    console.log('\n🔍 BACKEND PORT CONFIGURATION:');
    console.log(`- process.env.PORT from .env: ${process.env.PORT}`);
    console.log(`- Default if not set: 5000`);
    console.log(`- Actually using port: ${port}`);
    console.log(`- Full backend URL: http://localhost:${port}`);
    console.log('');
    
    // Warm up database connection pool before starting server
    console.log('🔥 Warming up database connection pool...');
    const { warmUpPool } = await import('./utils/database-pool');
    await warmUpPool();
    
    this.app.listen(port, () => {
      console.log('\n==============================================');
      console.log('🚀 RepairCoin Backend API Started Successfully');
      console.log('==============================================');
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔌 Port: ${port}`);
      console.log(`📍 Base URL: http://localhost:${port}`);
      console.log('\n📋 Available Endpoints:');
      console.log(`   • Root Status: http://localhost:${port}/`);
      console.log(`   • Health Check: http://localhost:${port}/api/health`);
      console.log(`   • API Docs: http://localhost:${port}/api-docs`);
      console.log(`   • System Info: http://localhost:${port}/api/system/info`);
      console.log('\n🏛️  Active Domains:');
      domainRegistry.getAllDomains().forEach(d => {
        console.log(`   • ${d.name}`);
      });
      console.log('\n🔐 Admin Configuration:');
      console.log(`   • Admin Addresses: ${process.env.ADMIN_ADDRESSES || 'Not configured'}`);
      console.log('==============================================\n');
      
      // Start monitoring service
      monitoringService.startMonitoring(30); // Run checks every 30 minutes
      
      // Start subscription automated workflows
      import('./services/PaymentRetryService').then(({ getPaymentRetryService }) => {
        const paymentRetryService = getPaymentRetryService();
        // Payment retry service starts automatically
        logger.info('💳 Payment retry service started');
      }).catch(error => {
        logger.error('Failed to start payment retry service:', error);
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
    await app.start();
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