# RepairCoin Backend

RESTful API server for RepairCoin dual-token ecosystem (RCN utility + RCG governance).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up postgres -d

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## 📁 Architecture

Domain-driven design with modular structure:

```
src/
├── domains/           # Business domains
│   ├── customer/     # Customer management
│   ├── shop/         # Shop operations
│   ├── token/        # Token verification
│   ├── admin/        # Admin functions
│   └── webhook/      # External integrations
├── repositories/     # Data access layer
├── middleware/       # Express middleware
├── migrations/       # Database migrations
└── contracts/        # Blockchain integration
```

## 🔧 Key Features

- **Unlimited RCN Supply**: No cap on token minting
- **Burn on Redemption**: Tokens destroyed when used
- **Dual-Token Support**: RCN (utility) + RCG (governance)
- **Shop Tier Pricing**: Based on RCG holdings
- **Domain Events**: Inter-domain communication
- **JWT Authentication**: Secure API access

## 📊 Database

PostgreSQL with migrations in `src/migrations/`:
- `000_complete_schema.sql` - Full schema
- `002_unlimited_supply.sql` - v3.0 updates

## 🔐 Environment Variables

See `env.example` for required configuration:
- RCN/RCG contract addresses
- Thirdweb credentials
- Database connection
- JWT secrets

## 📧 Email Templates System

Complete email template management with dynamic rendering and admin controls.

**Features**:
- 16 pre-configured templates (welcome, booking, transaction, shop, support)
- Variable replacement with `{{placeholder}}` syntax
- Enable/disable toggles
- Version tracking and audit trail
- Preview and test email functionality

**Documentation**: See [docs/EMAIL_TEMPLATES_SYSTEM.md](./docs/EMAIL_TEMPLATES_SYSTEM.md)

**Quick Example**:
```typescript
import { EmailTemplateService } from './services/EmailTemplateService';

const service = new EmailTemplateService();
const rendered = await service.renderTemplate('customer_welcome', {
  customerName: 'John Doe',
  platformName: 'RepairCoin',
  walletAddress: '0x123...'
});

// rendered.subject: "Welcome to RepairCoin, John Doe!"
// rendered.bodyHtml: Full HTML with variables replaced
```

**API Endpoints**:
- `GET /api/admin/settings/email-templates` - List all templates
- `GET /api/admin/settings/email-templates/:key` - Get single template
- `PUT /api/admin/settings/email-templates/:key` - Update template
- `PUT /api/admin/settings/email-templates/:key/toggle` - Enable/disable
- `POST /api/admin/settings/email-templates/:key/preview` - Preview with data
- `POST /api/admin/settings/email-templates/:key/test` - Send test email

## 📚 API Documentation

Swagger UI available at: http://localhost:4000/api-docs

## 🧪 Testing

```bash
npm test
npm run test:coverage
```