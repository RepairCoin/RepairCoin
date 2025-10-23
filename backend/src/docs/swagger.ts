// backend/src/docs/swagger.ts
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { Config } from '../config';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RepairCoin API v3.0',
      version: '3.0.0',
      description: `
        RepairCoin v3.0 loyalty token system API with dual-token model (RCN utility + RCG governance).
        
        This API enables:
        - Customer registration and management with tier system
        - Token minting for repairs and referrals (unlimited supply with burn mechanism)
        - Shop registration, verification, and RCN balance management
        - Universal redemption network (100% redemption at any shop)
        - Referral system with automated rewards
        - Admin operations, analytics, and treasury management
        - Webhook processing for external integrations
        - Redemption sessions for secure customer-approved transactions
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
            referralCode: {
              type: 'string',
              description: 'Unique referral code',
              example: 'JOHN123'
            },
            referralCount: {
              type: 'number',
              description: 'Number of successful referrals',
              example: 5
            },
            dailyEarnings: {
              type: 'number',
              description: 'Tokens earned today',
              example: 25
            },
            monthlyEarnings: {
              type: 'number',
              description: 'Tokens earned this month',
              example: 100
            },
            lastEarnedDate: {
              type: 'string',
              format: 'date-time',
              description: 'Last date tokens were earned',
              example: '2025-09-04T12:00:00Z'
            },
            joinDate: {
              type: 'string',
              format: 'date-time',
              description: 'Registration date',
              example: '2025-01-01T00:00:00Z'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether customer account is active',
              example: true
            },
            isSuspended: {
              type: 'boolean',
              description: 'Whether customer is suspended',
              example: false
            },
            suspensionReason: {
              type: 'string',
              description: 'Reason for suspension if applicable',
              example: null
            }
          },
          required: ['address']
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
            companyName: {
              type: 'string',
              description: 'Shop company name',
              example: 'Joe\'s Auto Repair'
            },
            ownerName: {
              type: 'string',
              description: 'Shop owner full name',
              example: 'Joe Smith'
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Shop wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            reimbursementAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Address for RCN reimbursements',
              example: '0x1234567890123456789012345678901234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Shop contact email',
              example: 'contact@joesautorepair.com'
            },
            phone: {
              type: 'string',
              description: 'Shop contact phone',
              example: '+1234567890'
            },
            website: {
              type: 'string',
              format: 'url',
              description: 'Shop website URL',
              example: 'https://joesautorepair.com'
            },
            role: {
              type: 'string',
              enum: ['Owner', 'Manager', 'Employee'],
              description: 'Contact person role',
              example: 'Owner'
            },
            companySize: {
              type: 'string',
              enum: ['1-10', '11-50', '51-100', '100+'],
              description: 'Number of employees',
              example: '11-50'
            },
            monthlyRevenue: {
              type: 'string',
              enum: ['<$10k', '$10k-$50k', '$50k-$100k', '$100k+'],
              description: 'Monthly revenue range',
              example: '$50k-$100k'
            },
            referralBy: {
              type: 'string',
              description: 'Who referred this shop',
              example: 'Current Customer'
            },
            streetAddress: {
              type: 'string',
              description: 'Shop street address',
              example: '123 Main St'
            },
            city: {
              type: 'string',
              description: 'Shop city',
              example: 'San Francisco'
            },
            country: {
              type: 'string',
              description: 'Shop country',
              example: 'USA'
            },
            isVerified: {
              type: 'boolean',
              description: 'Shop verification status',
              example: true
            },
            isActive: {
              type: 'boolean',
              description: 'Shop active status',
              example: true
            },
            // Cross-shop setting removed - universal redemption is always enabled
            rcnBalance: {
              type: 'number',
              description: 'Shop\'s purchased RCN balance',
              example: 10000
            },
            totalIssuedRewards: {
              type: 'number',
              description: 'Total RCN rewards issued to customers',
              example: 2500
            },
            joinDate: {
              type: 'string',
              format: 'date-time',
              description: 'Shop registration date',
              example: '2025-01-01T00:00:00Z'
            }
          },
          required: ['shopId', 'companyName', 'address', 'email']
        },

        // Token schemas
        TokenStats: {
          type: 'object',
          properties: {
            totalSupply: {
              type: 'string',
              description: 'Total RCN token supply (unlimited)',
              example: '1000000000000000000000'
            },
            totalMinted: {
              type: 'number',
              description: 'Total tokens minted to date',
              example: 500000
            },
            totalBurned: {
              type: 'number',
              description: 'Total tokens burned to date',
              example: 50000
            },
            circulatingSupply: {
              type: 'number',
              description: 'Current circulating supply',
              example: 450000
            },
            totalCustomers: {
              type: 'number',
              description: 'Total registered customers',
              example: 1200
            },
            totalShops: {
              type: 'number',
              description: 'Total verified shops',
              example: 50
            },
            totalTransactions: {
              type: 'number',
              description: 'Total transactions processed',
              example: 5000
            }
          }
        },

        // Transaction schemas
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Transaction ID',
              example: 'txn_123456'
            },
            type: {
              type: 'string',
              enum: ['repair_reward', 'referral_reward', 'tier_bonus', 'redemption', 'shop_purchase', 'admin_mint', 'burn'],
              description: 'Transaction type',
              example: 'repair_reward'
            },
            amount: {
              type: 'number',
              description: 'Transaction amount in RCN',
              example: 25
            },
            customerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Customer wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            shopId: {
              type: 'string',
              description: 'Shop ID if applicable',
              example: 'shop001'
            },
            txHash: {
              type: 'string',
              description: 'Blockchain transaction hash',
              example: '0xabc123...'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed'],
              description: 'Transaction status',
              example: 'completed'
            },
            metadata: {
              type: 'object',
              description: 'Additional transaction data',
              additionalProperties: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation time',
              example: '2025-09-04T12:00:00Z'
            }
          }
        },

        // Referral schemas
        Referral: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Referral ID',
              example: 'ref_123456'
            },
            referrerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Referrer wallet address'
            },
            referredAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Referred customer wallet address'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'expired'],
              description: 'Referral status'
            },
            referralDate: {
              type: 'string',
              format: 'date-time',
              description: 'When referral was made'
            },
            completionDate: {
              type: 'string',
              format: 'date-time',
              description: 'When referral was completed'
            },
            rewardAmount: {
              type: 'number',
              description: 'RCN reward amount',
              example: 25
            }
          }
        },

        // Redemption Session schemas
        RedemptionSession: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Unique session identifier',
              example: 'sess_123456'
            },
            customerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Customer wallet address'
            },
            shopId: {
              type: 'string',
              description: 'Shop requesting redemption',
              example: 'shop001'
            },
            amount: {
              type: 'number',
              description: 'RCN amount to redeem',
              example: 100
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'expired'],
              description: 'Session status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Session creation time'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Session expiration time'
            }
          }
        },

        // Admin schemas
        Admin: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Admin ID'
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Admin wallet address'
            },
            name: {
              type: 'string',
              description: 'Admin name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Admin permissions'
            },
            isActive: {
              type: 'boolean',
              description: 'Admin active status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // Common response schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            }
          }
        },
        
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Invalid request'
            },
            code: {
              type: 'string',
              description: 'Error code',
              example: 'INVALID_REQUEST'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          }
        },

        PaginationParams: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Items per page'
            },
            sortBy: {
              type: 'string',
              description: 'Field to sort by'
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order'
            }
          }
        }
      }
    },
    paths: {
      // Health & System endpoints
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Check if the API is running and healthy',
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', example: 'healthy' },
                          timestamp: { type: 'string', format: 'date-time' },
                          uptime: { type: 'number' },
                          version: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/system/info': {
        get: {
          tags: ['System'],
          summary: 'System information',
          description: 'Get system information including version, uptime, and configuration',
          responses: {
            200: {
              description: 'System information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          version: { type: 'string' },
                          environment: { type: 'string' },
                          uptime: { type: 'number' },
                          memory: { type: 'object' },
                          domains: { type: 'array', items: { type: 'string' } },
                          architecture: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/errors/summary': {
        get: {
          tags: ['System'],
          summary: 'Error tracking summary',
          description: 'Get summary of recent errors',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Error summary',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          totalErrors: { type: 'number' },
                          errorsByType: { type: 'object' },
                          recentErrors: { type: 'array' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/errors/clear': {
        delete: {
          tags: ['System'],
          summary: 'Clear error metrics',
          description: 'Clear accumulated error metrics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Error metrics cleared'
            }
          }
        }
      },

      '/api/events/history': {
        get: {
          tags: ['System'],
          summary: 'Event history',
          description: 'Get domain event history',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'type',
              in: 'query',
              description: 'Filter by event type',
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Event history'
            }
          }
        }
      },

      // Auth endpoints
      '/api/auth/check-user': {
        post: {
          tags: ['Authentication'],
          summary: 'Check if user exists',
          description: 'Check if a wallet address is registered and return user type and basic info',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$',
                      description: 'Wallet address to check',
                      example: '0x1234567890123456789012345678901234567890'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'User found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      exists: { type: 'boolean', example: true },
                      type: {
                        type: 'string',
                        enum: ['admin', 'customer', 'shop'],
                        description: 'User type'
                      },
                      user: {
                        type: 'object',
                        description: 'User details (structure varies by type)',
                        properties: {
                          id: { type: 'string' },
                          address: { type: 'string' },
                          walletAddress: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          active: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            },
            404: {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      exists: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'User not found' },
                      message: { type: 'string', example: 'No user found with this wallet address' }
                    }
                  }
                }
              }
            },
            400: {
              description: 'Invalid request - missing wallet address'
            },
            500: {
              description: 'Internal server error'
            }
          }
        }
      },

      '/api/auth/admin': {
        post: {
          tags: ['Authentication'],
          summary: 'Admin login',
          description: 'Authenticate as admin using wallet address',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$',
                      description: 'Admin wallet address'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Authentication successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      token: { type: 'string', description: 'JWT token' },
                      admin: { $ref: '#/components/schemas/Admin' }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - not an admin'
            }
          }
        }
      },

      '/api/auth/shop': {
        post: {
          tags: ['Authentication'],
          summary: 'Shop login',
          description: 'Authenticate as shop using wallet address',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Authentication successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      token: { type: 'string' },
                      shop: { $ref: '#/components/schemas/Shop' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/auth/customer': {
        post: {
          tags: ['Authentication'],
          summary: 'Customer login',
          description: 'Authenticate as customer using wallet address',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Authentication successful'
            }
          }
        }
      },

      // Customer endpoints
      '/api/customers': {
        get: {
          tags: ['Customers'],
          summary: 'List all customers',
          description: 'Get paginated list of customers (requires authentication)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' },
            {
              name: 'tier',
              in: 'query',
              description: 'Filter by tier',
              schema: {
                type: 'string',
                enum: ['BRONZE', 'SILVER', 'GOLD']
              }
            },
            {
              name: 'isActive',
              in: 'query',
              description: 'Filter by active status',
              schema: { type: 'boolean' }
            }
          ],
          responses: {
            200: {
              description: 'Customer list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          customers: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Customer' }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'number' },
                              limit: { type: 'number' },
                              total: { type: 'number' },
                              totalPages: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized'
            }
          }
        }
      },

      '/api/customers/{address}': {
        get: {
          tags: ['Customers'],
          summary: 'Get customer by wallet address',
          description: 'Get customer details by their wallet address',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              description: 'Customer wallet address',
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Customer details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          customer: { $ref: '#/components/schemas/Customer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            404: {
              description: 'Customer not found'
            }
          }
        },
        put: {
          tags: ['Customers'],
          summary: 'Update customer information',
          description: 'Update customer profile information',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Customer updated successfully'
            }
          }
        }
      },

      '/api/customers/register': {
        post: {
          tags: ['Customers'],
          summary: 'Register new customer',
          description: 'Register a new customer with wallet address',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$',
                      description: 'Customer wallet address'
                    },
                    name: {
                      type: 'string',
                      description: 'Customer name'
                    },
                    email: {
                      type: 'string',
                      format: 'email',
                      description: 'Customer email'
                    },
                    phone: {
                      type: 'string',
                      description: 'Customer phone'
                    },
                    referralCode: {
                      type: 'string',
                      description: 'Referral code if referred'
                    }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Customer registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          customer: { $ref: '#/components/schemas/Customer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            409: {
              description: 'Wallet already registered as another role',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { type: 'string' },
                      conflictingRole: {
                        type: 'string',
                        enum: ['customer', 'shop', 'admin']
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/customers/{address}/transactions': {
        get: {
          tags: ['Customers'],
          summary: 'Get customer transactions',
          description: 'Get transaction history for a customer',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            },
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' },
            {
              name: 'type',
              in: 'query',
              description: 'Filter by transaction type',
              schema: {
                type: 'string',
                enum: ['repair_reward', 'referral_reward', 'tier_bonus', 'redemption']
              }
            }
          ],
          responses: {
            200: {
              description: 'Transaction history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          transactions: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Transaction' }
                          },
                          pagination: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/customers/{address}/analytics': {
        get: {
          tags: ['Customers'],
          summary: 'Get customer analytics',
          description: 'Get detailed analytics for a customer',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Customer analytics data'
            }
          }
        }
      },

      '/api/customers/{address}/mint': {
        post: {
          tags: ['Customers'],
          summary: 'Mint tokens to customer',
          description: 'Admin endpoint to manually mint tokens to a customer',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: {
                      type: 'number',
                      minimum: 1,
                      description: 'Amount of RCN to mint'
                    },
                    reason: {
                      type: 'string',
                      description: 'Reason for minting'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Tokens minted successfully'
            },
            401: {
              description: 'Unauthorized - admin only'
            }
          }
        }
      },

      '/api/customers/{address}/redemption-check': {
        get: {
          tags: ['Customers'],
          summary: 'Check redemption eligibility',
          description: 'Check if customer can redeem tokens at a specific shop',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            },
            {
              name: 'shopId',
              in: 'query',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'amount',
              in: 'query',
              required: true,
              schema: { type: 'number' }
            }
          ],
          responses: {
            200: {
              description: 'Redemption eligibility check result'
            }
          }
        }
      },

      '/api/customers/{address}/deactivate': {
        post: {
          tags: ['Customers'],
          summary: 'Deactivate customer',
          description: 'Deactivate a customer account',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Customer deactivated'
            }
          }
        }
      },

      '/api/customers/tier/{tierLevel}': {
        get: {
          tags: ['Customers'],
          summary: 'Get customers by tier',
          description: 'Get all customers in a specific tier',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'tierLevel',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: ['BRONZE', 'SILVER', 'GOLD']
              }
            }
          ],
          responses: {
            200: {
              description: 'Customers in tier'
            }
          }
        }
      },

      // Shop endpoints
      '/api/shops': {
        get: {
          tags: ['Shops'],
          summary: 'List shops',
          description: 'Get list of shops with optional filters',
          parameters: [
            {
              name: 'verified',
              in: 'query',
              description: 'Filter by verification status',
              schema: { type: 'boolean' }
            },
            {
              name: 'active',
              in: 'query',
              description: 'Filter by active status',
              schema: { type: 'boolean' }
            },
            // crossShopEnabled filter removed - all shops have universal redemption
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' }
          ],
          responses: {
            200: {
              description: 'Shop list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          shops: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Shop' }
                          },
                          pagination: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/shops/register': {
        post: {
          tags: ['Shops'],
          summary: 'Register new shop',
          description: 'Register a new shop with comprehensive business information',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['shopId', 'companyName', 'address', 'email'],
                  properties: {
                    shopId: { type: 'string' },
                    companyName: { type: 'string' },
                    ownerFirstName: { type: 'string' },
                    ownerLastName: { type: 'string' },
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    email: {
                      type: 'string',
                      format: 'email'
                    },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                    role: {
                      type: 'string',
                      enum: ['Owner', 'Manager', 'Employee']
                    },
                    companySize: {
                      type: 'string',
                      enum: ['1-10', '11-50', '51-100', '100+']
                    },
                    monthlyRevenue: {
                      type: 'string',
                      enum: ['<$10k', '$10k-$50k', '$50k-$100k', '$100k+']
                    },
                    referralBy: { type: 'string' },
                    streetAddress: { type: 'string' },
                    city: { type: 'string' },
                    country: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Shop registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          shop: { $ref: '#/components/schemas/Shop' }
                        }
                      }
                    }
                  }
                }
              }
            },
            409: {
              description: 'Wallet already registered as another role'
            }
          }
        }
      },

      '/api/shops/{shopId}': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop by ID',
          description: 'Get shop details by shop ID',
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Shop details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          shop: { $ref: '#/components/schemas/Shop' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        put: {
          tags: ['Shops'],
          summary: 'Update shop information',
          description: 'Update shop profile information',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    companyName: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                    streetAddress: { type: 'string' },
                    city: { type: 'string' },
                    country: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Shop updated successfully'
            }
          }
        }
      },

      '/api/shops/wallet/{address}': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop by wallet address',
          description: 'Find shop by wallet address',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Shop found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          shop: { $ref: '#/components/schemas/Shop' }
                        }
                      }
                    }
                  }
                }
              }
            },
            404: {
              description: 'Shop not found'
            }
          }
        }
      },

      '/api/shops/{shopId}/issue-reward': {
        post: {
          tags: ['Shops'],
          summary: 'Issue reward to customer',
          description: 'Issue RCN reward to customer for repair service',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerAddress', 'repairAmount'],
                  properties: {
                    customerAddress: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    repairAmount: {
                      type: 'number',
                      minimum: 0,
                      description: 'Repair amount in USD'
                    },
                    skipTierBonus: {
                      type: 'boolean',
                      default: false,
                      description: 'Skip tier bonus calculation'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Reward issued successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          baseReward: { type: 'number' },
                          tierBonus: { type: 'number' },
                          totalReward: { type: 'number' },
                          txHash: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/shops/{shopId}/redeem': {
        post: {
          tags: ['Shops'],
          summary: 'Process token redemption',
          description: 'Process customer RCN redemption at shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      description: 'Redemption session ID'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Redemption processed successfully'
            }
          }
        }
      },

      '/api/shops/{shopId}/verify': {
        post: {
          tags: ['Shops'],
          summary: 'Verify shop',
          description: 'Admin endpoint to verify a shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Shop verified'
            }
          }
        }
      },

      '/api/shops/{shopId}/dashboard': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop dashboard data',
          description: 'Get comprehensive dashboard data for shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Dashboard data'
            }
          }
        }
      },

      '/api/shops/{shopId}/transactions': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop transactions',
          description: 'Get transaction history for shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' }
          ],
          responses: {
            200: {
              description: 'Transaction history'
            }
          }
        }
      },

      '/api/shops/{shopId}/pending-sessions': {
        get: {
          tags: ['Shops'],
          summary: 'Get pending redemption sessions',
          description: 'Get pending redemption sessions for shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Pending sessions'
            }
          }
        }
      },

      // Token endpoints
      '/api/tokens/stats': {
        get: {
          tags: ['Tokens'],
          summary: 'Token statistics',
          description: 'Get platform-wide token statistics',
          responses: {
            200: {
              description: 'Token statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/TokenStats' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/tokens/verify-redemption': {
        post: {
          tags: ['Tokens'],
          summary: 'Verify redemption eligibility',
          description: 'Verify if customer can redeem tokens at shop',
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
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          eligible: { type: 'boolean' },
                          reason: { type: 'string' },
                          availableBalance: { type: 'number' },
                          earnedBalance: { type: 'number' },
                          isHomeShop: { type: 'boolean', description: 'Legacy field - all shops now allow 100% redemption' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/tokens/earned-balance/{address}': {
        get: {
          tags: ['Tokens'],
          summary: 'Get earned balance',
          description: 'Get customer\'s earned (redeemable) RCN balance',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Earned balance breakdown'
            }
          }
        }
      },

      '/api/tokens/earning-sources/{address}': {
        get: {
          tags: ['Tokens'],
          summary: 'Get earning sources',
          description: 'Get detailed breakdown of customer\'s RCN earning sources by shop',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{40}$'
              }
            }
          ],
          responses: {
            200: {
              description: 'Earning sources breakdown'
            }
          }
        }
      },

      '/api/tokens/verify-batch': {
        post: {
          tags: ['Tokens'],
          summary: 'Batch verification',
          description: 'Verify multiple redemptions in batch',
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
                      items: {
                        type: 'object',
                        properties: {
                          customerAddress: { type: 'string' },
                          shopId: { type: 'string' },
                          amount: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Batch verification results'
            }
          }
        }
      },

      '/api/tokens/redemption-session/create': {
        post: {
          tags: ['Tokens'],
          summary: 'Create redemption session',
          description: 'Create a new redemption session for customer approval',
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
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          sessionId: { type: 'string' },
                          expiresAt: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/tokens/redemption-session/{sessionId}/approve': {
        post: {
          tags: ['Tokens'],
          summary: 'Approve redemption session',
          description: 'Customer approves redemption session',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Session approved'
            }
          }
        }
      },

      '/api/tokens/redemption-session/{sessionId}/reject': {
        post: {
          tags: ['Tokens'],
          summary: 'Reject redemption session',
          description: 'Customer rejects redemption session',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Session rejected'
            }
          }
        }
      },

      // Webhook endpoints
      '/api/webhooks/fixflow': {
        post: {
          tags: ['Webhooks'],
          summary: 'Process FixFlow webhook',
          description: 'Process incoming webhooks from FixFlow system',
          security: [{ webhookSecret: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['event'],
                  properties: {
                    event: {
                      type: 'string',
                      enum: ['repair.completed', 'customer.created', 'payment.received']
                    },
                    data: {
                      type: 'object',
                      description: 'Event-specific data'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Webhook processed successfully'
            },
            401: {
              description: 'Invalid webhook signature'
            }
          }
        }
      },

      '/api/webhooks/test': {
        post: {
          tags: ['Webhooks'],
          summary: 'Test webhook endpoint',
          description: 'Test webhook processing without authentication',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Test webhook received'
            }
          }
        }
      },

      '/api/webhooks/logs': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook logs',
          description: 'Get recent webhook processing logs',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['success', 'failed']
              }
            },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' }
          ],
          responses: {
            200: {
              description: 'Webhook logs'
            }
          }
        }
      },

      // Admin endpoints
      '/api/admin/stats': {
        get: {
          tags: ['Admin'],
          summary: 'Platform statistics',
          description: 'Get platform-wide statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Platform statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          totalCustomers: { type: 'number' },
                          activeCustomers: { type: 'number' },
                          totalShops: { type: 'number' },
                          verifiedShops: { type: 'number' },
                          pendingApplications: { type: 'number' },
                          totalTransactions: { type: 'number' },
                          totalTokensIssued: { type: 'number' },
                          platformRevenue: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/admin/customers': {
        get: {
          tags: ['Admin'],
          summary: 'List customers (admin)',
          description: 'Admin endpoint to list all customers',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' },
            {
              name: 'tier',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['BRONZE', 'SILVER', 'GOLD']
              }
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'suspended', 'inactive']
              }
            }
          ],
          responses: {
            200: {
              description: 'Customer list'
            }
          }
        }
      },

      '/api/admin/shops': {
        get: {
          tags: ['Admin'],
          summary: 'List shops (admin)',
          description: 'Admin endpoint to list all shops',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'verified',
              in: 'query',
              schema: { type: 'boolean' }
            },
            {
              name: 'active',
              in: 'query',
              schema: { type: 'boolean' }
            },
            { $ref: '#/components/schemas/PaginationParams/properties/page' },
            { $ref: '#/components/schemas/PaginationParams/properties/limit' }
          ],
          responses: {
            200: {
              description: 'Shop list'
            }
          }
        }
      },

      '/api/admin/shops/{shopId}/approve': {
        post: {
          tags: ['Admin'],
          summary: 'Approve shop application',
          description: 'Approve a pending shop application',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Shop approved'
            }
          }
        }
      },

      '/api/admin/create-shop': {
        post: {
          tags: ['Admin'],
          summary: 'Create shop (admin)',
          description: 'Admin endpoint to create and auto-verify a shop',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['shopId', 'companyName', 'address', 'email'],
                  properties: {
                    shopId: { type: 'string' },
                    companyName: { type: 'string' },
                    ownerFirstName: { type: 'string' },
                    ownerLastName: { type: 'string' },
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    autoVerify: {
                      type: 'boolean',
                      default: true
                    },
                    initialRcnBalance: {
                      type: 'number',
                      default: 0
                    }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Shop created'
            }
          }
        }
      },

      '/api/admin/mint': {
        post: {
          tags: ['Admin'],
          summary: 'Emergency mint',
          description: 'Emergency mint tokens to address',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address', 'amount'],
                  properties: {
                    address: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    },
                    amount: {
                      type: 'number',
                      minimum: 1
                    },
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Tokens minted'
            }
          }
        }
      },

      '/api/admin/treasury': {
        get: {
          tags: ['Admin'],
          summary: 'Treasury statistics',
          description: 'Get treasury and RCN sales statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Treasury data'
            }
          }
        }
      },

      '/api/admin/treasury/update': {
        post: {
          tags: ['Admin'],
          summary: 'Update treasury',
          description: 'Update treasury after RCN sale',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'shopId'],
                  properties: {
                    amount: { type: 'number' },
                    shopId: { type: 'string' },
                    paymentMethod: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Treasury updated'
            }
          }
        }
      },

      '/api/admin/analytics/overview': {
        get: {
          tags: ['Admin'],
          summary: 'Analytics overview',
          description: 'Get comprehensive analytics overview',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['day', 'week', 'month', 'year']
              }
            }
          ],
          responses: {
            200: {
              description: 'Analytics data'
            }
          }
        }
      },

      // Referral endpoints
      '/api/referrals/generate': {
        post: {
          tags: ['Referrals'],
          summary: 'Generate referral code',
          description: 'Generate a unique referral code for customer',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerAddress'],
                  properties: {
                    customerAddress: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Referral code generated'
            }
          }
        }
      },

      '/api/referrals/validate/{code}': {
        get: {
          tags: ['Referrals'],
          summary: 'Validate referral code',
          description: 'Check if referral code is valid',
          parameters: [
            {
              name: 'code',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Validation result'
            }
          }
        }
      },

      '/api/referrals/stats': {
        get: {
          tags: ['Referrals'],
          summary: 'Referral statistics',
          description: 'Get referral system statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Referral stats'
            }
          }
        }
      },

      '/api/referrals/leaderboard': {
        get: {
          tags: ['Referrals'],
          summary: 'Referral leaderboard',
          description: 'Get top referrers',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                default: 10
              }
            }
          ],
          responses: {
            200: {
              description: 'Leaderboard data'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'System',
        description: 'System health and monitoring endpoints'
      },
      {
        name: 'Authentication',
        description: 'Authentication endpoints for all user types'
      },
      {
        name: 'Customers',
        description: 'Customer management and operations'
      },
      {
        name: 'Shops',
        description: 'Shop management and operations'
      },
      {
        name: 'Tokens',
        description: 'Token operations and verification'
      },
      {
        name: 'Webhooks',
        description: 'External webhook processing'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      },
      {
        name: 'Referrals',
        description: 'Referral system operations'
      }
    ]
  },
  apis: ['./src/**/*.ts'] // This will look for JSDoc comments in your source files
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app: Application): void {
  // Serve Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  if (process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'RepairCoin API Documentation',
    }));
  }
}