// backend/src/docs/swagger.ts
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { Config } from '../config';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RepairCoin API',
      version: '1.0.0',
      description: `
        RepairCoin loyalty token system API.
        
        This API enables:
        - Customer registration and management
        - Token minting for repairs and referrals
        - Shop registration and management
        - Webhook processing for external integrations
        - Admin operations and analytics
      `,
      contact: {
        name: 'RepairCoin Team',
        email: 'support@repaircoin.ai',
        url: 'https://repaircoin.ai'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${Config.server.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.repaircoin.ai',
        description: 'Production server',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication. Get this from the login endpoint.'
        },
        webhookSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Fixflow-Signature',
          description: 'Webhook signature for secure webhook processing'
        }
      },
      schemas: {
        // Customer schemas
        Customer: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Ethereum wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            name: {
              type: 'string',
              description: 'Customer name',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Customer email address',
              example: 'john@example.com'
            },
            phone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1234567890'
            },
            tier: {
              type: 'string',
              enum: ['BRONZE', 'SILVER', 'GOLD'],
              description: 'Customer tier level',
              example: 'BRONZE'
            },
            lifetimeEarnings: {
              type: 'number',
              description: 'Total tokens earned lifetime',
              example: 150.50
            },
            isActive: {
              type: 'boolean',
              description: 'Whether customer account is active',
              example: true
            }
          },
          required: ['address', 'tier', 'lifetimeEarnings', 'isActive']
        },
        
        // Shop schemas
        Shop: {
          type: 'object',
          properties: {
            shopId: {
              type: 'string',
              description: 'Unique shop identifier',
              example: 'shop001'
            },
            name: {
              type: 'string',
              description: 'Shop name',
              example: 'Tech Repair Pro'
            },
            address: {
              type: 'string',
              description: 'Physical shop address',
              example: '123 Main St, Anytown, ST 12345'
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Shop wallet address',
              example: '0x7890123456789012345678901234567890123456'
            },
            verified: {
              type: 'boolean',
              description: 'Whether shop is verified by admin',
              example: true
            },
            active: {
              type: 'boolean',
              description: 'Whether shop is active',
              example: true
            },
            crossShopEnabled: {
              type: 'boolean',
              description: 'Whether cross-shop redemption is enabled',
              example: false
            }
          },
          required: ['shopId', 'name', 'address', 'walletAddress']
        },
        
        // Transaction schemas
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Transaction ID',
              example: 'repair_1234567890'
            },
            type: {
              type: 'string',
              enum: ['mint', 'redeem', 'transfer'],
              description: 'Transaction type',
              example: 'mint'
            },
            customerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Customer wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            shopId: {
              type: 'string',
              description: 'Shop identifier',
              example: 'shop001'
            },
            amount: {
              type: 'number',
              description: 'Token amount',
              example: 25.0
            },
            transactionHash: {
              type: 'string',
              description: 'Blockchain transaction hash',
              example: '0xabcdef1234567890...'
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'failed'],
              description: 'Transaction status',
              example: 'confirmed'
            }
          }
        },
        
        // Admin schemas
        Admin: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Admin ID',
              example: 1
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Admin wallet address',
              example: '0xabcd1234567890123456789012345678901234ef'
            },
            name: {
              type: 'string',
              description: 'Admin name',
              example: 'John Admin'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['manage_shops', 'manage_customers', 'manage_treasury', 'manage_admins', 'view_analytics', '*']
              },
              description: 'Admin permissions array',
              example: ['manage_shops', 'view_analytics']
            },
            isSuperAdmin: {
              type: 'boolean',
              description: 'Whether admin has super admin privileges',
              example: false
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Admin creation date',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-20T15:45:00Z'
            }
          },
          required: ['walletAddress', 'name', 'permissions']
        },

        AdminLoginRequest: {
          type: 'object',
          required: ['walletAddress'],
          properties: {
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Admin wallet address',
              example: '0xabcd1234567890123456789012345678901234ef'
            }
          }
        },

        AdminLoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: { 
              type: 'string', 
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            admin: {
              $ref: '#/components/schemas/Admin'
            },
            expiresIn: {
              type: 'string',
              description: 'Token expiration time',
              example: '24h'
            }
          }
        },

        PlatformStats: {
          type: 'object',
          properties: {
            totalCustomers: { type: 'integer', example: 1234 },
            activeCustomers: { type: 'integer', example: 890 },
            totalShops: { type: 'integer', example: 56 },
            activeShops: { type: 'integer', example: 45 },
            verifiedShops: { type: 'integer', example: 40 },
            pendingShops: { type: 'integer', example: 5 },
            totalTransactions: { type: 'integer', example: 5678 },
            totalTokensMinted: { type: 'number', example: 123456.78 },
            totalTokensRedeemed: { type: 'number', example: 98765.43 },
            platformRevenue: { type: 'number', example: 12345.67 }
          }
        },

        UnsuspendRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            entityType: {
              type: 'string',
              enum: ['customer', 'shop'],
              example: 'customer'
            },
            entityId: {
              type: 'string',
              description: 'Customer address or shop ID',
              example: '0x1234567890123456789012345678901234567890'
            },
            reason: {
              type: 'string',
              description: 'Reason for unsuspend request',
              example: 'Issue resolved with customer'
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              example: 'pending'
            },
            requestedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            },
            processedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: null
            },
            processedBy: {
              type: 'string',
              nullable: true,
              example: null
            }
          }
        },

        // API Response schemas
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            message: {
              type: 'string',
              description: 'Optional message',
              example: 'Operation completed successfully'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['success', 'timestamp']
        },
        
        ApiError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Customer not found'
            },
            code: {
              type: 'string',
              description: 'Error code',
              example: 'CUSTOMER_NOT_FOUND'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['success', 'error', 'timestamp']
        },
        
        // Token Verification schemas
        VerificationResult: {
          type: 'object',
          properties: {
            canRedeem: {
              type: 'boolean',
              description: 'Whether the customer can redeem at the shop',
              example: true
            },
            earnedBalance: {
              type: 'number',
              description: 'Amount of RCN earned (redeemable) by the customer',
              example: 125.50
            },
            totalBalance: {
              type: 'number',
              description: 'Total RCN balance (earned + market-bought)',
              example: 200.75
            },
            maxRedeemable: {
              type: 'number',
              description: 'Maximum amount redeemable at this shop',
              example: 125.50
            },
            isHomeShop: {
              type: 'boolean',
              description: 'Whether this is the customer\'s home shop',
              example: true
            },
            crossShopLimit: {
              type: 'number',
              description: 'Cross-shop redemption limit (20% of earned balance)',
              example: 25.10
            },
            message: {
              type: 'string',
              description: 'Human-readable verification message',
              example: 'Redemption approved for 50 RCN'
            }
          },
          required: ['canRedeem', 'earnedBalance', 'totalBalance', 'maxRedeemable', 'isHomeShop', 'crossShopLimit', 'message']
        },

        EarnedBalanceInfo: {
          type: 'object',
          properties: {
            earnedBalance: {
              type: 'number',
              description: 'RCN earned from shops (redeemable)',
              example: 125.50
            },
            totalBalance: {
              type: 'number',
              description: 'Total RCN balance (including market-bought)',
              example: 200.75
            },
            marketBalance: {
              type: 'number',
              description: 'RCN bought on market (not redeemable)',
              example: 75.25
            },
            earningHistory: {
              type: 'object',
              properties: {
                fromRepairs: {
                  type: 'number',
                  description: 'RCN earned from repair transactions',
                  example: 85.50
                },
                fromReferrals: {
                  type: 'number',
                  description: 'RCN earned from referrals',
                  example: 20.00
                },
                fromBonuses: {
                  type: 'number',
                  description: 'RCN earned from general bonuses',
                  example: 10.00
                },
                fromTierBonuses: {
                  type: 'number',
                  description: 'RCN earned from tier-based bonuses',
                  example: 10.00
                }
              }
            }
          },
          required: ['earnedBalance', 'totalBalance', 'marketBalance', 'earningHistory']
        },

        // Webhook schemas
        WebhookPayload: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              enum: ['repair_completed', 'referral_verified', 'ad_funnel_conversion', 'customer_registered'],
              description: 'Webhook event type',
              example: 'repair_completed'
            },
            data: {
              type: 'object',
              description: 'Event-specific data'
            }
          },
          required: ['event', 'data']
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'System health and status endpoints'
      },
      {
        name: 'Authentication',
        description: 'Authentication and authorization endpoints for admin users'
      },
      {
        name: 'Customers',
        description: 'Customer management and profile endpoints'
      },
      {
        name: 'Tokens',
        description: 'Token statistics and management endpoints'
      },
      {
        name: 'Token Verification',
        description: 'Token verification and anti-arbitrage endpoints'
      },
      {
        name: 'Shops',
        description: 'Shop registration, management, and redemption endpoints'
      },
      {
        name: 'Webhooks',
        description: 'Webhook processing and logging endpoints'
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints with permission-based access control. Super admin (environment variable) has all permissions, regular admins (database) have specific permissions.'
      },
      {
        name: 'System',
        description: 'System information, events, and monitoring endpoints'
      }
    ]
  },
  apis: [
    './src/docs/routes/*.ts', // Route documentation files
    './src/routes/*.ts',       // Existing route files
    './src/domains/*/routes/*.ts', // Domain-based routes
    './src/domains/*/controllers/*.ts' // Domain controllers
  ],
};

const specs = swaggerJSDoc(options) as any;

// Add complete paths documentation
specs.paths = {
  ...specs.paths,
  // Customer Domain Endpoints
  '/api/customers/{address}': {
    get: {
      tags: ['Customers'],
      summary: 'Get customer by wallet address',
      description: 'Retrieve detailed information about a customer including tier, earnings, and blockchain balance',
      parameters: [
        {
          in: 'path',
          name: 'address',
          required: true,
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          description: 'Customer Ethereum wallet address',
          example: '0x1234567890123456789012345678901234567890'
        }
      ],
      responses: {
        '200': {
          description: 'Customer details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          customer: { $ref: '#/components/schemas/Customer' },
                          blockchainBalance: { type: 'number', example: 125.50 },
                          tierBenefits: {
                            type: 'object',
                            properties: {
                              dailyLimit: { type: 'number', example: 200 },
                              monthlyLimit: { type: 'number', example: 2000 },
                              redemptionMultiplier: { type: 'number', example: 1.0 }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '404': { description: 'Customer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '400': { description: 'Invalid wallet address format', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    },
    put: {
      tags: ['Customers'],
      summary: 'Update customer information',
      description: 'Update customer profile information (requires authentication)',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'address',
          required: true,
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          description: 'Customer Ethereum wallet address'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email', example: 'newemail@example.com' },
                phone: { type: 'string', example: '+1234567890' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Customer updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Customer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/customers/register': {
    post: {
      tags: ['Customers'],
      summary: 'Register a new customer',
      description: 'Create a new customer account with optional email and phone',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletAddress'],
              properties: {
                walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$', example: '0x1234567890123456789012345678901234567890' },
                email: { type: 'string', format: 'email', example: 'customer@example.com' },
                phone: { type: 'string', example: '+1234567890' },
                fixflowCustomerId: { type: 'string', example: 'ff_customer_123' }
              }
            }
          }
        }
      },
      responses: {
        '201': { description: 'Customer registered successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '409': { description: 'Customer already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '400': { description: 'Invalid request data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/customers/{address}/transactions': {
    get: {
      tags: ['Customers'],
      summary: 'Get customer transaction history',
      description: 'Retrieve paginated transaction history for a customer',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'path', name: 'address', required: true, schema: { type: 'string' }, description: 'Customer wallet address' },
        { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, description: 'Number of transactions' },
        { in: 'query', name: 'offset', schema: { type: 'integer', minimum: 0, default: 0 }, description: 'Pagination offset' },
        { in: 'query', name: 'type', schema: { type: 'string', enum: ['mint', 'redeem', 'transfer'] }, description: 'Filter by transaction type' }
      ],
      responses: {
        '200': { description: 'Transaction history retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/customers/{address}/analytics': {
    get: {
      tags: ['Customers'],
      summary: 'Get customer analytics',
      description: 'Retrieve customer analytics and metrics',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'path', name: 'address', required: true, schema: { type: 'string' }, description: 'Customer wallet address' }
      ],
      responses: {
        '200': { description: 'Analytics retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Access denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/customers/{address}/mint': {
    post: {
      tags: ['Customers'],
      summary: 'Manual token minting (Admin only)',
      description: 'Manually mint tokens for a customer',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'path', name: 'address', required: true, schema: { type: 'string' }, description: 'Customer wallet address' }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount', 'reason'],
              properties: {
                amount: { type: 'number', minimum: 0.1, maximum: 1000, example: 25.5 },
                reason: { type: 'string', example: 'Manual adjustment' },
                shopId: { type: 'string', example: 'shop_001' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Tokens minted successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  // Token Domain Endpoints
  '/api/tokens/stats': {
    get: {
      tags: ['Tokens'],
      summary: 'Get token statistics',
      description: 'Retrieve comprehensive token statistics including supply and holders',
      security: [],
      responses: {
        '200': {
          description: 'Token statistics retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          totalSupply: { type: 'number', example: 1000000 },
                          totalHolders: { type: 'number', example: 1250 },
                          totalTransactions: { type: 'number', example: 5000 },
                          averageBalance: { type: 'number', example: 125.50 }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  },

  // Token Verification Endpoints
  '/api/tokens/verify-redemption': {
    post: {
      tags: ['Token Verification'],
      summary: 'Verify if customer RCN can be redeemed at shop',
      description: 'Centralized verification to prevent market-bought RCN from being redeemed. Only earned RCN can be redeemed at shops.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['customerAddress', 'shopId', 'amount'],
              properties: {
                customerAddress: {
                  type: 'string',
                  pattern: '^0x[a-fA-F0-9]{40}$',
                  description: 'Customer wallet address',
                  example: '0x1234567890123456789012345678901234567890'
                },
                shopId: {
                  type: 'string',
                  description: 'Shop identifier',
                  example: 'shop001'
                },
                amount: {
                  type: 'number',
                  minimum: 0.01,
                  maximum: 10000,
                  description: 'Amount of RCN to redeem',
                  example: 50.0
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Verification result',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/VerificationResult' }
                    }
                  }
                ]
              }
            }
          }
        },
        '400': { description: 'Invalid request parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Customer or shop not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/tokens/earned-balance/{address}': {
    get: {
      tags: ['Token Verification'],
      summary: 'Get customer\'s earned (redeemable) RCN balance',
      description: 'Returns only RCN earned from repairs, referrals, and shop bonuses. Market-bought RCN is excluded.',
      parameters: [{
        in: 'path',
        name: 'address',
        required: true,
        schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        description: 'Customer wallet address',
        example: '0x1234567890123456789012345678901234567890'
      }],
      responses: {
        '200': {
          description: 'Earned balance information',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/EarnedBalanceInfo' }
                    }
                  }
                ]
              }
            }
          }
        },
        '400': { description: 'Invalid address format', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Customer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/tokens/earning-sources/{address}': {
    get: {
      tags: ['Token Verification'],
      summary: 'Get detailed breakdown of customer\'s RCN earning sources',
      description: 'Shows where the customer earned their RCN tokens from different shops',
      parameters: [{
        in: 'path',
        name: 'address',
        required: true,
        schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        description: 'Customer wallet address',
        example: '0x1234567890123456789012345678901234567890'
      }],
      responses: {
        '200': {
          description: 'Earning sources breakdown',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          earningSources: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                shopId: { type: 'string', example: 'shop001' },
                                shopName: { type: 'string', example: 'Tech Repair Pro' },
                                totalEarned: { type: 'number', example: 85.50 },
                                fromRepairs: { type: 'number', example: 70.00 },
                                fromReferrals: { type: 'number', example: 10.00 },
                                fromBonuses: { type: 'number', example: 5.50 },
                                lastEarning: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
                              }
                            }
                          },
                          summary: {
                            type: 'object',
                            properties: {
                              totalShops: { type: 'number', example: 3 },
                              primaryShop: { type: 'string', example: 'shop001' },
                              totalEarned: { type: 'number', example: 125.50 }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '400': { description: 'Invalid address format', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Customer not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/tokens/verify-batch': {
    post: {
      tags: ['Token Verification'],
      summary: 'Batch verification for multiple redemptions',
      description: 'Verify multiple redemption requests at once (admin/shop access required)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['verifications'],
              properties: {
                verifications: {
                  type: 'array',
                  maxItems: 50,
                  description: 'Array of verification requests (max 50)',
                  items: {
                    type: 'object',
                    required: ['customerAddress', 'shopId', 'amount'],
                    properties: {
                      customerAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                      shopId: { type: 'string' },
                      amount: { type: 'number', minimum: 0.01 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Batch verification results',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          allOf: [
                            { $ref: '#/components/schemas/VerificationResult' },
                            {
                              type: 'object',
                              properties: {
                                index: { type: 'number', description: 'Index in the original request array' }
                              }
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '400': { description: 'Invalid request parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  // Webhook Domain Endpoints
  '/api/webhooks/fixflow': {
    post: {
      tags: ['Webhooks'],
      summary: 'Process FixFlow webhook',
      description: 'Handle incoming webhooks from FixFlow system for repair completions, referrals, etc.',
      security: [{ webhookSecret: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WebhookPayload' },
            examples: {
              repair_completed: {
                summary: 'Repair completion webhook',
                value: {
                  event: 'repair_completed',
                  data: {
                    customer_id: 'cust_123',
                    customer_wallet_address: '0x1234567890123456789012345678901234567890',
                    shop_id: 'shop001',
                    repair_amount: 150.00,
                    repair_id: 'repair_456',
                    customer_email: 'customer@example.com'
                  }
                }
              },
              referral_verified: {
                summary: 'Referral verification webhook',
                value: {
                  event: 'referral_verified',
                  data: {
                    referrer_wallet_address: '0x1234567890123456789012345678901234567890',
                    referee_wallet_address: '0x0987654321098765432109876543210987654321',
                    shop_id: 'shop001'
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Webhook processed successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '400': { description: 'Invalid webhook payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '401': { description: 'Invalid webhook signature', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/webhooks/test': {
    post: {
      tags: ['Webhooks'],
      summary: 'Test webhook endpoint (Development only)',
      description: 'Test webhook processing without signature verification',
      security: [],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookPayload' } } }
      },
      responses: {
        '200': { description: 'Test webhook processed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '404': { description: 'Endpoint not available in production' }
      }
    }
  },
  '/api/webhooks/logs': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook logs',
      description: 'Retrieve paginated webhook logs with filtering options',
      security: [],
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        { in: 'query', name: 'eventType', schema: { type: 'string' } },
        { in: 'query', name: 'source', schema: { type: 'string', enum: ['fixflow', 'admin', 'customer'] } },
        { in: 'query', name: 'processed', schema: { type: 'boolean' } },
        { in: 'query', name: 'success', schema: { type: 'boolean' } }
      ],
      responses: {
        '200': { description: 'Webhook logs retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
      }
    }
  },
  
  // Shop Domain Endpoints
  '/api/shops': {
    get: {
      tags: ['Shops'],
      summary: 'Get all active shops',
      description: 'Retrieve list of active shops with optional filtering',
      security: [],
      parameters: [
        { in: 'query', name: 'verified', schema: { type: 'boolean', default: true }, description: 'Filter by verification status' },
        { in: 'query', name: 'crossShopEnabled', schema: { type: 'boolean' }, description: 'Filter by cross-shop redemption status' }
      ],
      responses: {
        '200': { description: 'List of active shops', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
      }
    }
  },
  '/api/shops/{shopId}': {
    get: {
      tags: ['Shops'],
      summary: 'Get shop by ID',
      description: 'Retrieve detailed information about a specific shop',
      parameters: [
        { in: 'path', name: 'shopId', required: true, schema: { type: 'string' }, example: 'shop001' }
      ],
      responses: {
        '200': { description: 'Shop details retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '404': { description: 'Shop not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    },
    put: {
      tags: ['Shops'],
      summary: 'Update shop information',
      description: 'Update shop details (shop owner or admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'path', name: 'shopId', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Updated Shop Name' },
                address: { type: 'string', example: '456 New Street, City, State 12345' },
                phone: { type: 'string', example: '+1234567890' },
                email: { type: 'string', format: 'email', example: 'contact@shop.com' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Shop updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/shops/register': {
    post: {
      tags: ['Shops'],
      summary: 'Register a new shop',
      description: 'Register a new shop in the system',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['shopId', 'name', 'address', 'phone', 'email', 'walletAddress'],
              properties: {
                shopId: { type: 'string', example: 'shop001' },
                name: { type: 'string', example: 'Tech Repair Pro' },
                address: { type: 'string', example: '123 Main St, Anytown, ST 12345' },
                phone: { type: 'string', example: '+1234567890' },
                email: { type: 'string', format: 'email', example: 'contact@techrepairpro.com' },
                walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$', example: '0x7890123456789012345678901234567890123456' },
                reimbursementAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                fixflowShopId: { type: 'string', example: 'ff_shop_123' }
              }
            }
          }
        }
      },
      responses: {
        '201': { description: 'Shop registered successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '400': { description: 'Invalid request data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '409': { description: 'Shop ID already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  '/api/shops/{shopId}/redeem': {
    post: {
      tags: ['Shops'],
      summary: 'Process token redemption',
      description: 'Process token redemption at shop',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'path', name: 'shopId', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['customerAddress', 'amount'],
              properties: {
                customerAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                amount: { type: 'number', minimum: 0.1, maximum: 1000 },
                notes: { type: 'string', example: 'Service payment' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Redemption processed successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '400': { description: 'Invalid redemption request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  // Authentication Endpoints
  '/api/auth/admin': {
    post: {
      tags: ['Authentication'],
      summary: 'Admin login',
      description: 'Authenticate admin user and receive JWT token. Checks both environment variable super admins and database admins.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AdminLoginRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminLoginResponse' }
            }
          }
        },
        '401': { 
          description: 'Invalid credentials or not an admin',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        },
        '400': { 
          description: 'Invalid wallet address format',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  // Admin Domain Endpoints
  '/api/admin/stats': {
    get: {
      tags: ['Admin'],
      summary: 'Get platform statistics',
      description: 'Retrieve comprehensive platform metrics including customers, shops, transactions, and token circulation',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Platform statistics retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/PlatformStats' }
                    }
                  }
                ]
              }
            }
          }
        },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  '/api/admin/me': {
    get: {
      tags: ['Admin'],
      summary: 'Get current admin profile',
      description: 'Retrieve current admin user profile with permissions',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Admin profile retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Admin' }
                    }
                  }
                ]
              }
            }
          }
        },
        '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/admins': {
    get: {
      tags: ['Admin'],
      summary: 'Get all admins',
      description: 'Retrieve list of all admin users (Super admin only)',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Admin list retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Admin' }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '403': { 
          description: 'Super admin access required',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/admins/{adminId}': {
    get: {
      tags: ['Admin'],
      summary: 'Get specific admin',
      description: 'Retrieve details of a specific admin user',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'adminId',
          required: true,
          schema: { type: 'integer' },
          description: 'Admin ID',
          example: 1
        }
      ],
      responses: {
        '200': {
          description: 'Admin details retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Admin' }
                    }
                  }
                ]
              }
            }
          }
        },
        '404': { description: 'Admin not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    },
    put: {
      tags: ['Admin'],
      summary: 'Update admin',
      description: 'Update admin user details (Super admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'adminId',
          required: true,
          schema: { type: 'integer' },
          description: 'Admin ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Updated Admin Name' },
                permissions: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['manage_shops', 'manage_customers', 'manage_treasury', 'manage_admins', 'view_analytics']
                  },
                  example: ['manage_shops', 'manage_customers']
                }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Admin updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Super admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Admin not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    },
    delete: {
      tags: ['Admin'],
      summary: 'Delete admin',
      description: 'Remove admin user from system (Super admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'adminId',
          required: true,
          schema: { type: 'integer' },
          description: 'Admin ID'
        }
      ],
      responses: {
        '200': { description: 'Admin deleted successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Super admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Admin not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/admins/{adminId}/permissions': {
    put: {
      tags: ['Admin'],
      summary: 'Update admin permissions',
      description: 'Update permissions for an admin user (Super admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'adminId',
          required: true,
          schema: { type: 'integer' },
          description: 'Admin ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permissions'],
              properties: {
                permissions: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['manage_shops', 'manage_customers', 'manage_treasury', 'manage_admins', 'view_analytics']
                  },
                  description: 'Array of permission strings',
                  example: ['manage_shops', 'view_analytics']
                }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Permissions updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Super admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Admin not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/create-admin': {
    post: {
      tags: ['Admin'],
      summary: 'Create new admin',
      description: 'Create a new admin user with specified permissions (Super admin only)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['walletAddress', 'name', 'permissions'],
              properties: {
                walletAddress: { 
                  type: 'string', 
                  pattern: '^0x[a-fA-F0-9]{40}$',
                  description: 'Admin wallet address',
                  example: '0xabcd1234567890123456789012345678901234ef'
                },
                name: { 
                  type: 'string',
                  description: 'Admin name',
                  example: 'John Admin'
                },
                permissions: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['manage_shops', 'manage_customers', 'manage_treasury', 'manage_admins', 'view_analytics']
                  },
                  description: 'Array of permissions to grant',
                  example: ['manage_shops', 'view_analytics']
                }
              }
            }
          }
        }
      },
      responses: {
        '201': { 
          description: 'Admin created successfully',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } }
        },
        '400': { description: 'Invalid request data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '403': { description: 'Super admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '409': { description: 'Admin already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/customers': {
    get: {
      tags: ['Admin'],
      summary: 'Get customers list',
      description: 'Retrieve paginated customer list with admin-level details. Requires manage_customers permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
        { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
        { in: 'query', name: 'tier', schema: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD'] } },
        { in: 'query', name: 'active', schema: { type: 'boolean', default: true } }
      ],
      responses: {
        '200': { description: 'Customer list retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_customers',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/shops': {
    get: {
      tags: ['Admin'],
      summary: 'Get shops list',
      description: 'Retrieve shops with filtering options. Requires manage_shops permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'verified', schema: { type: 'boolean', default: true } },
        { in: 'query', name: 'active', schema: { type: 'string', enum: ['true', 'false', 'all'], default: 'true' } },
        { in: 'query', name: 'crossShopEnabled', schema: { type: 'boolean' } }
      ],
      responses: {
        '200': { description: 'Shop list retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_shops',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/create-shop': {
    post: {
      tags: ['Admin'],
      summary: 'Create new shop',
      description: 'Admin creates a new shop. Requires manage_shops permission.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['shop_id', 'name', 'address', 'phone', 'email', 'wallet_address'],
              properties: {
                shop_id: { type: 'string', example: 'shop001' },
                name: { type: 'string', example: 'Tech Repair Pro' },
                address: { type: 'string', example: '123 Main St, City, ST 12345' },
                phone: { type: 'string', example: '+1234567890' },
                email: { type: 'string', format: 'email', example: 'shop@example.com' },
                wallet_address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
              }
            }
          }
        }
      },
      responses: {
        '201': { description: 'Shop created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_shops',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/shops/{shopId}/approve': {
    post: {
      tags: ['Admin'],
      summary: 'Approve shop application',
      description: 'Approve a pending shop application. Requires manage_shops permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'shopId',
          required: true,
          schema: { type: 'string' },
          description: 'Shop ID',
          example: 'shop001'
        }
      ],
      responses: {
        '200': { description: 'Shop approved successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_shops',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        },
        '404': { description: 'Shop not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/shops/{shopId}/suspend': {
    post: {
      tags: ['Admin'],
      summary: 'Suspend shop',
      description: 'Suspend a shop from the platform. Requires manage_shops permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'shopId',
          required: true,
          schema: { type: 'string' },
          description: 'Shop ID'
        }
      ],
      responses: {
        '200': { description: 'Shop suspended successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_shops',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/shops/{shopId}/unsuspend': {
    post: {
      tags: ['Admin'],
      summary: 'Unsuspend shop',
      description: 'Restore a suspended shop. Requires manage_shops permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'shopId',
          required: true,
          schema: { type: 'string' },
          description: 'Shop ID'
        }
      ],
      responses: {
        '200': { description: 'Shop unsuspended successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_shops',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/customers/{address}/suspend': {
    post: {
      tags: ['Admin'],
      summary: 'Suspend customer',
      description: 'Suspend a customer account. Requires manage_customers permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'address',
          required: true,
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          description: 'Customer wallet address'
        }
      ],
      responses: {
        '200': { description: 'Customer suspended successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_customers',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/customers/{address}/unsuspend': {
    post: {
      tags: ['Admin'],
      summary: 'Unsuspend customer',
      description: 'Restore a suspended customer account. Requires manage_customers permission.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'address',
          required: true,
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          description: 'Customer wallet address'
        }
      ],
      responses: {
        '200': { description: 'Customer unsuspended successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { 
          description: 'Permission denied. Required permission: manage_customers',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  },

  '/api/admin/unsuspend-requests': {
    get: {
      tags: ['Admin'],
      summary: 'Get unsuspend requests',
      description: 'Retrieve all pending unsuspend requests',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Unsuspend requests retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/UnsuspendRequest' }
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/unsuspend-requests/{requestId}/approve': {
    post: {
      tags: ['Admin'],
      summary: 'Approve unsuspend request',
      description: 'Approve an unsuspend request',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'requestId',
          required: true,
          schema: { type: 'integer' },
          description: 'Request ID'
        }
      ],
      responses: {
        '200': { description: 'Request approved successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Request not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/unsuspend-requests/{requestId}/reject': {
    post: {
      tags: ['Admin'],
      summary: 'Reject unsuspend request',
      description: 'Reject an unsuspend request',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'requestId',
          required: true,
          schema: { type: 'integer' },
          description: 'Request ID'
        }
      ],
      responses: {
        '200': { description: 'Request rejected successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '404': { description: 'Request not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/mint': {
    post: {
      tags: ['Admin'],
      summary: 'Emergency manual token minting',
      description: 'Manually mint tokens for emergency situations',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['customerAddress', 'amount', 'reason'],
              properties: {
                customerAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                amount: { type: 'number', minimum: 0.1, maximum: 1000 },
                reason: { type: 'string', example: 'Emergency adjustment' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Emergency mint successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },

  '/api/admin/contract/pause': {
    post: {
      tags: ['Admin'],
      summary: 'Emergency contract pause',
      description: 'Pause the smart contract in emergency situations',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Contract paused successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  '/api/admin/contract/unpause': {
    post: {
      tags: ['Admin'],
      summary: 'Unpause contract',
      description: 'Resume normal contract operations',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Contract unpaused successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        '403': { description: 'Admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    }
  },
  
  // System Endpoints
  '/api/events/history': {
    get: {
      tags: ['System'],
      summary: 'Get system event history',
      description: 'Retrieve system event history and subscription information',
      security: [],
      parameters: [
        { in: 'query', name: 'type', schema: { type: 'string' }, description: 'Filter by event type' }
      ],
      responses: {
        '200': { description: 'Event history retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
      }
    }
  },
  '/api/system/info': {
    get: {
      tags: ['System'],
      summary: 'Get system information',
      description: 'Retrieve comprehensive system information including version, uptime, and domain status',
      security: [],
      responses: {
        '200': {
          description: 'System information retrieved',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          version: { type: 'string', example: '1.0.0' },
                          environment: { type: 'string', example: 'development' },
                          uptime: { type: 'number', example: 12345.67 },
                          memory: {
                            type: 'object',
                            properties: {
                              used: { type: 'number', example: 45 },
                              total: { type: 'number', example: 128 }
                            }
                          },
                          domains: { type: 'array', items: { type: 'string' } },
                          architecture: { type: 'string', example: 'enhanced-domains' }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  
  // Shop Wallet Detection Endpoint
  '/api/shops/wallet/{address}': {
    get: {
      tags: ['Shops'],
      summary: 'Get shop by wallet address',
      description: 'Retrieve shop information by wallet address. This endpoint is used for wallet detection to determine if an address is registered as a shop.',
      parameters: [
        {
          in: 'path',
          name: 'address',
          required: true,
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          description: 'Shop Ethereum wallet address',
          example: '0x7890123456789012345678901234567890123456'
        }
      ],
      responses: {
        '200': {
          description: 'Shop details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      shopId: { type: 'string', example: 'shop001' },
                      name: { type: 'string', example: 'Fix It Right Electronics' },
                      address: { type: 'string', example: '123 Main St, Tech City, TC 12345' },
                      phone: { type: 'string', example: '+1-555-0123' },
                      email: { type: 'string', example: 'contact@fixitright.com' },
                      walletAddress: { type: 'string', example: '0x7890123456789012345678901234567890123456' },
                      verified: { type: 'boolean', example: true },
                      active: { type: 'boolean', example: true },
                      crossShopEnabled: { type: 'boolean', example: true },
                      joinDate: { type: 'string', format: 'date-time', example: '2025-07-01T00:00:00.000Z' },
                      purchasedRcnBalance: { type: 'number', example: 5000 },
                      totalRcnPurchased: { type: 'number', example: 10000 },
                      totalTokensIssued: { type: 'number', example: 2500 },
                      totalRedemptions: { type: 'number', example: 1500 }
                    }
                  }
                }
              }
            }
          }
        },
        '400': {
          description: 'Invalid wallet address format',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        },
        '404': {
          description: 'Shop not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
        }
      }
    }
  }
};

export const setupSwagger = (app: Application): void => {
  // Swagger UI setup
  const swaggerOptions = {
    explorer: true,
    customSiteTitle: 'RepairCoin API Documentation'
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
  
  // Raw OpenAPI spec endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('📚 Swagger documentation available at /api-docs');
  console.log('📄 OpenAPI spec available at /api-docs.json');
};

// backend/src/docs/routes/customers.ts - Route-specific documentation
/**
 * @swagger
 * /api/customers/{address}:
 *   get:
 *     summary: Get customer by wallet address
 *     description: Retrieve detailed information about a customer including tier, earnings, and blockchain balance
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer's Ethereum wallet address
 *         example: '0x1234567890123456789012345678901234567890'
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         customer:
 *                           $ref: '#/components/schemas/Customer'
 *                         blockchainBalance:
 *                           type: number
 *                           example: 125.50
 *                         tierBenefits:
 *                           type: object
 *                           properties:
 *                             dailyLimit:
 *                               type: number
 *                               example: 200
 *                             monthlyLimit:
 *                               type: number
 *                               example: 2000
 *                             redemptionMultiplier:
 *                               type: number
 *                               example: 1.0
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       400:
 *         description: Invalid wallet address format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/customers/register:
 *   post:
 *     summary: Register a new customer
 *     description: Create a new customer account with optional email and phone
 *     tags: [Customers]
 *     security: []  # No auth required for registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Customer's Ethereum wallet address
 *                 example: '0x1234567890123456789012345678901234567890'
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address (optional)
 *                 example: 'customer@example.com'
 *               phone:
 *                 type: string
 *                 description: Customer's phone number (optional)
 *                 example: '+1234567890'
 *               fixflowCustomerId:
 *                 type: string
 *                 description: External FixFlow customer ID (optional)
 *                 example: 'ff_customer_123'
 *     responses:
 *       201:
 *         description: Customer registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Customer'
 *       409:
 *         description: Customer already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/customers/{address}/transactions:
 *   get:
 *     summary: Get customer transaction history
 *     description: Retrieve paginated transaction history for a customer
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer's wallet address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of transactions to return
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [mint, redeem, transfer]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         transactions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Transaction'
 *                         count:
 *                           type: integer
 *                           example: 25
 *                         customer:
 *                           type: object
 *                           properties:
 *                             address:
 *                               type: string
 *                             tier:
 *                               type: string
 *                             lifetimeEarnings:
 *                               type: number
 */

// backend/src/docs/routes/webhooks.ts - Webhook documentation
/**
 * @swagger
 * /api/webhooks/fixflow:
 *   post:
 *     summary: Process FixFlow webhook
 *     description: Handle incoming webhooks from FixFlow system for repair completions, referrals, etc.
 *     tags: [Webhooks]
 *     security:
 *       - webhookSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *           examples:
 *             repair_completed:
 *               summary: Repair completion webhook
 *               value:
 *                 event: "repair_completed"
 *                 data:
 *                   customer_id: "cust_123"
 *                   customer_wallet_address: "0x1234567890123456789012345678901234567890"
 *                   shop_id: "shop001"
 *                   repair_amount: 150.00
 *                   repair_id: "repair_456"
 *                   customer_email: "customer@example.com"
 *             referral_verified:
 *               summary: Referral verification webhook
 *               value:
 *                 event: "referral_verified"
 *                 data:
 *                   referrer_wallet_address: "0x1234567890123456789012345678901234567890"
 *                   referee_wallet_address: "0x0987654321098765432109876543210987654321"
 *                   shop_id: "shop001"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         webhookId:
 *                           type: string
 *                           example: "webhook_1234567890"
 *                         transactionHash:
 *                           type: string
 *                           example: "0xabcdef1234567890..."
 *                         processingTime:
 *                           type: number
 *                           example: 245
 *       400:
 *         description: Invalid webhook payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/webhooks/test:
 *   post:
 *     summary: Test webhook endpoint (development only)
 *     description: Test webhook processing without signature verification (development environment only)
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *     responses:
 *       200:
 *         description: Test webhook processed
 *       404:
 *         description: Endpoint not available in production
 */
