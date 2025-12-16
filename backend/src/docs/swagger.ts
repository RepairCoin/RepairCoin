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
        - Emergency freeze system for security incident response
        - Webhook processing for external integrations
        - Redemption sessions for secure customer-approved transactions
        - Service marketplace with booking, reviews, and ratings
        - Appointment scheduling with automated reminders and notifications

        **New Features:**
        - **Service Marketplace**: Customers can browse, favorite, share, and book services from verified shops
        - **Appointment System**: Complete scheduling with date/time selection, availability management, and calendar views
        - **Automated Reminders**: Email and in-app notifications sent 24 hours before appointments to reduce no-shows
        - **Booking Confirmations**: Immediate confirmation emails sent after successful payment with booking details
        - **Reviews & Ratings**: Customers can review completed services; shops can respond
        - **RCN Earning Display**: Service cards show earning potential with tier bonuses

        **Security Features:**
        The platform includes a comprehensive emergency freeze system that allows administrators to immediately halt critical operations during security incidents. This system provides component-level control, complete audit trails, and automated administrator alerts.
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

        // Affiliate Shop Group schemas
        AffiliateShopGroup: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'Unique group identifier',
              example: 'grp_1234567890'
            },
            groupName: {
              type: 'string',
              description: 'Name of the shop group',
              example: 'Downtown Auto Repair Coalition'
            },
            customTokenName: {
              type: 'string',
              description: 'Custom token name for the group',
              example: 'DowntownBucks'
            },
            customTokenSymbol: {
              type: 'string',
              description: 'Custom token symbol (max 10 chars)',
              example: 'DTB'
            },
            description: {
              type: 'string',
              description: 'Group description',
              example: 'Coalition of auto repair shops in downtown area'
            },
            logoUrl: {
              type: 'string',
              format: 'url',
              description: 'Group logo URL',
              example: 'https://example.com/logo.png'
            },
            inviteCode: {
              type: 'string',
              description: 'Unique invite code for joining the group',
              example: 'DTARC2025'
            },
            isPrivate: {
              type: 'boolean',
              description: 'Whether group requires approval to join',
              example: false
            },
            createdByShopId: {
              type: 'string',
              description: 'Shop ID of the group creator',
              example: 'shop001'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Group creation timestamp',
              example: '2025-01-01T00:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-01-01T00:00:00Z'
            },
            memberCount: {
              type: 'number',
              description: 'Total number of active members',
              example: 5
            }
          },
          required: ['groupId', 'groupName', 'customTokenName', 'customTokenSymbol']
        },

        AffiliateShopGroupMember: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'Group identifier',
              example: 'grp_1234567890'
            },
            shopId: {
              type: 'string',
              description: 'Shop identifier',
              example: 'shop001'
            },
            role: {
              type: 'string',
              enum: ['admin', 'member'],
              description: 'Member role in the group',
              example: 'member'
            },
            status: {
              type: 'string',
              enum: ['active', 'pending', 'rejected', 'removed'],
              description: 'Membership status',
              example: 'active'
            },
            joinedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the member joined',
              example: '2025-01-01T00:00:00Z'
            },
            requestMessage: {
              type: 'string',
              description: 'Message from shop when requesting to join',
              example: 'We would love to be part of this coalition'
            }
          }
        },

        CustomerAffiliateGroupBalance: {
          type: 'object',
          properties: {
            customerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Customer wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            groupId: {
              type: 'string',
              description: 'Group identifier',
              example: 'grp_1234567890'
            },
            balance: {
              type: 'number',
              description: 'Current token balance',
              example: 150
            },
            lifetimeEarned: {
              type: 'number',
              description: 'Total tokens earned in this group',
              example: 200
            },
            lifetimeRedeemed: {
              type: 'number',
              description: 'Total tokens redeemed in this group',
              example: 50
            },
            lastEarnedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last time tokens were earned',
              example: '2025-01-01T00:00:00Z'
            },
            lastRedeemedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last time tokens were redeemed',
              example: '2025-01-01T00:00:00Z'
            }
          }
        },

        GroupTokenTransaction: {
          type: 'object',
          properties: {
            transactionId: {
              type: 'string',
              description: 'Unique transaction identifier',
              example: 'gtx_1234567890'
            },
            groupId: {
              type: 'string',
              description: 'Group identifier',
              example: 'grp_1234567890'
            },
            customerAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Customer wallet address',
              example: '0x1234567890123456789012345678901234567890'
            },
            shopId: {
              type: 'string',
              description: 'Shop that processed the transaction',
              example: 'shop001'
            },
            type: {
              type: 'string',
              enum: ['earn', 'redeem'],
              description: 'Transaction type',
              example: 'earn'
            },
            amount: {
              type: 'number',
              description: 'Token amount',
              example: 50
            },
            reason: {
              type: 'string',
              description: 'Reason for transaction',
              example: 'Oil change service'
            },
            metadata: {
              type: 'object',
              description: 'Additional transaction data'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction timestamp',
              example: '2025-01-01T00:00:00Z'
            }
          }
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

        // Emergency Freeze schemas
        EmergencyFreezeRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: {
              type: 'string',
              description: 'Detailed reason for emergency action',
              example: 'Suspicious transaction activity detected requiring immediate intervention'
            },
            components: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers']
              },
              description: 'Specific components to freeze/unfreeze (defaults to all)',
              example: ['token_minting', 'shop_purchases']
            }
          }
        },

        EmergencyFreezeResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['emergency_freeze', 'emergency_unfreeze']
                },
                auditId: { type: 'number' },
                reason: { type: 'string' },
                adminAddress: { type: 'string' },
                componentsAffected: {
                  type: 'array',
                  items: { type: 'string' }
                },
                timestamp: { type: 'string', format: 'date-time' },
                status: { type: 'string' }
              }
            }
          }
        },

        FreezeStatusResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isFrozen: {
                  type: 'boolean',
                  description: 'Whether any component is currently frozen'
                },
                frozenComponents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of currently frozen components'
                },
                systemStatus: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      component: { type: 'string' },
                      is_frozen: { type: 'boolean' },
                      frozen_at: { type: 'string', format: 'date-time', nullable: true },
                      frozen_by: { type: 'string', nullable: true },
                      freeze_reason: { type: 'string', nullable: true }
                    }
                  }
                },
                recentAuditHistory: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/FreezeAuditRecord' }
                },
                activeAlerts: { type: 'number' },
                lastFreezeAction: {
                  type: 'object',
                  nullable: true
                }
              }
            }
          }
        },

        FreezeAuditRecord: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            action_type: {
              type: 'string',
              enum: ['freeze', 'unfreeze']
            },
            reason: { type: 'string' },
            admin_address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        FreezeError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' },
            component: { type: 'string' },
            frozen: { type: 'boolean', example: true },
            code: {
              type: 'string',
              enum: ['EMERGENCY_FREEZE_ACTIVE', 'CRITICAL_SERVICES_FROZEN']
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
          description: 'Emergency mint tokens to address. This operation is protected by the emergency freeze system.',
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
            },
            503: {
              description: 'Service unavailable due to emergency freeze',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/FreezeError' }
                }
              }
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

      // Emergency Freeze System endpoints
      '/api/admin/treasury/emergency-freeze': {
        post: {
          tags: ['Admin'],
          summary: 'Execute emergency freeze',
          description: 'Immediately freeze critical treasury operations due to security threats or system issues',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: {
                      type: 'string',
                      description: 'Detailed reason for emergency freeze',
                      example: 'Suspicious transaction activity detected requiring immediate intervention'
                    },
                    components: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers']
                      },
                      description: 'Specific components to freeze (defaults to all if not specified)',
                      example: ['token_minting', 'shop_purchases']
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Emergency freeze executed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: '🚨 Emergency freeze executed successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          action: { type: 'string', example: 'emergency_freeze' },
                          auditId: { type: 'number', example: 123 },
                          reason: { type: 'string' },
                          adminAddress: { type: 'string' },
                          componentsAffected: {
                            type: 'array',
                            items: { type: 'string' }
                          },
                          timestamp: { type: 'string', format: 'date-time' },
                          status: { type: 'string', example: 'All critical systems have been frozen' }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - admin authentication required'
            },
            500: {
              description: 'Emergency freeze partially failed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { type: 'string', example: 'Emergency freeze partially failed' },
                      data: {
                        type: 'object',
                        properties: {
                          auditId: { type: 'number' },
                          errors: {
                            type: 'array',
                            items: { type: 'string' }
                          },
                          message: { type: 'string', example: 'Some components may still be operational. Check system status.' }
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

      '/api/admin/treasury/emergency-unfreeze': {
        post: {
          tags: ['Admin'],
          summary: 'Lift emergency freeze',
          description: 'Restore normal operations after emergency freeze has been resolved',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: {
                      type: 'string',
                      description: 'Detailed reason for lifting emergency freeze',
                      example: 'Security issue resolved, all systems verified safe for operation'
                    },
                    components: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers']
                      },
                      description: 'Specific components to unfreeze (defaults to all if not specified)',
                      example: ['token_minting', 'shop_purchases']
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Emergency freeze lifted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: '✅ Emergency freeze lifted successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          action: { type: 'string', example: 'emergency_unfreeze' },
                          auditId: { type: 'number', example: 124 },
                          reason: { type: 'string' },
                          adminAddress: { type: 'string' },
                          componentsAffected: {
                            type: 'array',
                            items: { type: 'string' }
                          },
                          timestamp: { type: 'string', format: 'date-time' },
                          status: { type: 'string', example: 'All systems operational' }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - admin authentication required'
            },
            500: {
              description: 'Emergency unfreeze partially failed'
            }
          }
        }
      },

      '/api/admin/treasury/freeze-status': {
        get: {
          tags: ['Admin'],
          summary: 'Get system freeze status',
          description: 'Check current freeze status of all system components',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'System freeze status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          isFrozen: {
                            type: 'boolean',
                            description: 'Whether any component is currently frozen',
                            example: false
                          },
                          frozenComponents: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of currently frozen components',
                            example: []
                          },
                          systemStatus: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                component: { type: 'string', example: 'token_minting' },
                                is_frozen: { type: 'boolean', example: false },
                                frozen_at: { type: 'string', format: 'date-time', nullable: true },
                                frozen_by: { type: 'string', nullable: true },
                                freeze_reason: { type: 'string', nullable: true }
                              }
                            }
                          },
                          recentAuditHistory: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'number' },
                                action_type: { type: 'string', enum: ['freeze', 'unfreeze'] },
                                reason: { type: 'string' },
                                admin_address: { type: 'string' },
                                timestamp: { type: 'string', format: 'date-time' }
                              }
                            }
                          },
                          activeAlerts: {
                            type: 'number',
                            description: 'Number of active administrator alerts',
                            example: 0
                          },
                          lastFreezeAction: {
                            type: 'object',
                            nullable: true,
                            description: 'Most recent freeze/unfreeze action'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - admin authentication required'
            }
          }
        }
      },

      '/api/admin/treasury/freeze-audit': {
        get: {
          tags: ['Admin'],
          summary: 'Get emergency freeze audit history',
          description: 'Retrieve complete audit trail of all emergency freeze and unfreeze actions',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Maximum number of audit records to return',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 50
              }
            }
          ],
          responses: {
            200: {
              description: 'Emergency freeze audit history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          auditHistory: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'number', example: 123 },
                                action_type: {
                                  type: 'string',
                                  enum: ['freeze', 'unfreeze'],
                                  example: 'freeze'
                                },
                                reason: {
                                  type: 'string',
                                  example: 'Suspicious transaction activity detected'
                                },
                                admin_address: {
                                  type: 'string',
                                  pattern: '^0x[a-fA-F0-9]{40}$',
                                  example: '0x1234567890123456789012345678901234567890'
                                },
                                timestamp: {
                                  type: 'string',
                                  format: 'date-time',
                                  example: '2025-10-24T14:30:00Z'
                                }
                              }
                            }
                          },
                          total: {
                            type: 'number',
                            description: 'Total number of audit records returned',
                            example: 25
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - admin authentication required'
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
      },

      '/api/referrals/rcn-breakdown': {
        get: {
          tags: ['Referrals'],
          summary: 'Get RCN breakdown by source',
          description: 'Get customer RCN breakdown by earning source',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'RCN breakdown data'
            }
          }
        }
      },

      '/api/referrals/verify-redemption': {
        post: {
          tags: ['Referrals'],
          summary: 'Verify redemption eligibility',
          description: 'Verify if customer can redeem at shop',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerAddress', 'shopId', 'amount'],
                  properties: {
                    customerAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Verification result'
            }
          }
        }
      },

      // Authentication - Additional endpoints
      '/api/auth/profile': {
        post: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          description: 'Get detailed profile information for authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'User profile retrieved'
            }
          }
        }
      },

      '/api/auth/session': {
        get: {
          tags: ['Authentication'],
          summary: 'Validate session',
          description: 'Validate current session and return user info',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Session valid'
            }
          }
        }
      },

      // Health - Additional endpoints
      '/api/health/database': {
        get: {
          tags: ['System'],
          summary: 'Database health check',
          description: 'Check database connection and health',
          responses: {
            200: {
              description: 'Database is healthy'
            }
          }
        }
      },

      '/api/health/blockchain': {
        get: {
          tags: ['System'],
          summary: 'Blockchain health check',
          description: 'Check blockchain connection and contract status',
          responses: {
            200: {
              description: 'Blockchain is healthy'
            }
          }
        }
      },

      // Customer - Balance Management
      '/api/customers/shops': {
        get: {
          tags: ['Customers'],
          summary: 'Get shops for QR code generation',
          description: 'Get list of shops for customer QR code generation',
          responses: {
            200: {
              description: 'Shop list'
            }
          }
        }
      },

      '/api/customers/{address}/request-unsuspend': {
        post: {
          tags: ['Customers'],
          summary: 'Request unsuspension',
          description: 'Request account unsuspension (rate limited)',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Unsuspend request submitted'
            }
          }
        }
      },

      '/api/customers/{address}/balance': {
        get: {
          tags: ['Customers'],
          summary: 'Get enhanced balance information',
          description: 'Get customer enhanced balance with breakdown',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Balance information'
            }
          }
        }
      },

      '/api/customers/{address}/queue-mint': {
        post: {
          tags: ['Customers'],
          summary: 'Queue balance for minting',
          description: 'Queue customer balance for minting to wallet',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Mint queued successfully'
            }
          }
        }
      },

      '/api/customers/{address}/sync': {
        post: {
          tags: ['Customers'],
          summary: 'Sync balance with transactions',
          description: 'Synchronize customer balance with transaction history',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Balance synchronized'
            }
          }
        }
      },

      '/api/customers/pending-mints': {
        get: {
          tags: ['Customers'],
          summary: 'Get customers with pending mints',
          description: 'Get list of customers with pending mint requests',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Pending mints list'
            }
          }
        }
      },

      '/api/customers/statistics': {
        get: {
          tags: ['Customers'],
          summary: 'Get balance statistics',
          description: 'Get platform-wide balance statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Balance statistics'
            }
          }
        }
      },

      // Customer - Cross-Shop Redemption
      '/api/customers/cross-shop/verify': {
        post: {
          tags: ['Customers'],
          summary: 'Verify cross-shop redemption',
          description: 'Verify cross-shop redemption eligibility',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerAddress', 'shopId', 'amount'],
                  properties: {
                    customerAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Verification result'
            }
          }
        }
      },

      '/api/customers/cross-shop/balance/{customerAddress}': {
        get: {
          tags: ['Customers'],
          summary: 'Get cross-shop balance breakdown',
          description: 'Get customer cross-shop balance breakdown by shop',
          parameters: [
            {
              name: 'customerAddress',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Balance breakdown'
            }
          }
        }
      },

      '/api/customers/cross-shop/process': {
        post: {
          tags: ['Customers'],
          summary: 'Process cross-shop redemption',
          description: 'Process approved cross-shop redemption',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Redemption processed'
            }
          }
        }
      },

      '/api/customers/cross-shop/history/{customerAddress}': {
        get: {
          tags: ['Customers'],
          summary: 'Get cross-shop verification history',
          description: 'Get customer cross-shop verification history',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'customerAddress',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Verification history'
            }
          }
        }
      },

      '/api/customers/cross-shop/stats/network': {
        get: {
          tags: ['Customers'],
          summary: 'Get network cross-shop statistics',
          description: 'Get network-wide cross-shop redemption statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Network statistics'
            }
          }
        }
      },

      '/api/customers/{address}/export': {
        get: {
          tags: ['Customers'],
          summary: 'Export customer data',
          description: 'Export customer data as JSON or CSV',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            },
            {
              name: 'format',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['json', 'csv'],
                default: 'json'
              }
            }
          ],
          responses: {
            200: {
              description: 'Customer data export'
            }
          }
        }
      },

      // Notification endpoints (entire domain missing)
      '/api/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get notifications',
          description: 'Get paginated notifications for authenticated user',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 }
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 }
            }
          ],
          responses: {
            200: {
              description: 'Notification list'
            }
          }
        },
        delete: {
          tags: ['Notifications'],
          summary: 'Delete all notifications',
          description: 'Delete all notifications for authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All notifications deleted'
            }
          }
        }
      },

      '/api/notifications/unread': {
        get: {
          tags: ['Notifications'],
          summary: 'Get unread notifications',
          description: 'Get all unread notifications',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Unread notifications'
            }
          }
        }
      },

      '/api/notifications/unread/count': {
        get: {
          tags: ['Notifications'],
          summary: 'Get unread count',
          description: 'Get count of unread notifications',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Unread count'
            }
          }
        }
      },

      '/api/notifications/{id}': {
        get: {
          tags: ['Notifications'],
          summary: 'Get notification by ID',
          description: 'Get specific notification details',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Notification details'
            }
          }
        },
        delete: {
          tags: ['Notifications'],
          summary: 'Delete notification',
          description: 'Delete specific notification',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Notification deleted'
            }
          }
        }
      },

      '/api/notifications/{id}/read': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark notification as read',
          description: 'Mark specific notification as read',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Notification marked as read'
            }
          }
        }
      },

      '/api/notifications/read-all': {
        patch: {
          tags: ['Notifications'],
          summary: 'Mark all as read',
          description: 'Mark all notifications as read',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All notifications marked as read'
            }
          }
        }
      },

      // Shop - Additional endpoints
      '/api/shops/{shopId}/details': {
        put: {
          tags: ['Shops'],
          summary: 'Update shop details',
          description: 'Update detailed shop information',
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
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    website: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Shop details updated'
            }
          }
        }
      },

      '/api/shops/{shopId}/analytics': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop analytics',
          description: 'Get detailed analytics for shop',
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
              description: 'Shop analytics'
            }
          }
        }
      },

      '/api/shops/{shopId}/cross-shop': {
        post: {
          tags: ['Shops'],
          summary: 'Enable/disable cross-shop',
          description: 'Enable or disable cross-shop redemption',
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
                    enabled: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Cross-shop setting updated'
            }
          }
        }
      },

      '/api/shops/admin/pending': {
        get: {
          tags: ['Shops'],
          summary: 'Get pending shops',
          description: 'Get all pending shop applications (admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Pending shop list'
            }
          }
        }
      },

      '/api/shops/{shopId}/customers': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop customers',
          description: 'Get all customers associated with shop',
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
              description: 'Customer list'
            }
          }
        }
      },

      '/api/shops/{shopId}/customer-growth': {
        get: {
          tags: ['Shops'],
          summary: 'Get customer growth metrics',
          description: 'Get customer growth and retention metrics',
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
              description: 'Customer growth metrics'
            }
          }
        }
      },

      '/api/shops/{shopId}/qr-code': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop QR code',
          description: 'Generate QR code for shop',
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
              description: 'QR code data'
            }
          }
        }
      },

      '/api/shops/{shopId}/reimbursement-address': {
        put: {
          tags: ['Shops'],
          summary: 'Update reimbursement address',
          description: 'Update shop reimbursement wallet address',
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
                    reimbursementAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Reimbursement address updated'
            }
          }
        }
      },

      '/api/shops/{shopId}/purchases': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop purchases',
          description: 'Get RCN purchase history for shop',
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
              description: 'Purchase history'
            }
          }
        }
      },

      // Shop Purchase endpoints
      '/api/shops/purchase/initiate': {
        post: {
          tags: ['Shops'],
          summary: 'Initiate RCN purchase',
          description: 'Initiate shop RCN purchase transaction',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['shopId', 'amount'],
                  properties: {
                    shopId: { type: 'string' },
                    amount: { type: 'number' },
                    paymentMethod: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Purchase initiated'
            }
          }
        }
      },

      '/api/shops/purchase/complete': {
        post: {
          tags: ['Shops'],
          summary: 'Complete RCN purchase',
          description: 'Complete RCN purchase after payment',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['purchaseId'],
                  properties: {
                    purchaseId: { type: 'string' },
                    txHash: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Purchase completed'
            }
          }
        }
      },

      '/api/shops/purchase/balance/{shopId}': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop RCN balance',
          description: 'Get current RCN balance for shop',
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
              description: 'Shop balance'
            }
          }
        }
      },

      '/api/shops/purchase/history/{shopId}': {
        get: {
          tags: ['Shops'],
          summary: 'Get purchase history',
          description: 'Get RCN purchase history for shop',
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
              description: 'Purchase history'
            }
          }
        }
      },

      '/api/shops/purchase/stripe-checkout': {
        post: {
          tags: ['Shops'],
          summary: 'Create Stripe checkout',
          description: 'Create Stripe checkout session for RCN purchase',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['shopId', 'amount'],
                  properties: {
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Checkout session created'
            }
          }
        }
      },

      '/api/shops/purchase/{purchaseId}/continue': {
        post: {
          tags: ['Shops'],
          summary: 'Continue pending purchase',
          description: 'Continue a pending RCN purchase',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'purchaseId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Purchase continued'
            }
          }
        }
      },

      // Shop Subscription endpoints
      '/api/shops/subscription/status': {
        get: {
          tags: ['Shops'],
          summary: 'Get subscription status',
          description: 'Get shop subscription status (commitment program)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Subscription status'
            }
          }
        }
      },

      '/api/shops/subscription/sync': {
        post: {
          tags: ['Shops'],
          summary: 'Sync subscription status',
          description: 'Sync subscription status with Stripe',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Subscription synced'
            }
          }
        }
      },

      '/api/shops/subscription/subscribe': {
        post: {
          tags: ['Shops'],
          summary: 'Subscribe to commitment program',
          description: 'Subscribe shop to commitment program',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plan: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Subscription created'
            }
          }
        }
      },

      '/api/shops/subscription/cancel': {
        post: {
          tags: ['Shops'],
          summary: 'Cancel subscription',
          description: 'Cancel shop subscription',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Subscription canceled'
            }
          }
        }
      },

      // Token - Additional endpoints
      '/api/tokens/balance/{address}': {
        get: {
          tags: ['Tokens'],
          summary: 'Get token balance',
          description: 'Get token balance for address',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Token balance'
            }
          }
        }
      },

      '/api/tokens/redemption-session/cancel': {
        post: {
          tags: ['Tokens'],
          summary: 'Cancel redemption session',
          description: 'Cancel pending redemption session',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Session canceled'
            }
          }
        }
      },

      '/api/tokens/redemption-session/status/{sessionId}': {
        get: {
          tags: ['Tokens'],
          summary: 'Get session status',
          description: 'Get redemption session status',
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
              description: 'Session status'
            }
          }
        }
      },

      '/api/tokens/transfer': {
        post: {
          tags: ['Tokens'],
          summary: 'Transfer tokens',
          description: 'Transfer tokens between addresses',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['from', 'to', 'amount'],
                  properties: {
                    from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Transfer successful'
            }
          }
        }
      },

      '/api/tokens/transfer-history/{address}': {
        get: {
          tags: ['Tokens'],
          summary: 'Get transfer history',
          description: 'Get token transfer history for address',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          ],
          responses: {
            200: {
              description: 'Transfer history'
            }
          }
        }
      },

      '/api/tokens/validate-transfer': {
        post: {
          tags: ['Tokens'],
          summary: 'Validate transfer',
          description: 'Validate token transfer before execution',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['from', 'to', 'amount'],
                  properties: {
                    from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Validation result'
            }
          }
        }
      },

      // Webhook - Additional endpoints
      '/api/webhooks/retry/{webhookId}': {
        post: {
          tags: ['Webhooks'],
          summary: 'Retry failed webhook',
          description: 'Retry processing of failed webhook',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'webhookId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Webhook retried'
            }
          }
        }
      },

      '/api/webhooks/stats': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook statistics',
          description: 'Get webhook processing statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Webhook statistics'
            }
          }
        }
      },

      '/api/webhooks/health': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook health',
          description: 'Get webhook system health status',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Webhook health'
            }
          }
        }
      },

      '/api/webhooks/rate-limit/reset': {
        post: {
          tags: ['Webhooks'],
          summary: 'Reset rate limit',
          description: 'Reset webhook rate limit counter',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Rate limit reset'
            }
          }
        }
      },

      '/api/webhooks/rate-limit/status': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get rate limit status',
          description: 'Get current webhook rate limit status',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Rate limit status'
            }
          }
        }
      },

      // ========================================
      // MISSING ADMIN ENDPOINTS (62 endpoints)
      // ========================================

      '/api/admin/me': {
        get: {
          tags: ['Admin'],
          summary: 'Get current admin profile',
          description: 'Get profile of currently authenticated admin',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Admin profile' }
          }
        }
      },

      '/api/admin/admins': {
        get: {
          tags: ['Admin'],
          summary: 'List all admins',
          description: 'Get list of all admin users (super admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Admin list' }
          }
        }
      },

      '/api/admin/admins/{adminId}': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin by ID',
          description: 'Get specific admin details',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'adminId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Admin details' }
          }
        },
        put: {
          tags: ['Admin'],
          summary: 'Update admin',
          description: 'Update admin information (super admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'adminId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Admin updated' }
          }
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete admin',
          description: 'Delete admin user (super admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'adminId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Admin deleted' }
          }
        }
      },

      '/api/admin/admins/{adminId}/permissions': {
        put: {
          tags: ['Admin'],
          summary: 'Update admin permissions',
          description: 'Update admin permission levels (super admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'adminId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    permissions: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Permissions updated' }
          }
        }
      },

      '/api/admin/customers/{address}/suspend': {
        post: {
          tags: ['Admin'],
          summary: 'Suspend customer',
          description: 'Suspend customer account',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Customer suspended' }
          }
        }
      },

      '/api/admin/customers/{address}/unsuspend': {
        post: {
          tags: ['Admin'],
          summary: 'Unsuspend customer',
          description: 'Reactivate suspended customer account',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } }],
          responses: {
            200: { description: 'Customer unsuspended' }
          }
        }
      },

      '/api/admin/shops/{shopId}/suspend': {
        post: {
          tags: ['Admin'],
          summary: 'Suspend shop',
          description: 'Suspend shop account',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Shop suspended' }
          }
        }
      },

      '/api/admin/shops/{shopId}/unsuspend': {
        post: {
          tags: ['Admin'],
          summary: 'Unsuspend shop',
          description: 'Reactivate suspended shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Shop unsuspended' }
          }
        }
      },

      '/api/admin/shops/{shopId}/sell-rcn': {
        post: {
          tags: ['Admin'],
          summary: 'Sell RCN to shop',
          description: 'Admin endpoint to sell RCN tokens to shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'price'],
                  properties: {
                    amount: { type: 'number' },
                    price: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'RCN sold to shop' }
          }
        }
      },

      '/api/admin/shops/{shopId}/mint-balance': {
        post: {
          tags: ['Admin'],
          summary: 'Mint shop balance',
          description: 'Manually mint purchased RCN balance to blockchain',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Balance minted' }
          }
        }
      },

      '/api/admin/shops/{shopId}/complete-purchase/{purchaseId}': {
        post: {
          tags: ['Admin'],
          summary: 'Force complete purchase',
          description: 'Manually complete pending RCN purchase',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'shopId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'purchaseId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Purchase completed' }
          }
        }
      },

      '/api/admin/shops/pending-mints': {
        get: {
          tags: ['Admin'],
          summary: 'Get shops with pending mints',
          description: 'Get all shops with pending mint requests',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Pending mints list' }
          }
        }
      },

      '/api/admin/unsuspend-requests': {
        get: {
          tags: ['Admin'],
          summary: 'Get unsuspend requests',
          description: 'Get all pending unsuspend requests',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Unsuspend requests list' }
          }
        }
      },

      '/api/admin/unsuspend-requests/{requestId}/approve': {
        post: {
          tags: ['Admin'],
          summary: 'Approve unsuspend request',
          description: 'Approve customer unsuspend request',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Request approved' }
          }
        }
      },

      '/api/admin/unsuspend-requests/{requestId}/reject': {
        post: {
          tags: ['Admin'],
          summary: 'Reject unsuspend request',
          description: 'Reject customer unsuspend request',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Request rejected' }
          }
        }
      },

      '/api/admin/debug/all-shops-purchases': {
        get: {
          tags: ['Admin'],
          summary: 'Debug: All shop purchases',
          description: 'View all shop purchases for debugging',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'All shop purchases' }
          }
        }
      },

      '/api/admin/debug/pending-mints/{shopId}': {
        get: {
          tags: ['Admin'],
          summary: 'Debug: Shop pending mints',
          description: 'View pending mints for specific shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Pending mints for shop' }
          }
        }
      },

      '/api/admin/debug/purchase-status/{shopId}': {
        get: {
          tags: ['Admin'],
          summary: 'Debug: Purchase status',
          description: 'Check purchase status for shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Purchase status' }
          }
        }
      },

      '/api/admin/maintenance/cleanup-webhooks': {
        post: {
          tags: ['Admin'],
          summary: 'Cleanup webhooks',
          description: 'Clean up old webhook logs',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Webhooks cleaned up' }
          }
        }
      },

      '/api/admin/maintenance/archive-transactions': {
        post: {
          tags: ['Admin'],
          summary: 'Archive transactions',
          description: 'Archive old transactions',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    beforeDate: { type: 'string', format: 'date' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Transactions archived' }
          }
        }
      },

      '/api/admin/monitoring/status': {
        get: {
          tags: ['Admin'],
          summary: 'Get monitoring status',
          description: 'Get system monitoring status',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Monitoring status' }
          }
        }
      },

      '/api/admin/monitoring/check': {
        post: {
          tags: ['Admin'],
          summary: 'Run monitoring check',
          description: 'Manually trigger monitoring check',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Monitoring check completed' }
          }
        }
      },

      '/api/admin/monitoring/test-alert': {
        post: {
          tags: ['Admin'],
          summary: 'Send test alert',
          description: 'Send test monitoring alert (super admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Test alert sent' }
          }
        }
      },

      '/api/admin/platform-statistics': {
        get: {
          tags: ['Admin'],
          summary: 'Platform statistics',
          description: 'Get comprehensive platform statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Platform statistics' }
          }
        }
      },

      '/api/admin/token-circulation': {
        get: {
          tags: ['Admin'],
          summary: 'Token circulation',
          description: 'Get token circulation metrics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Token circulation data' }
          }
        }
      },

      '/api/admin/shop-rankings': {
        get: {
          tags: ['Admin'],
          summary: 'Shop rankings',
          description: 'Get shop performance rankings',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Shop rankings' }
          }
        }
      },

      '/api/admin/activity-logs': {
        get: {
          tags: ['Admin'],
          summary: 'Activity logs',
          description: 'Get admin activity logs',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Activity logs' }
          }
        }
      },

      '/api/admin/alerts': {
        get: {
          tags: ['Admin'],
          summary: 'Get alerts',
          description: 'Get system alerts',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'System alerts' }
          }
        }
      },

      '/api/admin/alerts/{id}/read': {
        put: {
          tags: ['Admin'],
          summary: 'Mark alert as read',
          description: 'Mark specific alert as read',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Alert marked as read' }
          }
        }
      },

      '/api/admin/alerts/{id}/resolve': {
        put: {
          tags: ['Admin'],
          summary: 'Resolve alert',
          description: 'Resolve system alert',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Alert resolved' }
          }
        }
      },

      '/api/admin/treasury/rcg': {
        get: {
          tags: ['Admin'],
          summary: 'RCG treasury info',
          description: 'Get RCG token treasury information',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'RCG treasury data' }
          }
        }
      },

      '/api/admin/treasury/update-shop-tier/{shopId}': {
        post: {
          tags: ['Admin'],
          summary: 'Update shop tier',
          description: 'Update shop tier based on RCG holdings',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Shop tier updated' }
          }
        }
      },

      '/api/admin/treasury/admin-wallet': {
        get: {
          tags: ['Admin'],
          summary: 'Admin wallet info',
          description: 'Get admin wallet information',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Admin wallet info' }
          }
        }
      },

      '/api/admin/treasury/debug/{shopId}': {
        get: {
          tags: ['Admin'],
          summary: 'Treasury debug',
          description: 'Debug treasury data for shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Treasury debug data' }
          }
        }
      },

      '/api/admin/treasury/discrepancies': {
        get: {
          tags: ['Admin'],
          summary: 'Find discrepancies',
          description: 'Find token balance discrepancies',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Discrepancy list' }
          }
        }
      },

      '/api/admin/treasury/manual-transfer': {
        post: {
          tags: ['Admin'],
          summary: 'Manual transfer',
          description: 'Manually transfer tokens to fix discrepancies',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address', 'amount'],
                  properties: {
                    address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    amount: { type: 'number' },
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Transfer completed' }
          }
        }
      },

      '/api/admin/treasury/stats-with-warnings': {
        get: {
          tags: ['Admin'],
          summary: 'Treasury stats with warnings',
          description: 'Get treasury statistics with discrepancy warnings',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Treasury stats with warnings' }
          }
        }
      },

      '/api/admin/treasury/mint-bulk': {
        post: {
          tags: ['Admin'],
          summary: 'Bulk mint tokens',
          description: 'Bulk mint tokens for campaigns',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['recipients'],
                  properties: {
                    recipients: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          address: { type: 'string' },
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
            200: { description: 'Bulk mint completed' }
          }
        }
      },

      '/api/admin/treasury/analytics': {
        get: {
          tags: ['Admin'],
          summary: 'Treasury analytics',
          description: 'Get treasury financial analytics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Treasury analytics' }
          }
        }
      },

      '/api/admin/treasury/adjust-pricing': {
        post: {
          tags: ['Admin'],
          summary: 'Adjust pricing',
          description: 'Adjust token tier pricing',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tier: { type: 'string' },
                    price: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Pricing adjusted' }
          }
        }
      },

      '/api/admin/treasury/pricing': {
        get: {
          tags: ['Admin'],
          summary: 'Get pricing',
          description: 'Get current tier pricing',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Current pricing' }
          }
        }
      },

      '/api/admin/treasury/pricing/history': {
        get: {
          tags: ['Admin'],
          summary: 'Pricing history',
          description: 'Get pricing change history',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Pricing history' }
          }
        }
      },

      '/api/admin/subscriptions': {
        get: {
          tags: ['Admin'],
          summary: 'Get all subscriptions',
          description: 'View all shop subscriptions',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Subscriptions list' }
          }
        }
      },

      '/api/admin/subscriptions/stats': {
        get: {
          tags: ['Admin'],
          summary: 'Subscription stats',
          description: 'Get subscription statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Subscription statistics' }
          }
        }
      },

      '/api/admin/subscriptions/{subscriptionId}': {
        get: {
          tags: ['Admin'],
          summary: 'Get subscription',
          description: 'Get subscription details',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Subscription details' }
          }
        }
      },

      '/api/admin/subscriptions/{subscriptionId}/cancel': {
        post: {
          tags: ['Admin'],
          summary: 'Cancel subscription',
          description: 'Admin cancel shop subscription',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Subscription canceled' }
          }
        }
      },

      '/api/admin/subscriptions/{subscriptionId}/reactivate': {
        post: {
          tags: ['Admin'],
          summary: 'Reactivate subscription',
          description: 'Reactivate canceled subscription',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Subscription reactivated' }
          }
        }
      },

      '/api/admin/system/blockchain-minting': {
        get: {
          tags: ['Admin'],
          summary: 'Get blockchain minting status',
          description: 'Check if blockchain minting is enabled',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Minting status' }
          }
        },
        post: {
          tags: ['Admin'],
          summary: 'Toggle blockchain minting',
          description: 'Enable or disable blockchain minting',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Minting toggled' }
          }
        }
      },

      '/api/admin/customers/grouped-by-shop': {
        get: {
          tags: ['Admin'],
          summary: 'Customers grouped by shop',
          description: 'Get customers grouped by their associated shops',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Grouped customers' }
          }
        }
      },

      '/api/admin/customers/without-shops': {
        get: {
          tags: ['Admin'],
          summary: 'Customers without shops',
          description: 'Get customers with no shop transactions',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Customers without shops' }
          }
        }
      },

      '/api/admin/shops/{shopId}/update-rcg-balance': {
        post: {
          tags: ['Admin'],
          summary: 'Update RCG balance',
          description: 'Manually update shop RCG balance (for testing/correction)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    balance: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'RCG balance updated' }
          }
        }
      },

      '/api/admin/promo-codes': {
        get: {
          tags: ['Admin'],
          summary: 'Get all promo codes',
          description: 'Get all promo codes (admin view)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Promo codes list' }
          }
        }
      },

      '/api/admin/promo-codes/analytics': {
        get: {
          tags: ['Admin'],
          summary: 'Promo code analytics',
          description: 'Get promo code usage analytics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Promo code analytics' }
          }
        }
      },

      '/api/admin/contract/status': {
        get: {
          tags: ['Admin'],
          summary: 'Contract status',
          description: 'Get smart contract status',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Contract status' }
          }
        }
      },

      '/api/admin/contract/pause': {
        post: {
          tags: ['Admin'],
          summary: 'Pause contract',
          description: 'Pause smart contract operations (super admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Contract paused' }
          }
        }
      },

      '/api/admin/contract/unpause': {
        post: {
          tags: ['Admin'],
          summary: 'Unpause contract',
          description: 'Resume smart contract operations (super admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Contract unpaused' }
          }
        }
      },

      '/api/admin/contract/emergency-stop': {
        post: {
          tags: ['Admin'],
          summary: 'Emergency stop',
          description: 'Emergency stop mechanism for contract (super admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Emergency stop activated' }
          }
        }
      },

      '/api/admin/contract/manual-redemption': {
        post: {
          tags: ['Admin'],
          summary: 'Manual redemption',
          description: 'Manually process redemption',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customerAddress: { type: 'string' },
                    shopId: { type: 'string' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Redemption processed' }
          }
        }
      },

      '/api/admin/webhooks/failed': {
        get: {
          tags: ['Admin'],
          summary: 'Get failed webhooks',
          description: 'Get list of failed webhook attempts',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Failed webhooks list' }
          }
        }
      },

      // ========================================
      // MISSING SHOP ENDPOINTS (28 endpoints)
      // ========================================

      '/api/shops/{shopId}/deactivate': {
        post: {
          tags: ['Shops'],
          summary: 'Deactivate shop',
          description: 'Deactivate shop account',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Shop deactivated' }
          }
        }
      },

      '/api/shops/webhooks/stripe': {
        post: {
          tags: ['Shops'],
          summary: 'Stripe webhook handler',
          description: 'Handle Stripe webhook events for shop payments',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          responses: {
            200: { description: 'Webhook processed' }
          }
        }
      },

      '/api/shops/tier-bonus/issue': {
        post: {
          tags: ['Shops'],
          summary: 'Issue tier bonus',
          description: 'Issue tier bonus to customer',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customerAddress: { type: 'string' },
                    shopId: { type: 'string' },
                    bonus: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Tier bonus issued' }
          }
        }
      },

      '/api/shops/tier-bonus/history/{shopId}': {
        get: {
          tags: ['Shops'],
          summary: 'Tier bonus history',
          description: 'Get tier bonus issuance history',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Tier bonus history' }
          }
        }
      },

      '/api/shops/deposit/info': {
        get: {
          tags: ['Shops'],
          summary: 'Deposit info',
          description: 'Get RCN deposit information',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Deposit info' }
          }
        }
      },

      '/api/shops/deposit': {
        post: {
          tags: ['Shops'],
          summary: 'Deposit RCN',
          description: 'Deposit RCN tokens',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number' },
                    shopId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Deposit successful' }
          }
        }
      },

      '/api/shops/deposit/history': {
        get: {
          tags: ['Shops'],
          summary: 'Deposit history',
          description: 'Get RCN deposit history',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Deposit history' }
          }
        }
      },

      '/api/shops/purchase-sync/check-payment/{purchaseId}': {
        post: {
          tags: ['Shops'],
          summary: 'Check payment status',
          description: 'Check payment status for purchase',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'purchaseId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Payment status' }
          }
        }
      },

      '/api/shops/purchase-sync/pending': {
        get: {
          tags: ['Shops'],
          summary: 'Get pending purchases',
          description: 'Get all pending purchases',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Pending purchases' }
          }
        }
      },

      '/api/shops/purchase-sync/manual-complete/{purchaseId}': {
        post: {
          tags: ['Shops'],
          summary: 'Manually complete purchase',
          description: 'Manually complete pending purchase',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'purchaseId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Purchase completed' }
          }
        }
      },

      '/api/shops/{shopId}/promo-codes': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop promo codes',
          description: 'Get all promo codes for shop',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Promo codes list' }
          }
        },
        post: {
          tags: ['Shops'],
          summary: 'Create promo code',
          description: 'Create new promo code',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    discount: { type: 'number' },
                    expiresAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: 'Promo code created' }
          }
        }
      },

      '/api/shops/{shopId}/promo-codes/{codeId}': {
        get: {
          tags: ['Shops'],
          summary: 'Get promo code',
          description: 'Get specific promo code details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'shopId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'codeId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Promo code details' }
          }
        },
        put: {
          tags: ['Shops'],
          summary: 'Update promo code',
          description: 'Update promo code',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'shopId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'codeId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    discount: { type: 'number' },
                    expiresAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Promo code updated' }
          }
        },
        delete: {
          tags: ['Shops'],
          summary: 'Delete promo code',
          description: 'Delete promo code',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'shopId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'codeId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Promo code deleted' }
          }
        }
      },

      '/api/shops/{shopId}/promo-codes/{codeId}/activate': {
        post: {
          tags: ['Shops'],
          summary: 'Activate promo code',
          description: 'Activate promo code',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'shopId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'codeId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            200: { description: 'Promo code activated' }
          }
        }
      },

      '/api/shops/{shopId}/promo-codes/analytics': {
        get: {
          tags: ['Shops'],
          summary: 'Promo code analytics',
          description: 'Get promo code usage analytics',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Promo code analytics' }
          }
        }
      },

      '/api/shops/{shopId}/promo-codes/usage-history': {
        get: {
          tags: ['Shops'],
          summary: 'Promo code usage history',
          description: 'Get promo code usage history',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Usage history' }
          }
        }
      },

      '/api/shops/rcg/{shopId}/rcg-info': {
        get: {
          tags: ['Shops'],
          summary: 'Get RCG info',
          description: 'Get shop RCG token information',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'RCG info' }
          }
        }
      },

      // ========================================
      // MISSING TOKEN ENDPOINTS (8 endpoints)
      // ========================================

      '/api/tokens/approve': {
        post: {
          tags: ['Tokens'],
          summary: 'Approve redemption session',
          description: 'Customer approves redemption session',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Session approved' }
          }
        }
      },

      '/api/tokens/reject': {
        post: {
          tags: ['Tokens'],
          summary: 'Reject redemption session',
          description: 'Customer rejects redemption session',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Session rejected' }
          }
        }
      },

      '/api/tokens/my-sessions': {
        get: {
          tags: ['Tokens'],
          summary: 'Get my sessions',
          description: 'Get redemption sessions for authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User sessions' }
          }
        }
      },

      // ========================================
      // MISSING MISC ENDPOINTS (5 endpoints)
      // ========================================

      '/api/auth/token': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate JWT token',
          description: 'Generate JWT token for authenticated users',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    role: { type: 'string', enum: ['admin', 'shop', 'customer'] }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Token generated' }
          }
        }
      },

      '/api/metrics': {
        get: {
          tags: ['System'],
          summary: 'System metrics',
          description: 'Get system metrics (admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'System metrics' }
          }
        }
      },

      '/api/setup/init-database/{secret}': {
        post: {
          tags: ['System'],
          summary: 'Initialize database',
          description: 'One-time database initialization (requires secret)',
          parameters: [{ name: 'secret', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Database initialized' }
          }
        }
      },

      '/api/customers/history/{customerAddress}': {
        get: {
          tags: ['Customers'],
          summary: 'Customer history',
          description: 'Get customer transaction history by address',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'customerAddress', in: 'path', required: true, schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } }],
          responses: {
            200: { description: 'Customer history' }
          }
        }
      },

      '/api/customers/network': {
        get: {
          tags: ['Customers'],
          summary: 'Customer network stats',
          description: 'Get customer network statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Network statistics' }
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
        description: 'Administrative operations including platform management, analytics, treasury controls, and emergency freeze system for security incident response'
      },
      {
        name: 'Referrals',
        description: 'Referral system operations'
      },
      {
        name: 'Notifications',
        description: 'Real-time notification management for users'
      },
      {
        name: 'Shop Groups',
        description: 'Shop coalition management - create groups, manage members, and issue custom group tokens/points redeemable within the group'
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