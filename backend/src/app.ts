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
import cookieParser from 'cookie-parser';
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
import { NotificationDomain } from './domains/notification/NotificationDomain';
import { AffiliateShopGroupDomain } from './domains/AffiliateShopGroupDomain';
import { ServiceDomain } from './domains/ServiceDomain';
import { MarketingDomain } from './domains/MarketingDomain';
import { MessagingDomain } from './domains/messaging';
import { SupportDomain } from './domains/support';
import { eventBus } from './events/EventBus';
import { monitoringService } from './services/MonitoringService';
import { cleanupService } from './services/CleanupService';
import { appointmentReminderService } from './services/AppointmentReminderService';
import { subscriptionReminderService } from './services/SubscriptionReminderService';
import { getAutoNoShowDetectionService } from './services/AutoNoShowDetectionService';
import { rescheduleExpirationService } from './services/RescheduleExpirationService';
import { autoMessageSchedulerService } from './services/AutoMessageSchedulerService';
import { StartupValidationService } from './services/StartupValidationService';
import { startSubscriptionEnforcement, stopSubscriptionEnforcement } from './services/SubscriptionEnforcementService';
import { startUnpaidBookingCleanup, stopUnpaidBookingCleanup } from './services/UnpaidBookingCleanupService';
import { bookingCleanupService } from './services/BookingCleanupService';

// WebSocket imports
import { Server as WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { WebSocketManager } from './services/WebSocketManager';

// Your existing route imports (for non-domain routes)
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import authRoutes from './routes/auth';
import securityRoutes from './routes/security';
import referralRoutes from './routes/referral';
import setupRoutes from './routes/setup';
import uploadRoutes from './routes/upload';
import waitlistRoutes from './routes/waitlist';

// Middleware imports
import { metricsMiddleware } from './utils/metrics';
import { generalCache } from './utils/cache';
import { requestIdMiddleware } from './middleware/errorHandler';
import { errorTrackingMiddleware, getErrorSummary, clearErrorMetrics, monitorErrors } from './middleware/errorTracking';
import { generalLimiter } from './middleware/rateLimiter';

class RepairCoinApp {
  public app = express();
  private server: HTTPServer | null = null;
  private wsManager: WebSocketManager | null = null;

  async initialize(): Promise<void> {
    try {
      // Run critical schema fixes before anything else
      await this.ensureCriticalSchema();

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

  private async ensureCriticalSchema(): Promise<void> {
    // TODO: Remove this entire method after 3+ stable production deploys confirm
    // the migration runner handles everything. Last reviewed: 2026-03-24.
    //
    // Schema fixes have been removed — migrations now handle them:
    // - Waitlist columns (085, 090, 091) — confirmed applied
    // - no_show_history type fixes (093) — confirmed applied
    // - shop_email_preferences table (082) — confirmed applied
    //
    // Only the schema_migrations backfill remains (one-time, idempotent).
    try {
      const { getSharedPool } = require('./utils/database-pool');
      const pool = getSharedPool();

      // Backfill missing schema_migrations records for migrations whose objects already exist
      // Production DB was restored from backup so early migrations were never recorded
      await pool.query(`
        INSERT INTO schema_migrations (version, name) VALUES
          (4, 'add_completed_at_to_purchases'),
          (6, 'remove_obsolete_columns'),
          (8, 'create_appointment_scheduling_tables'),
          (16, 'add_social_media_fields'),
          (17, 'create_notifications_table'),
          (18, 'create_affiliate_shop_groups'),
          (19, 'rename_to_affiliate_shop_groups'),
          (20, 'migrate_promo_codes_schema'),
          (21, 'add_max_bonus_to_validation'),
          (22, 'emergency_freeze_audit'),
          (23, 'hotfix_platform_stats'),
          (24, 'add_shop_subscriptions_fixed_v2'),
          (25, 'add_stripe_email_column'),
          (26, 'add_unique_constraints'),
          (27, 'add_shop_category'),
          (28, 'set_default_shop_categories'),
          (29, 'create_refresh_tokens_table'),
          (30, 'add_revoked_by_admin_column'),
          (34, 'add_group_rcn_allocation'),
          (35, 'add_icon_to_affiliate_shop_groups'),
          (36, 'create_shop_services'),
          (37, 'create_service_orders'),
          (38, 'add_tags_to_shop_services'),
          (39, 'create_service_favorites'),
          (40, 'create_service_reviews'),
          (41, 'fix_stripe_subscriptions_constraint'),
          (42, 'create_marketing_campaigns'),
          (43, 'create_subscription_enforcement_log'),
          (44, 'add_name_columns_to_customers'),
          (45, 'create_idempotency_keys'),
          (46, 'create_review_helpful_votes'),
          (47, 'add_row_locking_to_promo_validation'),
          (48, 'add_promo_code_stats_trigger'),
          (49, 'add_max_bonus_constraints'),
          (50, 'add_shop_logo'),
          (51, 'add_cancellation_fields_to_service_orders'),
          (52, 'add_no_show_tracking'),
          (53, 'create_appointment_reschedule_requests'),
          (54, 'add_multi_reminder_tracking'),
          (55, 'add_customer_notification_preferences'),
          (56, 'add_shop_timezone'),
          (57, 'add_performance_indexes'),
          (58, 'fix_shop_availability_constraint'),
          (59, 'add_shop_registration_fields'),
          (60, 'create_waitlist'),
          (61, 'fix_materialized_view_refresh'),
          (62, 'create_support_chat'),
          (63, 'add_no_show_penalty_system'),
          (65, 'recreate_no_show_tables'),
          (66, 'add_manual_booking_fields'),
          (67, 'add_expired_status'),
          (68, 'add_shop_rating_indexes'),
          (1000, 'complete_production_sync_20250919'),
          (1016, 'add_eth_payment_method'),
          (1017, 'cleanup_admins_table_columns'),
          (1018, 'cleanup_all_tables_schema'),
          (1020, 'fix_lifetime_earnings')
        ON CONFLICT (version) DO NOTHING
      `);

      logger.info('✅ Critical schema verified');
    } catch (error) {
      logger.warn('⚠️ Schema verification warning (non-fatal):', error);
    }
  }

  private setupMiddleware(): void {
    // Trust proxy - CRITICAL for Digital Ocean App Platform
    // This must come BEFORE any middleware that uses req.ip or req.protocol
    this.app.set('trust proxy', true);

    // Disable ETag for API routes to prevent slow 304 responses
    // Express generates ETag by running full query, comparing result - defeating cache purpose
    this.app.set('etag', false);

    // Add Cache-Control headers to prevent browser caching of API responses
    this.app.use('/api', (req, res, next) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      next();
    });

    // CORS must come before helmet to handle preflight requests properly
    // SUBDOMAIN SETUP: Backend at api.repaircoin.ai, Frontend at repaircoin.ai/www.repaircoin.ai
    this.app.use(cors({
      origin: function(origin, callback) {
        const allowedOrigins = [
          // Local development
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
          // Production domains
          'https://repaircoin.ai',
          'https://www.repaircoin.ai',
          'https://api.repaircoin.ai',
          // Staging domains
          'https://staging.repaircoin.ai',
          'https://api-staging.repaircoin.ai',
          process.env.FRONTEND_URL
        ].filter(Boolean);

        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Allow any Digital Ocean App Platform URL (for staging/development)
        if (origin && origin.includes('.ondigitalocean.app')) {
          return callback(null, true);
        }

        // Allow any Vercel deployment URL (for preview deployments)
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
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Cache-Control', 'Pragma', 'x-payment-page'],
      exposedHeaders: ['X-Token-Refreshed'], // Expose sliding window refresh header to frontend
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

    // Cookie parser middleware
    this.app.use(cookieParser());

    // Add request ID middleware
    this.app.use(requestIdMiddleware);

    // Apply general rate limiting to all API routes
    this.app.use('/api/', generalLimiter);

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
      const origin = req.headers.origin;
      // CRITICAL: When using credentials: true, we MUST use exact origin (not '*')
      // Otherwise browsers will block cookies for security reasons
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
      }
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
    // Register all domains including Admin and Notification
    domainRegistry.register(new CustomerDomain());
    domainRegistry.register(new TokenDomain());
    domainRegistry.register(new WebhookDomain());
    domainRegistry.register(new ShopDomain());
    domainRegistry.register(new AdminDomain());
    domainRegistry.register(new NotificationDomain());
    domainRegistry.register(new AffiliateShopGroupDomain());
    domainRegistry.register(new ServiceDomain());
    domainRegistry.register(new MarketingDomain());
    domainRegistry.register(new MessagingDomain());
    domainRegistry.register(new SupportDomain());

    // Initialize all domains (sets up event subscriptions)
    await domainRegistry.initializeAll();

    logger.info('Domain setup completed', {
      domains: domainRegistry.getAllDomains().map(d => d.name)
    });
  }

  private setupRoutes(): void {
    // Root endpoint - Backend status with enhanced security info
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
          api: '/api',
          systemInfo: '/api/system/info'
        },
        features: {
          dualTokenSystem: {
            rcn: 'Utility token for rewards (1 RCN = $0.10 USD)',
            rcg: 'Governance token (100M fixed supply)'
          },
          security: {
            uniqueConstraints: 'Email and wallet addresses are unique across all account types',
            roleConflictDetection: 'Admin role conflicts are detected and blocked',
            auditLogging: 'Comprehensive role change audit trails',
            startupValidation: 'Application validates admin addresses on startup'
          },
          adminTools: {
            conflictCheck: 'npm run admin:check-conflicts',
            safePromotion: 'npm run admin:promote <address> --action <deactivate|preserve|force>',
            roleHistory: 'npm run admin:history <address>',
            help: 'npm run admin:help'
          },
          domains: [
            'Customer Management (tiers, referrals, analytics)',
            'Shop Management (subscriptions, purchasing, bonuses)', 
            'Token Operations (minting, redemption, cross-shop)',
            'Admin Dashboard (analytics, treasury, user management)',
            'Webhook Processing (FixFlow, Stripe, rate limiting)'
          ],
          blockchain: {
            network: 'Base Sepolia',
            rcnContract: '0xBFE793d78B6B83859b528F191bd6F2b8555D951C',
            rcgContract: '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D'
          }
        }
      });
    });

    // Health check (always first)
    this.app.use('/api/health', healthRoutes);
    
    // Setup routes (TEMPORARY - REMOVE AFTER USE)
    this.app.use('/api/setup', setupRoutes);
    
    // Authentication routes
    this.app.use('/api/auth', authRoutes);

    // Security routes (session management, activity logs)
    this.app.use('/api/security', securityRoutes);

    // Referral routes
    this.app.use('/api/referrals', referralRoutes);

    // Upload routes
    this.app.use('/api/upload', uploadRoutes);

    // Waitlist routes
    this.app.use('/api/waitlist', waitlistRoutes);

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

    // API Status endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        status: 'running',
        message: 'RepairCoin API is operational',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          docs: '/api-docs',
          systemInfo: '/api/system/info'
        }
      });
    });

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
      // Close WebSocket connections
      if (this.wsManager) {
        this.wsManager.close();
        logger.info('WebSocket manager closed');
      }

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Enhanced shutdown
      await domainRegistry.cleanup();
      eventBus.clear();
      monitoringService.stopMonitoring();
      cleanupService.stopScheduledCleanup();
      appointmentReminderService.stopScheduledReminders();
      subscriptionReminderService.stopScheduler();
      getAutoNoShowDetectionService().stop();
      rescheduleExpirationService.stop();
      stopSubscriptionEnforcement();
      stopUnpaidBookingCleanup();
      bookingCleanupService.stop();
      autoMessageSchedulerService.stop();

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
    const port = parseInt(process.env.PORT || '4000');

    console.log('\n🔍 BACKEND PORT CONFIGURATION:');
    console.log(`- process.env.PORT from .env: ${process.env.PORT}`);
    console.log(`- Default if not set: 4000`);
    console.log(`- Actually using port: ${port}`);
    console.log(`- Full backend URL: http://localhost:${port}`);
    console.log('');

    // Warm up database connection pool before starting server (skip if connection tests disabled)
    if (process.env.SKIP_DB_CONNECTION_TESTS === 'true') {
      console.log('🔥 Skipping database pool warmup (connection tests disabled)');
    } else {
      console.log('🔥 Warming up database connection pool (this may take a few seconds for remote DB)...');
      const { warmUpPool, startPoolMonitoring } = await import('./utils/database-pool');
      try {
        await Promise.race([
          warmUpPool(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Pool warmup timeout after 10s')), 10000)
          )
        ]);

        // Start pool monitoring to track connection usage
        startPoolMonitoring(60000); // Log stats every minute
        console.log('✅ Database pool monitoring started');
      } catch (error) {
        console.log('⚠️ Database pool warmup failed, continuing startup:', error.message);
      }
    }

    // Perform startup validation for admin addresses (skip if connection tests disabled)
    let validation: any = { canStart: true, summary: { warnings: 0 } };

    if (process.env.SKIP_DB_CONNECTION_TESTS === 'true' || process.env.ADMIN_SKIP_CONFLICT_CHECK === 'true') {
      console.log('🔍 Skipping startup validation (database connection issues)');
    } else {
      console.log('🔍 Performing startup validation...');
      const validationService = new StartupValidationService();
      try {
        validation = await Promise.race([
          validationService.performFullStartupValidation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Startup validation timeout after 5s')), 5000)
          )
        ]);

        if (!validation.canStart) {
          console.error('🚫 Application startup blocked due to validation failures');
          console.error('   Please resolve the issues above and restart the application');
          process.exit(1);
        }
      } catch (error) {
        console.log('⚠️ Startup validation failed, continuing anyway:', error.message);
      }
    }

    if (validation.summary.warnings > 0) {
      console.warn(`⚠️ Application starting with ${validation.summary.warnings} warnings`);
    }

    // Create HTTP server from Express app
    this.server = new HTTPServer(this.app);

    // Setup WebSocket server
    const wss = new WebSocketServer({ server: this.server });
    this.wsManager = new WebSocketManager(wss);

    // Attach WebSocket manager to NotificationDomain
    const notificationDomain = domainRegistry.getAllDomains().find(
      d => d.name === 'notifications'
    ) as NotificationDomain;

    if (notificationDomain && notificationDomain.setWebSocketManager) {
      notificationDomain.setWebSocketManager(this.wsManager);
      logger.info('✅ WebSocket manager attached to NotificationDomain');
    }

    this.server.listen(port, () => {
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
      console.log('\n🔔 WebSocket Server:');
      console.log(`   • WebSocket URL: ws://localhost:${port}`);
      console.log(`   • Status: ${this.wsManager ? 'Active' : 'Inactive'}`);
      console.log('\n🔐 Admin Configuration:');
      console.log(`   • Admin Addresses: ${process.env.ADMIN_ADDRESSES || 'Not configured'}`);
      console.log('==============================================\n');
      
      // Skip monitoring services if database connection tests are disabled
      if (process.env.SKIP_DB_CONNECTION_TESTS === 'true') {
        logger.info('🔍 Skipping monitoring services (database connection issues)');
      } else {
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

        // Start cleanup service - runs daily at 2 AM UTC
        // Disable transaction archiving (function doesn't exist yet)
        cleanupService.scheduleCleanup(24, {
          enableTransactionArchiving: false
        });
        logger.info('🧹 Cleanup service scheduled (daily, webhook cleanup only)');

        // Start appointment reminder service - runs every hour for 2h reminder accuracy
        appointmentReminderService.scheduleReminders(1);
        logger.info('📅 Appointment reminder service scheduled (every 1 hour for 24h and 2h reminders)');

        // Start subscription reminder service - runs every 6 hours
        subscriptionReminderService.startScheduler(6);
        logger.info('💳 Subscription reminder service scheduled (every 6 hours for 7d, 3d, 1d reminders)');

        // Start auto no-show detection service - runs every 30 minutes
        // Feature flag: set AUTO_DETECTION_ENABLED=false to disable (includes no-show, expiry, pending cleanup)
        const autoDetectionEnabled = process.env.AUTO_DETECTION_ENABLED !== 'false';
        if (autoDetectionEnabled) {
          getAutoNoShowDetectionService().start();
          logger.info('🚫 Auto detection service started (no-show, expiry, pending cleanup - every 30 minutes)');
        } else {
          logger.info('⏸️ Auto detection service DISABLED via AUTO_DETECTION_ENABLED=false');
        }

        // Start reschedule expiration service - runs every hour
        rescheduleExpirationService.start();
        logger.info('⏰ Reschedule expiration service started (every hour)');

        // Start unpaid booking cleanup service - runs every hour
        // Auto-cancels unpaid manual bookings (pending status, pending payment) after 24 hours
        startUnpaidBookingCleanup();
        logger.info('🧹 Unpaid booking cleanup service started (every hour, 24h expiry)');

        // Start booking cleanup service - runs every 2 hours
        // Auto-cancels expired unpaid bookings (service date passed without payment)
        bookingCleanupService.start();
        logger.info('🗑️ Booking cleanup service started (every 2 hours, auto-cancel expired unpaid bookings)');

        // Start auto-message scheduler - runs every hour
        // Processes scheduled auto-messages (daily/weekly/monthly) and pending delayed sends
        autoMessageSchedulerService.start(1);
        logger.info('📨 Auto-message scheduler started (every 1 hour)');

        // Schedule platform statistics refresh every 5 minutes
        setInterval(async () => {
          try {
            const { adminRepository } = await import('./repositories');
            await adminRepository.refreshPlatformStatistics();
            logger.debug('📊 Platform statistics refreshed');
          } catch (error) {
            logger.error('Failed to refresh platform statistics:', error);
          }
        }, 5 * 60 * 1000); // 5 minutes
        logger.info('📊 Platform statistics refresh scheduled (every 5 minutes)');

        // Start error monitoring
        monitorErrors();
        logger.info(`🚨 Error monitoring started`);

        // Start subscription enforcement service - runs daily at 2 AM UTC
        // Checks for overdue subscriptions, sends warnings, and auto-cancels after grace period
        startSubscriptionEnforcement('0 2 * * *');
        logger.info('⚖️ Subscription enforcement service started (daily at 2 AM UTC)');
      }
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