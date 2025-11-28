# Marketing Campaigns

The Marketing Campaigns feature allows shop owners to create, manage, and send targeted marketing communications to their customers through email and/or in-app notifications.

## Overview

Shop owners can create campaigns to:
- Offer coupons and discounts
- Announce new products or services
- Send newsletters and updates
- Promote the RCN rewards program

## Campaign Types

| Type | Description | Use Case |
|------|-------------|----------|
| `offer_coupon` | Send discount coupons to customers | Thank customers, drive repeat visits |
| `announce_service` | Announce new products/services | Launch promotions, new offerings |
| `newsletter` | Regular updates and news | Monthly updates, engagement |
| `custom` | Flexible custom campaigns | Any other marketing need |

## Audience Targeting

Campaigns can target specific customer segments:

| Audience Type | Description |
|---------------|-------------|
| `all_customers` | Every customer who has interacted with the shop |
| `top_spenders` | Top 20% of customers by total spend |
| `frequent_visitors` | Top 20% of customers by visit count |
| `active_customers` | Customers who visited in the last 30 days |

## Delivery Methods

| Method | Description |
|--------|-------------|
| `in_app` | Send as real-time in-app notification (WebSocket) |
| `email` | Send via email (requires customer email) |
| `both` | Send via both channels |

## Database Schema

### marketing_campaigns

Main table storing campaign data.

```sql
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY,
  shop_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  subject VARCHAR(255),
  preview_text VARCHAR(255),
  design_content JSONB DEFAULT '{}',
  template_id VARCHAR(50),
  audience_type VARCHAR(50) DEFAULT 'all_customers',
  audience_filters JSONB DEFAULT '{}',
  delivery_method VARCHAR(20) DEFAULT 'in_app',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  promo_code_id INTEGER,
  coupon_value DECIMAL(10, 2),
  coupon_type VARCHAR(20),
  coupon_expires_at TIMESTAMP WITH TIME ZONE,
  service_id VARCHAR(50),
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  in_app_sent INTEGER DEFAULT 0,
  in_app_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### marketing_campaign_recipients

Tracks delivery status per recipient.

```sql
CREATE TABLE marketing_campaign_recipients (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  customer_address VARCHAR(42) NOT NULL,
  customer_email VARCHAR(255),
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_clicked_at TIMESTAMP WITH TIME ZONE,
  in_app_sent_at TIMESTAMP WITH TIME ZONE,
  in_app_read_at TIMESTAMP WITH TIME ZONE,
  delivery_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### marketing_templates

Pre-built email/notification templates.

```sql
CREATE TABLE marketing_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  thumbnail_url VARCHAR(500),
  design_content JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

Base URL: `/api/marketing`

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shops/:shopId/campaigns` | List all campaigns for a shop |
| GET | `/campaigns/:campaignId` | Get a single campaign |
| POST | `/shops/:shopId/campaigns` | Create a new campaign |
| PUT | `/campaigns/:campaignId` | Update a campaign |
| DELETE | `/campaigns/:campaignId` | Delete a campaign |
| POST | `/campaigns/:campaignId/send` | Send a campaign immediately |
| POST | `/campaigns/:campaignId/schedule` | Schedule a campaign |
| POST | `/campaigns/:campaignId/cancel` | Cancel a scheduled campaign |

### Statistics & Audience

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shops/:shopId/stats` | Get campaign statistics |
| GET | `/shops/:shopId/audience-count` | Get audience count for targeting |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates` | List all available templates |
| GET | `/templates/:templateId` | Get a specific template |

## Design Content Structure

The `design_content` field stores the email/notification layout as JSON:

```json
{
  "header": {
    "enabled": true,
    "showLogo": true,
    "backgroundColor": "#1a1a2e"
  },
  "blocks": [
    {
      "id": "1",
      "type": "headline",
      "content": "Thanks for your support!",
      "style": { "fontSize": "24px", "textAlign": "center" }
    },
    {
      "id": "2",
      "type": "text",
      "content": "Your message here...",
      "style": { "textAlign": "center", "color": "#666" }
    },
    {
      "id": "3",
      "type": "coupon",
      "style": { "backgroundColor": "#10B981" }
    },
    {
      "id": "4",
      "type": "button",
      "content": "Book Now",
      "style": { "backgroundColor": "#eab308" }
    }
  ],
  "footer": {
    "showSocial": true,
    "showUnsubscribe": true
  }
}
```

### Block Types

| Type | Description | Properties |
|------|-------------|------------|
| `headline` | Large heading text | content, style (fontSize, textAlign, color) |
| `text` | Paragraph text | content, style (fontSize, textAlign, color) |
| `button` | Call-to-action button | content, style (backgroundColor, textColor) |
| `image` | Image block | src, style (maxWidth, margin) |
| `coupon` | Coupon display block | style (backgroundColor) |
| `service_card` | Service highlight card | serviceId, serviceName, servicePrice, serviceImage, style (backgroundColor) |
| `divider` | Horizontal line | - |
| `spacer` | Vertical spacing | style (height: 10px/20px/30px/40px) |

### Service Card Block

The `service_card` block allows shop owners to feature a specific service from their catalog:

```json
{
  "id": "3",
  "type": "service_card",
  "serviceId": "service-uuid-here",
  "serviceName": "Oil Change",
  "servicePrice": 49.99,
  "serviceImage": "https://example.com/oil-change.jpg",
  "style": { "backgroundColor": "#10B981" }
}
```

When editing a service card block:
1. Select a service from the shop's active services dropdown
2. The service name, price, and image are automatically populated
3. Customize the background color

## Campaign Workflow

```
┌─────────┐     ┌───────────┐     ┌───────────┐     ┌────────┐
│  Draft  │ ──> │ Scheduled │ ──> │  Sending  │ ──> │  Sent  │
└─────────┘     └───────────┘     └───────────┘     └────────┘
     │               │
     │               v
     │          ┌───────────┐
     └────────> │ Cancelled │
                └───────────┘
```

1. **Draft**: Campaign is being created/edited
2. **Scheduled**: Campaign is set to send at a future time
3. **Sending**: Campaign is actively being delivered
4. **Sent**: Campaign has been delivered
5. **Cancelled**: Scheduled campaign was cancelled

## Frontend Components

### MarketingTab
Located at: `frontend/src/components/shop/tabs/MarketingTab.tsx`

Main dashboard showing:
- Campaign statistics (total, drafts, delivered, emails sent)
- Campaign list with status and actions
- Campaign type picker dialog

### CampaignBuilderModal
Located at: `frontend/src/components/shop/marketing/CampaignBuilderModal.tsx`

3-step wizard for creating campaigns:
1. **Design**: Visual email builder with drag-and-drop blocks
2. **Audience**: Select target customer segment
3. **Delivery**: Choose delivery method and send/schedule

#### Design Tab Features

**Block Management:**
- Add blocks via the "Add Elements" grid (Text, Headline, Divider, Spacer, Button, Image, Coupon, Service)
- Drag-and-drop reordering using @dnd-kit library
- Click any block in the preview or block list to edit it
- Delete blocks via the trash icon or "Delete Block" button in the editor

**Block Editing (Edit Tab):**
- **Headline/Text blocks**: Edit content, alignment (left/center/right), font size (12px-32px), text color with color picker and presets
- **Button blocks**: Edit text, background color, text color
- **Coupon blocks**: Set coupon type (fixed/$, percentage/%), value, expiration date, background color
- **Service Card blocks**: Select from shop's active services, displays service name, price, and image
- **Spacer blocks**: Set height (10px/20px/30px/40px)

**Color Picker:**
- Native HTML5 color picker for custom colors
- Text input for hex values
- Quick preset colors for common choices

## Backend Services

### MarketingService
Located at: `backend/src/services/MarketingService.ts`

Core functionality:
- Campaign CRUD operations
- Audience targeting and counting
- Email rendering from design blocks
- In-app notification delivery via WebSocket
- Email delivery via nodemailer

### MarketingCampaignRepository
Located at: `backend/src/repositories/MarketingCampaignRepository.ts`

Database operations:
- Campaign persistence
- Recipient tracking
- Statistics aggregation
- Template management

## Default Templates

The system includes 4 pre-built templates:

1. **Thank You Coupon** (`coupon_thank_you`)
   - Category: coupon
   - Purpose: Thank customers with a discount

2. **New Service Announcement** (`new_service`)
   - Category: announcement
   - Purpose: Announce new products/services

3. **Monthly Newsletter** (`newsletter`)
   - Category: newsletter
   - Purpose: Regular updates and news

4. **RCN Reward Announcement** (`rcn_reward`)
   - Category: announcement
   - Purpose: Promote RCN rewards program

## Usage Example

### Creating a Campaign (API)

```typescript
// POST /api/marketing/shops/:shopId/campaigns
const campaign = await fetch('/api/marketing/shops/shop123/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    name: 'Summer Sale',
    campaignType: 'offer_coupon',
    subject: 'Get 20% off this summer!',
    designContent: {
      header: { enabled: true, showLogo: true },
      blocks: [
        { id: '1', type: 'headline', content: 'Summer Sale!' },
        { id: '2', type: 'coupon', style: { backgroundColor: '#10B981' } }
      ],
      footer: { showSocial: true, showUnsubscribe: true }
    },
    audienceType: 'all_customers',
    deliveryMethod: 'both',
    couponValue: 20,
    couponType: 'percentage',
    couponExpiresAt: '2025-08-31T23:59:59Z'
  })
});
```

### Sending a Campaign

```typescript
// POST /api/marketing/campaigns/:campaignId/send
const result = await fetch('/api/marketing/campaigns/abc123/send', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' }
});

// Response
{
  "success": true,
  "data": {
    "totalRecipients": 150,
    "emailsSent": 120,
    "inAppSent": 150
  }
}
```

## Security

- All endpoints require JWT authentication
- Shop ownership is verified for all operations
- Only shop owners can access their campaigns
- Sent campaigns cannot be modified or deleted

## Future Enhancements

- A/B testing for campaigns
- Advanced audience filters (custom queries)
- Campaign analytics dashboard
- Email open/click tracking
- Automated campaign triggers
- SMS delivery channel
