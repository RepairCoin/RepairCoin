# RepairCoin API Documentation

## Quick Start

### 1. Start the development server
```bash
npm run dev
```

### 2. View API Documentation
```bash
# Open documentation in browser
npm run docs:open

# Or manually visit:
# http://localhost:3000/api-docs
```

### 3. Access OpenAPI JSON
```bash
# Get raw OpenAPI spec
npm run docs:json

# Or visit:
# http://localhost:3000/api-docs.json
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run docs` | Display documentation URL |
| `npm run docs:open` | Open documentation in browser |
| `npm run docs:json` | Download OpenAPI JSON spec |
| `npm run docs:validate` | Validate OpenAPI spec (requires swagger-codegen) |
| `npm run dev:docs` | Start dev server and open docs |

## API Endpoints

### Core Endpoints
- **Health**: `/api/health` - System health checks
- **Shops**: `/api/shops` - Shop management
- **Customers**: `/api/customers` - Customer management  
- **Webhooks**: `/api/webhooks` - Webhook processing
- **Admin**: `/api/admin` - Administrative functions

### Documentation
- **Swagger UI**: `/api-docs` - Interactive API documentation
- **OpenAPI JSON**: `/api-docs.json` - Raw OpenAPI 3.0 specification

## Authentication

Most endpoints require JWT authentication:

```bash
# Get token from login endpoint (implement as needed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x..."}'

# Use token in subsequent requests
curl -X GET http://localhost:3000/api/customers/0x... \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Webhook Security

Webhooks use HMAC SHA256 signatures:

```bash
# Include signature header
curl -X POST http://localhost:3000/api/webhooks/fixflow \
  -H "Content-Type: application/json" \
  -H "X-Fixflow-Signature: sha256=YOUR_SIGNATURE" \
  -d '{"event": "repair_completed", "data": {...}}'
```

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional message",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Testing

Use the Swagger UI "Try it out" feature to test endpoints directly in the browser, or use curl/Postman with the provided examples.

## Development

### Adding New Endpoints

1. Create route documentation in `/src/docs/routes/[domain].ts`
2. Use JSDoc comments with `@swagger` tags
3. Follow OpenAPI 3.0 specification
4. Reference existing schemas in `swagger.ts`

### Example Documentation

```typescript
/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Example endpoint
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
```

## Environment Variables

Required for full functionality:
- `JWT_SECRET` - JWT token secret
- `THIRDWEB_CLIENT_ID` - Thirdweb client ID
- `THIRDWEB_SECRET_KEY` - Thirdweb secret key
- `REPAIRCOIN_CONTRACT_ADDRESS` - Contract address
- `FIXFLOW_WEBHOOK_SECRET` - Webhook signature secret

## Domain Architecture

The API uses a domain-driven architecture:
- **Customer Domain**: Customer management and registration
- **Shop Domain**: Shop operations and management
- **Token Domain**: Token minting and management
- **Webhook Domain**: External webhook processing
- **Admin Domain**: Administrative functions

Each domain has its own controllers, services, and routes for better organization and maintainability.