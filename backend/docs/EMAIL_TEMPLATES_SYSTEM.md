# Email Templates System

**Version**: 1.0.0
**Date**: April 20, 2026
**Status**: Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Service Layer](#service-layer)
6. [Template Variables](#template-variables)
7. [Default Templates](#default-templates)
8. [Usage Examples](#usage-examples)
9. [Integration Guide](#integration-guide)
10. [Testing](#testing)
11. [Known Limitations](#known-limitations)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The Email Templates System provides a complete solution for managing, customizing, and sending dynamic emails throughout the RepairCoin platform. The system supports variable replacement, HTML/text rendering, preview functionality, and version tracking.

### Key Features

- **Dynamic Template Management**: Create, read, update, and toggle email templates via REST API
- **Variable Replacement**: Use `{{variableName}}` placeholders for dynamic content
- **Category Organization**: 5 categories (welcome, booking, transaction, shop, support)
- **Version Control**: Track template versions and modification history
- **Preview & Testing**: Preview rendered emails and send test emails
- **Default Templates**: 16 pre-configured templates covering common scenarios
- **Enable/Disable**: Toggle templates on/off without deletion
- **Audit Trail**: Track who modified templates and when

### Technology Stack

- **Database**: PostgreSQL 15 with JSONB for variable storage
- **Backend**: Node.js + Express + TypeScript
- **Service Layer**: EmailTemplateService for business logic
- **API**: RESTful endpoints with JSON responses
- **Frontend**: React components for admin management (separate implementation)

---

## Architecture

### System Components

```
┌─────────────────┐
│  Admin UI       │ (Frontend - React)
│  (Frontend)     │
└────────┬────────┘
         │
         │ HTTP/JSON
         ▼
┌─────────────────────────────────────────┐
│  API Routes                             │
│  /api/admin/settings/email-templates/* │
│  - GET /                                │
│  - GET /:key                            │
│  - PUT /:key                            │
│  - PUT /:key/toggle                     │
│  - POST /:key/preview                   │
│  - POST /:key/test                      │
│  - DELETE /:key (reset)                 │
└────────┬────────────────────────────────┘
         │
         │ Service Calls
         ▼
┌─────────────────────────────────────────┐
│  EmailTemplateService                   │
│  - getTemplates()                       │
│  - getTemplate()                        │
│  - updateTemplate()                     │
│  - toggleTemplate()                     │
│  - renderTemplate()                     │
│  - markAsSent()                         │
└────────┬────────────────────────────────┘
         │
         │ SQL Queries
         ▼
┌─────────────────────────────────────────┐
│  PostgreSQL Database                    │
│  - email_templates table                │
│  - indexes (key, category, enabled)     │
│  - trigger (auto-update timestamp)      │
└─────────────────────────────────────────┘
```

### File Structure

```
backend/
├── migrations/
│   └── 105_create_email_templates.sql       # Database schema + seed data
├── src/
│   ├── services/
│   │   └── EmailTemplateService.ts          # Business logic
│   └── domains/
│       └── admin/
│           └── routes/
│               ├── emailTemplates.ts        # API endpoints
│               └── settings.ts              # Route mounting
└── docs/
    └── EMAIL_TEMPLATES_SYSTEM.md            # This file
```

---

## Database Schema

### Table: `email_templates`

```sql
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('welcome', 'booking', 'transaction', 'shop', 'support')),
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  modified_by VARCHAR(255),
  last_sent_at TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_enabled ON email_templates(enabled);
```

### Triggers

```sql
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `template_key` | VARCHAR(100) | Unique identifier (e.g., 'customer_welcome') |
| `template_name` | VARCHAR(255) | Human-readable name |
| `category` | VARCHAR(50) | One of: welcome, booking, transaction, shop, support |
| `subject` | VARCHAR(255) | Email subject line (supports variables) |
| `body_html` | TEXT | HTML email body (supports variables) |
| `body_text` | TEXT | Plain text version (optional, auto-generated if null) |
| `variables` | JSONB | Array of variable names used in template |
| `enabled` | BOOLEAN | Whether template is active |
| `is_default` | BOOLEAN | True if unmodified from default, false if customized |
| `version` | INTEGER | Increments on each update |
| `created_at` | TIMESTAMP | When template was created |
| `updated_at` | TIMESTAMP | Last modification time (auto-updated) |
| `created_by` | VARCHAR(255) | Wallet address of creator |
| `modified_by` | VARCHAR(255) | Wallet address of last modifier |
| `last_sent_at` | TIMESTAMP | When template was last used |

---

## API Reference

### Base URL

```
/api/admin/settings/email-templates
```

All endpoints require admin authentication (JWT token with admin role).

---

### 1. Get All Templates

**Endpoint**: `GET /api/admin/settings/email-templates`

**Query Parameters**:
- `category` (optional): Filter by category (welcome, booking, transaction, shop, support)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "templateKey": "customer_welcome",
      "templateName": "Customer Welcome Email",
      "category": "welcome",
      "subject": "Welcome to {{platformName}}, {{customerName}}!",
      "bodyHtml": "<html>...</html>",
      "bodyText": "Welcome...",
      "variables": ["customerName", "platformName", "walletAddress"],
      "enabled": true,
      "isDefault": true,
      "version": 1,
      "createdAt": "2026-04-20T00:00:00.000Z",
      "updatedAt": "2026-04-20T00:00:00.000Z",
      "modifiedBy": null,
      "lastSentAt": null
    }
  ]
}
```

**Example**:
```bash
# Get all templates
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:4000/api/admin/settings/email-templates

# Get only welcome templates
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:4000/api/admin/settings/email-templates?category=welcome
```

---

### 2. Get Single Template

**Endpoint**: `GET /api/admin/settings/email-templates/:key`

**Path Parameters**:
- `key`: Template key (e.g., 'customer_welcome')

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "templateKey": "customer_welcome",
    "templateName": "Customer Welcome Email",
    "category": "welcome",
    "subject": "Welcome to {{platformName}}, {{customerName}}!",
    "bodyHtml": "<html>...</html>",
    "bodyText": "Welcome...",
    "variables": ["customerName", "platformName", "walletAddress"],
    "enabled": true,
    "isDefault": true,
    "version": 1,
    "createdAt": "2026-04-20T00:00:00.000Z",
    "updatedAt": "2026-04-20T00:00:00.000Z"
  }
}
```

**Error Response (404)**:
```json
{
  "success": false,
  "error": "Template customer_welcome not found"
}
```

**Example**:
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome
```

---

### 3. Update Template

**Endpoint**: `PUT /api/admin/settings/email-templates/:key`

**Path Parameters**:
- `key`: Template key to update

**Request Body**:
```json
{
  "subject": "New subject with {{customerName}}",
  "bodyHtml": "<html><body>New HTML content with {{variable}}</body></html>",
  "bodyText": "New plain text content"
}
```

**Updatable Fields**:
- `subject` (string)
- `bodyHtml` (string)
- `bodyText` (string, optional)

**Response**:
```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": 1,
    "templateKey": "customer_welcome",
    "isDefault": false,
    "version": 2,
    "modifiedBy": "0x1234...5678",
    "updatedAt": "2026-04-20T10:30:00.000Z"
  }
}
```

**Behavior**:
- Increments `version` by 1
- Sets `is_default` to false
- Sets `modified_by` to admin's wallet address
- Auto-updates `updated_at` timestamp

**Example**:
```bash
curl -X PUT \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Welcome {{customerName}}!","bodyHtml":"<p>Hello {{customerName}}</p>"}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome
```

---

### 4. Toggle Template

**Endpoint**: `PUT /api/admin/settings/email-templates/:key/toggle`

**Path Parameters**:
- `key`: Template key to toggle

**Request Body**:
```json
{
  "enabled": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "Template disabled successfully"
}
```

**Example**:
```bash
# Disable template
curl -X PUT \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/toggle

# Enable template
curl -X PUT \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/toggle
```

---

### 5. Preview Template

**Endpoint**: `POST /api/admin/settings/email-templates/:key/preview`

**Path Parameters**:
- `key`: Template key to preview

**Request Body** (optional):
```json
{
  "sampleData": {
    "customerName": "John Doe",
    "platformName": "RepairCoin",
    "amount": "50.00"
  }
}
```

If `sampleData` is not provided, default sample data will be used.

**Response**:
```json
{
  "success": true,
  "data": {
    "subject": "Welcome to RepairCoin, John Doe!",
    "bodyHtml": "<html><body><h1>Welcome John Doe!</h1>...</body></html>",
    "sampleData": {
      "customerName": "John Doe",
      "platformName": "RepairCoin",
      "amount": "50.00",
      "walletAddress": "0x1234...5678"
    }
  }
}
```

**Default Sample Data**:
```javascript
{
  customerName: 'John Doe',
  shopName: 'RepairShop Pro',
  platformName: 'RepairCoin',
  amount: '50.00',
  amountUsd: '5.00',
  walletAddress: '0x1234...5678',
  serviceName: 'Oil Change',
  bookingDate: new Date().toLocaleDateString(),
  bookingTime: '10:00 AM',
  totalAmount: '75.00',
  transactionId: 'TXN123456',
  newBalance: '125.50',
  shopEmail: 'shop@example.com',
  resetLink: 'https://repaircoin.ai/reset-password?token=abc123',
  expirationTime: '24 hours'
}
```

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sampleData":{"customerName":"Jane Smith","platformName":"RepairCoin"}}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/preview
```

---

### 6. Send Test Email

**Endpoint**: `POST /api/admin/settings/email-templates/:key/test`

**Path Parameters**:
- `key`: Template key to test

**Request Body**:
```json
{
  "recipientEmail": "test@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test email sent to test@example.com",
  "note": "Email service integration pending - email was logged but not actually sent"
}
```

**Validation**:
- Email format validation (must be valid email address)
- Template must exist and be enabled

**Current Behavior**:
- Renders template with sample data
- Logs email details (subject, recipient, template key)
- Updates `last_sent_at` timestamp
- **Does NOT actually send** (email service integration pending)

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"admin@repaircoin.ai"}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/test
```

---

### 7. Reset to Default

**Endpoint**: `DELETE /api/admin/settings/email-templates/:key`

**Status**: Not Implemented (501)

**Response**:
```json
{
  "success": false,
  "error": "Reset to default feature coming soon. For now, manually update the template or re-run migrations."
}
```

**Planned Behavior**:
- Restore template to original default values
- Reset `is_default` to true
- Reset `version` to 1
- Clear `modified_by` field

---

## Service Layer

### EmailTemplateService

**File**: `src/services/EmailTemplateService.ts`

The service layer handles all business logic for email template operations.

#### Methods

##### `getTemplates(category?: string): Promise<EmailTemplate[]>`

Retrieves all templates, optionally filtered by category.

```typescript
const service = new EmailTemplateService();
const allTemplates = await service.getTemplates();
const welcomeTemplates = await service.getTemplates('welcome');
```

##### `getTemplate(templateKey: string): Promise<EmailTemplate | null>`

Retrieves a single template by key.

```typescript
const template = await service.getTemplate('customer_welcome');
if (!template) {
  throw new Error('Template not found');
}
```

##### `updateTemplate(templateKey: string, updates: Partial<EmailTemplate>, modifiedBy: string): Promise<EmailTemplate>`

Updates template fields and increments version.

```typescript
const updated = await service.updateTemplate(
  'customer_welcome',
  {
    subject: 'New subject',
    bodyHtml: '<p>New content</p>'
  },
  '0x1234...5678' // admin wallet address
);
```

##### `toggleTemplate(templateKey: string, enabled: boolean): Promise<void>`

Enables or disables a template.

```typescript
await service.toggleTemplate('customer_welcome', false); // disable
await service.toggleTemplate('customer_welcome', true);  // enable
```

##### `renderTemplate(templateKey: string, variables: Record<string, string>): Promise<RenderedEmail>`

Renders template with variable replacement.

```typescript
const rendered = await service.renderTemplate('customer_welcome', {
  customerName: 'John Doe',
  platformName: 'RepairCoin',
  walletAddress: '0xabc...123'
});

console.log(rendered.subject);    // "Welcome to RepairCoin, John Doe!"
console.log(rendered.bodyHtml);   // HTML with variables replaced
console.log(rendered.bodyText);   // Plain text version
```

##### `markAsSent(templateKey: string): Promise<void>`

Updates `last_sent_at` timestamp when email is sent.

```typescript
await service.markAsSent('customer_welcome');
```

#### Helper Methods

##### `mapRowToTemplate(row: any): EmailTemplate`

Converts database row (snake_case) to TypeScript interface (camelCase).

##### `camelToSnake(str: string): string`

Converts camelCase to snake_case for database queries.

##### `stripHtml(html: string): string`

Removes HTML tags to create plain text version.

```typescript
const text = service.stripHtml('<p>Hello <strong>World</strong></p>');
// "Hello World"
```

---

## Template Variables

### Variable Syntax

Use double curly braces for variables: `{{variableName}}`

**Example**:
```html
Subject: Welcome {{customerName}} to {{platformName}}!

<p>Hello {{customerName}},</p>
<p>Your wallet address {{walletAddress}} is now active.</p>
```

### Available Variables by Category

#### Welcome Category
- `customerName` - Customer's name
- `shopName` - Shop name
- `platformName` - "RepairCoin"
- `walletAddress` - Ethereum wallet address
- `approvalDate` - Shop approval date

#### Booking Category
- `customerName` - Customer's name
- `shopName` - Shop name
- `serviceName` - Service being booked
- `bookingDate` - Date of booking
- `bookingTime` - Time of booking
- `totalAmount` - Total cost
- `cancellationDate` - When cancelled

#### Transaction Category
- `customerName` - Customer's name
- `shopName` - Shop where earned/redeemed
- `amount` - RCN amount
- `amountUsd` - USD equivalent
- `transactionId` - Transaction hash/ID
- `newBalance` - Updated RCN balance

#### Shop Category
- `shopName` - Shop name
- `planName` - Subscription plan name
- `monthlyCost` - Monthly subscription cost
- `suspensionReason` - Why suspended
- `suspensionDate` - When suspended
- `reinstatementDate` - When reactivated

#### Support Category
- `customerName` - Customer's name
- `resetLink` - Password reset URL
- `expirationTime` - Link expiration (e.g., "24 hours")
- `suspensionReason` - Account suspension reason
- `reinstatementDate` - When account reactivated

### Variable Best Practices

1. **Always provide fallbacks**: Handle missing variables gracefully
2. **Use descriptive names**: `customerName` not `name`
3. **Document in template**: Store used variables in `variables` JSONB field
4. **Test with real data**: Use preview endpoint before sending
5. **Escape user input**: Sanitize variables to prevent XSS

---

## Default Templates

### 16 Pre-configured Templates

#### Welcome Category (3 templates)

1. **customer_welcome**
   - Subject: "Welcome to {{platformName}}, {{customerName}}!"
   - Variables: customerName, platformName, walletAddress
   - Purpose: Sent when customer first registers

2. **shop_welcome**
   - Subject: "Welcome to {{platformName}}, {{shopName}}!"
   - Variables: shopName, platformName
   - Purpose: Sent when shop completes onboarding

3. **shop_approved**
   - Subject: "Your Shop Has Been Approved!"
   - Variables: shopName, platformName, approvalDate
   - Purpose: Sent when admin approves shop application

#### Booking Category (4 templates)

4. **booking_confirmation**
   - Subject: "Booking Confirmed - {{serviceName}}"
   - Variables: customerName, shopName, serviceName, bookingDate, bookingTime, totalAmount
   - Purpose: Sent when customer books a service

5. **booking_reminder**
   - Subject: "Reminder: Upcoming Booking Tomorrow"
   - Variables: customerName, serviceName, bookingDate, bookingTime, shopName
   - Purpose: Sent 24 hours before booking

6. **booking_completed**
   - Subject: "Service Completed - Thank You!"
   - Variables: customerName, serviceName, shopName, amount
   - Purpose: Sent when shop marks service complete

7. **booking_cancelled**
   - Subject: "Booking Cancelled"
   - Variables: customerName, serviceName, bookingDate, shopName, cancellationDate
   - Purpose: Sent when booking is cancelled

#### Transaction Category (3 templates)

8. **rcn_earned**
   - Subject: "You Earned {{amount}} RCN!"
   - Variables: customerName, shopName, amount, amountUsd, transactionId, newBalance
   - Purpose: Sent when customer earns RCN

9. **rcn_redeemed**
   - Subject: "RCN Redeemed Successfully"
   - Variables: customerName, shopName, amount, amountUsd, transactionId, newBalance
   - Purpose: Sent when customer redeems RCN

10. **rcn_transferred**
    - Subject: "RCN Transfer Completed"
    - Variables: amount, amountUsd, transactionId, currentBalance
    - Purpose: Sent when RCN is transferred between wallets

#### Shop Category (3 templates)

11. **shop_subscription_activated**
    - Subject: "Your Subscription is Active!"
    - Variables: shopName, planName, monthlyCost
    - Purpose: Sent when shop subscription starts

12. **shop_subscription_expiring**
    - Subject: "Your Subscription Expires Soon"
    - Variables: shopName, expirationDate
    - Purpose: Sent 7 days before subscription ends

13. **shop_subscription_suspended**
    - Subject: "Subscription Suspended"
    - Variables: shopName, suspensionReason, suspensionDate
    - Purpose: Sent when subscription payment fails

#### Support Category (3 templates)

14. **password_reset**
    - Subject: "Reset Your Password"
    - Variables: customerName, resetLink, expirationTime
    - Purpose: Sent when user requests password reset

15. **account_suspended**
    - Subject: "Account Suspended"
    - Variables: customerName, suspensionReason
    - Purpose: Sent when account is suspended

16. **account_reactivated**
    - Subject: "Account Reactivated"
    - Variables: customerName, reinstatementDate
    - Purpose: Sent when suspended account is restored

### Default Template Design

All default templates follow these design principles:

- **Mobile-first**: Responsive design with max-width: 600px
- **Inline styles**: For email client compatibility
- **RepairCoin branding**: #FFCC00 yellow accent color
- **Clear CTAs**: Prominent call-to-action buttons
- **Plain text fallback**: Auto-generated for all templates
- **Professional tone**: Clear, friendly, concise copy

---

## Usage Examples

### Example 1: Sending Welcome Email

```typescript
import { EmailTemplateService } from '../services/EmailTemplateService';

const emailService = new EmailTemplateService();

// Get customer data
const customer = await getCustomerById(customerId);

// Render welcome email
const rendered = await emailService.renderTemplate('customer_welcome', {
  customerName: customer.name,
  platformName: 'RepairCoin',
  walletAddress: customer.walletAddress
});

// Send email (integrate with your email provider)
await sendEmail({
  to: customer.email,
  subject: rendered.subject,
  html: rendered.bodyHtml,
  text: rendered.bodyText
});

// Mark as sent
await emailService.markAsSent('customer_welcome');
```

### Example 2: Admin Updates Template via API

```typescript
// Frontend code
const updateTemplate = async () => {
  const response = await fetch(
    '/api/admin/settings/email-templates/customer_welcome',
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: 'Welcome {{customerName}} to the future of repairs!',
        bodyHtml: '<html>...<p>Hello {{customerName}}</p>...</html>'
      })
    }
  );

  const result = await response.json();
  console.log('Updated to version:', result.data.version);
};
```

### Example 3: Preview Before Sending

```typescript
// Test template rendering with real data
const preview = await emailService.renderTemplate('booking_confirmation', {
  customerName: 'Jane Smith',
  shopName: 'QuickFix Repairs',
  serviceName: 'iPhone Screen Replacement',
  bookingDate: '2026-04-25',
  bookingTime: '2:00 PM',
  totalAmount: '150.00'
});

// Display preview in admin UI
console.log('Subject:', preview.subject);
console.log('HTML Preview:', preview.bodyHtml);
```

### Example 4: Disable Spam Template

```typescript
// Temporarily disable a template that's causing issues
await emailService.toggleTemplate('booking_reminder', false);

// Fix the template
await emailService.updateTemplate(
  'booking_reminder',
  { subject: 'Fixed subject', bodyHtml: '<p>Fixed content</p>' },
  adminWallet
);

// Re-enable
await emailService.toggleTemplate('booking_reminder', true);
```

---

## Integration Guide

### Step 1: Install Email Service Provider

Choose one of the following:

#### Option A: SendGrid
```bash
npm install @sendgrid/mail
```

```typescript
// src/services/EmailService.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text: string
) => {
  await sgMail.send({
    to,
    from: 'noreply@repaircoin.ai',
    subject,
    html,
    text
  });
};
```

#### Option B: AWS SES
```bash
npm install @aws-sdk/client-ses
```

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'us-east-1' });

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text: string
) => {
  await sesClient.send(new SendEmailCommand({
    Source: 'noreply@repaircoin.ai',
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
        Text: { Data: text }
      }
    }
  }));
};
```

### Step 2: Update Test Email Endpoint

```typescript
// src/domains/admin/routes/emailTemplates.ts
router.post('/:key/test', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { recipientEmail } = req.body;

  // ... validation code ...

  const rendered = await emailTemplateService.renderTemplate(key, sampleData);

  // REPLACE THIS:
  logger.info('Test email would be sent:', { ... });

  // WITH THIS:
  await sendEmail(
    recipientEmail,
    rendered.subject,
    rendered.bodyHtml,
    rendered.bodyText
  );

  await emailTemplateService.markAsSent(key);

  res.json({
    success: true,
    message: `Test email sent to ${recipientEmail}`
  });
}));
```

### Step 3: Add Environment Variables

```bash
# .env file

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@repaircoin.ai

# OR AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
EMAIL_FROM=noreply@repaircoin.ai
```

### Step 4: Integrate with Application Events

```typescript
// Example: Send welcome email on customer registration
import { EventBus } from '../events/EventBus';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { sendEmail } from '../services/EmailService';

const emailService = new EmailTemplateService();

EventBus.on('customer:registered', async (data) => {
  const rendered = await emailService.renderTemplate('customer_welcome', {
    customerName: data.name,
    platformName: 'RepairCoin',
    walletAddress: data.walletAddress
  });

  await sendEmail(
    data.email,
    rendered.subject,
    rendered.bodyHtml,
    rendered.bodyText
  );

  await emailService.markAsSent('customer_welcome');
});
```

---

## Testing

### Unit Tests

```typescript
// src/services/__tests__/EmailTemplateService.test.ts
import { EmailTemplateService } from '../EmailTemplateService';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  test('should render template with variables', async () => {
    const rendered = await service.renderTemplate('customer_welcome', {
      customerName: 'John Doe',
      platformName: 'RepairCoin',
      walletAddress: '0x123'
    });

    expect(rendered.subject).toContain('John Doe');
    expect(rendered.bodyHtml).toContain('John Doe');
    expect(rendered.bodyHtml).toContain('0x123');
  });

  test('should toggle template enabled status', async () => {
    await service.toggleTemplate('customer_welcome', false);
    const template = await service.getTemplate('customer_welcome');
    expect(template?.enabled).toBe(false);
  });

  test('should increment version on update', async () => {
    const original = await service.getTemplate('customer_welcome');
    const updated = await service.updateTemplate(
      'customer_welcome',
      { subject: 'New subject' },
      '0xadmin'
    );
    expect(updated.version).toBe(original!.version + 1);
  });
});
```

### Integration Tests

```bash
# Test API endpoints with curl

# 1. Get all templates
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/settings/email-templates

# 2. Update template
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test subject","bodyHtml":"<p>Test</p>"}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome

# 3. Preview
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sampleData":{"customerName":"Test User"}}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/preview

# 4. Send test email
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"test@example.com"}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/test
```

### Manual Testing Checklist

- [ ] Can list all templates
- [ ] Can filter by category
- [ ] Can get single template
- [ ] Can update template (subject, HTML, text)
- [ ] Version increments on update
- [ ] is_default changes to false on update
- [ ] Can toggle enabled/disabled
- [ ] Preview renders variables correctly
- [ ] Test email validates email format
- [ ] 404 for non-existent template keys
- [ ] 400 for invalid request bodies
- [ ] 401 for missing authentication
- [ ] Database triggers update updated_at automatically

---

## Known Limitations

### 1. Reset to Default Not Implemented

**Status**: Endpoint exists but returns 501 (Not Implemented)

**Issue**: No mechanism to restore templates to original default values.

**Workaround**:
- Manually copy default values from migration file
- OR re-run migration (loses all customizations)
- OR keep a backup table of defaults

**Future Solution**:
```typescript
// Option 1: Store defaults in code
const DEFAULT_TEMPLATES = {
  customer_welcome: {
    subject: 'Welcome...',
    bodyHtml: '<html>...'
  }
};

// Option 2: Create defaults backup table
CREATE TABLE email_templates_defaults AS
SELECT * FROM email_templates WHERE is_default = true;
```

### 2. Email Service Not Integrated

**Status**: Test email endpoint logs but doesn't send actual emails

**Issue**: No SendGrid, AWS SES, or SMTP integration yet

**Workaround**:
- Use preview endpoint to see rendered output
- Manually copy HTML to email client
- Check logs for what would be sent

**Required for Production**:
- Add email service provider SDK
- Configure environment variables
- Update test endpoint to actually send
- Add delivery tracking

### 3. No HTML Sanitization

**Status**: Template HTML is stored and rendered without sanitization

**Risk**: Potential XSS if admin enters malicious HTML

**Mitigation**:
- Only admins can edit templates (requires authentication)
- Variables are replaced as-is (trust admin input)
- Preview in sandboxed environment

**Future Enhancement**:
```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(bodyHtml, {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'strong', 'em', 'a', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'style']
});
```

### 4. No Variable Validation

**Status**: Variables are checked at render time, not at update time

**Issue**: Typos in variable names won't be caught until email is sent

**Example**:
```html
<!-- Typo: {{custmerName}} instead of {{customerName}} -->
<p>Hello {{custmerName}}</p>
```

**Future Enhancement**:
- Parse template for {{variables}}
- Compare against allowed variables list
- Warn admin if unknown variables detected
- Suggest corrections for typos

### 5. No Versioning History

**Status**: Only current version is stored, no history table

**Limitation**: Can't view or restore previous versions

**Future Enhancement**:
```sql
CREATE TABLE email_template_history (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES email_templates(id),
  version INTEGER,
  subject VARCHAR(255),
  body_html TEXT,
  body_text TEXT,
  modified_by VARCHAR(255),
  modified_at TIMESTAMP DEFAULT NOW()
);
```

---

## Future Enhancements

### High Priority

1. **Email Service Integration**
   - Integrate SendGrid or AWS SES
   - Add delivery tracking
   - Handle bounces and complaints
   - Retry failed sends

2. **Reset to Default Feature**
   - Store original defaults
   - Implement restoration logic
   - Add confirmation dialog

3. **Variable Validation**
   - Parse templates for variables
   - Validate against allowed list
   - Warn about typos
   - Suggest corrections

### Medium Priority

4. **Template Versioning History**
   - Store all versions in history table
   - View diff between versions
   - Restore previous versions
   - Export version history

5. **Advanced Editor Features**
   - Rich text editor with WYSIWYG
   - Drag-and-drop email builder
   - Template inheritance (base layouts)
   - Component library

6. **Testing & Quality**
   - Send to test group before production
   - A/B testing support
   - Spam score checking
   - Email client rendering tests

### Low Priority

7. **Analytics & Insights**
   - Track open rates
   - Track click-through rates
   - Heatmaps for email engagement
   - Template performance comparison

8. **Internationalization**
   - Multi-language support
   - Locale-specific templates
   - Translation management
   - RTL language support

9. **Scheduled Sending**
   - Schedule emails for future
   - Time zone detection
   - Batch sending for large lists
   - Rate limiting

10. **Template Marketplace**
    - Pre-built template gallery
    - Community-contributed designs
    - Import/export templates
    - Template preview screenshots

---

## Troubleshooting

### Issue: Template Not Found (404)

**Symptoms**: API returns 404 error when accessing template

**Causes**:
- Template key misspelled
- Template doesn't exist in database
- Database connection issue

**Solutions**:
```bash
# Check if template exists
psql -U repaircoin -d repaircoin -c \
  "SELECT template_key FROM email_templates WHERE template_key = 'customer_welcome';"

# List all template keys
psql -U repaircoin -d repaircoin -c \
  "SELECT template_key FROM email_templates;"

# Re-run migration if templates missing
cd backend && npm run db:migrate
```

### Issue: Variables Not Replacing

**Symptoms**: `{{variableName}}` appears in rendered email instead of actual value

**Causes**:
- Variable not provided in data object
- Typo in variable name
- Case mismatch

**Solutions**:
```typescript
// Check which variables template expects
const template = await service.getTemplate('customer_welcome');
console.log('Required variables:', template.variables);

// Ensure all variables are provided
const rendered = await service.renderTemplate('customer_welcome', {
  customerName: 'John',    // Match exact casing
  platformName: 'RepairCoin',
  walletAddress: '0x123'
});
```

### Issue: Test Email Not Sending

**Symptoms**: API returns success but no email received

**Cause**: Email service not integrated yet (known limitation)

**Workaround**:
```bash
# Use preview to see what would be sent
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sampleData":{"customerName":"Test"}}' \
  http://localhost:4000/api/admin/settings/email-templates/customer_welcome/preview

# Check logs
tail -f backend/logs/app.log | grep "Test email"
```

### Issue: 401 Unauthorized

**Symptoms**: All requests return 401 error

**Causes**:
- Missing JWT token
- Expired token
- Not admin role

**Solutions**:
```bash
# Check token expiration
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d

# Get new token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xADMIN_ADDRESS","signature":"..."}'

# Verify admin role
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/auth/me
```

---

## Migration Information

**Migration Number**: 105
**File**: `backend/migrations/105_create_email_templates.sql`
**Applied**: April 20, 2026
**Status**: Successfully Applied

### What the Migration Does

1. Creates `email_templates` table with all required fields
2. Creates 3 indexes for performance (key, category, enabled)
3. Seeds 16 default templates across 5 categories
4. Creates auto-update trigger for `updated_at` column

### Re-running Migration

**⚠️ WARNING**: Re-running will delete all customized templates

```bash
# Backup current templates first
pg_dump -U repaircoin -d repaircoin -t email_templates > email_templates_backup.sql

# Drop and re-create
psql -U repaircoin -d repaircoin -c "DROP TABLE IF EXISTS email_templates CASCADE;"

# Re-run migration
cd backend && npm run db:migrate
```

---

## Support & Resources

### Documentation
- This file: `backend/docs/EMAIL_TEMPLATES_SYSTEM.md`
- Backend README: `backend/README.md`
- API Documentation: http://localhost:4000/api-docs

### Code References
- Migration: `backend/migrations/105_create_email_templates.sql`
- Service: `backend/src/services/EmailTemplateService.ts`
- Routes: `backend/src/domains/admin/routes/emailTemplates.ts`
- Frontend Components: `frontend/src/components/admin/tabs/Email*.tsx`

### Contact
- GitHub: [RepairCoin Repository](https://github.com/RepairCoin/RepairCoin)
- Email: dev@repaircoin.ai

---

**Last Updated**: April 20, 2026
**Version**: 1.0.0
**Author**: Claude (with Zeff)
