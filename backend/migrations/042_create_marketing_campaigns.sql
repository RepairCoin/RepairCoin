-- Migration: Create marketing campaigns tables
-- Description: Adds tables for shop marketing campaigns with email/in-app delivery

-- Main campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(100) NOT NULL,

  -- Campaign details
  name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL, -- 'announce_service', 'offer_coupon', 'newsletter', 'custom'
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'sent', 'cancelled'

  -- Email content
  subject VARCHAR(255),
  preview_text VARCHAR(255),

  -- Design content (JSON structure for the builder)
  design_content JSONB NOT NULL DEFAULT '{}',

  -- Template reference (optional pre-built template)
  template_id VARCHAR(50),

  -- Targeting
  audience_type VARCHAR(50) NOT NULL DEFAULT 'all_customers', -- 'all_customers', 'top_spenders', 'frequent_visitors', 'active_customers', 'custom'
  audience_filters JSONB DEFAULT '{}', -- Custom filter criteria

  -- Delivery settings
  delivery_method VARCHAR(20) NOT NULL DEFAULT 'in_app', -- 'email', 'in_app', 'both'
  scheduled_at TIMESTAMP WITH TIME ZONE, -- When to send (null = send immediately)
  sent_at TIMESTAMP WITH TIME ZONE, -- When actually sent

  -- Coupon/Promo link (optional)
  promo_code_id INTEGER,
  coupon_value DECIMAL(10, 2), -- Direct coupon value (not linked to promo_code)
  coupon_type VARCHAR(20), -- 'fixed', 'percentage'
  coupon_expires_at TIMESTAMP WITH TIME ZONE,

  -- Service link (optional for announcing services)
  service_id VARCHAR(50),

  -- Statistics
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  in_app_sent INTEGER DEFAULT 0,
  in_app_read INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign recipients tracking table
CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  customer_address VARCHAR(42) NOT NULL,
  customer_email VARCHAR(255),

  -- Delivery status
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_clicked_at TIMESTAMP WITH TIME ZONE,
  in_app_sent_at TIMESTAMP WITH TIME ZONE,
  in_app_read_at TIMESTAMP WITH TIME ZONE,

  -- Error tracking
  delivery_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(campaign_id, customer_address)
);

-- Campaign templates (pre-built designs)
CREATE TABLE IF NOT EXISTS marketing_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'coupon', 'announcement', 'newsletter', 'event'
  thumbnail_url VARCHAR(500),
  design_content JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_shop ON marketing_campaigns(shop_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_scheduled ON marketing_campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created ON marketing_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer ON marketing_campaign_recipients(customer_address);

-- Insert default templates
INSERT INTO marketing_templates (id, name, description, category, design_content) VALUES
  ('coupon_thank_you', 'Thank You Coupon', 'Thank customers with a discount coupon', 'coupon', '{
    "header": {
      "enabled": true,
      "showLogo": true,
      "backgroundColor": "#1a1a2e"
    },
    "blocks": [
      {
        "type": "headline",
        "content": "Thanks for your support!",
        "style": { "fontSize": "24px", "fontWeight": "bold", "textAlign": "center" }
      },
      {
        "type": "text",
        "content": "As a small token of appreciation, below is a reward that can be used during your next visit. Hope you enjoy it!",
        "style": { "fontSize": "14px", "textAlign": "center", "color": "#666" }
      },
      {
        "type": "coupon",
        "style": { "backgroundColor": "#10B981", "textColor": "white" }
      },
      {
        "type": "text",
        "content": "Valid in-store or online. May be canceled at any time.",
        "style": { "fontSize": "12px", "textAlign": "center", "color": "#999" }
      }
    ],
    "footer": {
      "showSocial": true,
      "showUnsubscribe": true
    }
  }'::jsonb),

  ('new_service', 'New Service Announcement', 'Announce a new product or service', 'announcement', '{
    "header": {
      "enabled": true,
      "showLogo": true,
      "backgroundColor": "#1a1a2e"
    },
    "blocks": [
      {
        "type": "headline",
        "content": "Check out our new services!",
        "style": { "fontSize": "24px", "fontWeight": "bold", "textAlign": "center" }
      },
      {
        "type": "text",
        "content": "We are excited to show you these new services. Come on in to check them out, we think you will love them as much as we do.",
        "style": { "fontSize": "14px", "textAlign": "center", "color": "#666" }
      },
      {
        "type": "service_card",
        "style": { "backgroundColor": "#10B981" }
      },
      {
        "type": "button",
        "content": "Book Now",
        "style": { "backgroundColor": "#eab308", "textColor": "#000" }
      }
    ],
    "footer": {
      "showSocial": true,
      "showUnsubscribe": true
    }
  }'::jsonb),

  ('newsletter', 'Monthly Newsletter', 'Keep customers informed with updates', 'newsletter', '{
    "header": {
      "enabled": true,
      "showLogo": true,
      "backgroundColor": "#1a1a2e"
    },
    "blocks": [
      {
        "type": "headline",
        "content": "Monthly Update",
        "style": { "fontSize": "24px", "fontWeight": "bold", "textAlign": "center" }
      },
      {
        "type": "text",
        "content": "Here is what is happening at our shop this month...",
        "style": { "fontSize": "14px", "textAlign": "left", "color": "#666" }
      },
      {
        "type": "divider"
      },
      {
        "type": "text",
        "content": "Add your newsletter content here.",
        "style": { "fontSize": "14px", "textAlign": "left" }
      }
    ],
    "footer": {
      "showSocial": true,
      "showUnsubscribe": true
    }
  }'::jsonb),

  ('rcn_reward', 'RCN Reward Announcement', 'Announce RCN rewards to customers', 'announcement', '{
    "header": {
      "enabled": true,
      "showLogo": true,
      "backgroundColor": "#1a1a2e"
    },
    "blocks": [
      {
        "type": "headline",
        "content": "Earn RCN Rewards!",
        "style": { "fontSize": "24px", "fontWeight": "bold", "textAlign": "center" }
      },
      {
        "type": "text",
        "content": "Did you know you can earn RCN tokens with every service? Redeem them for discounts at our shop or any shop in the RepairCoin network!",
        "style": { "fontSize": "14px", "textAlign": "center", "color": "#666" }
      },
      {
        "type": "image",
        "src": "/rcn-logo.png",
        "style": { "maxWidth": "150px", "margin": "0 auto" }
      },
      {
        "type": "button",
        "content": "Learn More",
        "style": { "backgroundColor": "#eab308", "textColor": "#000" }
      }
    ],
    "footer": {
      "showSocial": true,
      "showUnsubscribe": true
    }
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Comments
COMMENT ON TABLE marketing_campaigns IS 'Stores marketing campaigns created by shops';
COMMENT ON TABLE marketing_campaign_recipients IS 'Tracks delivery status per recipient for each campaign';
COMMENT ON TABLE marketing_templates IS 'Pre-built email/notification templates';
COMMENT ON COLUMN marketing_campaigns.campaign_type IS 'Type: announce_service, offer_coupon, newsletter, custom';
COMMENT ON COLUMN marketing_campaigns.audience_type IS 'Target audience: all_customers, top_spenders, frequent_visitors, active_customers, custom';
COMMENT ON COLUMN marketing_campaigns.delivery_method IS 'How to deliver: email, in_app, both';
COMMENT ON COLUMN marketing_campaigns.design_content IS 'JSON structure containing the email/notification design blocks';
