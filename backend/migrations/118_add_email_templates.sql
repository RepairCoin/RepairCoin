-- Migration 118: Add Email Templates for Low Stock Alerts
-- Created: 2026-05-26
-- Purpose: Allow shops to customize their low stock alert email templates

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL DEFAULT 'low_stock_alert',
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  css_styles TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  UNIQUE (shop_id, name)
);

COMMENT ON TABLE email_templates IS 'Custom email templates for shop notifications (low stock alerts, etc.)';
COMMENT ON COLUMN email_templates.template_type IS 'Type of template: low_stock_alert, purchase_order_reminder, etc.';
COMMENT ON COLUMN email_templates.subject_template IS 'Email subject line with variable placeholders';
COMMENT ON COLUMN email_templates.html_template IS 'HTML email body with variable placeholders';
COMMENT ON COLUMN email_templates.css_styles IS 'Custom CSS styles for the email template';
COMMENT ON COLUMN email_templates.variables IS 'Available variables for this template (JSON array)';
COMMENT ON COLUMN email_templates.is_default IS 'Whether this is the default template for the shop';
COMMENT ON COLUMN email_templates.usage_count IS 'Number of times this template has been used';

-- Create indexes
CREATE INDEX idx_email_templates_shop ON email_templates(shop_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);
CREATE INDEX idx_email_templates_default ON email_templates(shop_id, is_default) WHERE is_default = true;
CREATE INDEX idx_email_templates_active ON email_templates(shop_id, is_active) WHERE is_active = true;

-- Insert default template for reference
INSERT INTO email_templates (
  shop_id,
  name,
  description,
  template_type,
  subject_template,
  html_template,
  css_styles,
  variables,
  is_default,
  created_by
) VALUES (
  'system',
  'Default Low Stock Alert',
  'System default template for low stock alerts',
  'low_stock_alert',
  '🔔 Low Stock Alert - {{shop_name}}',
  '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    {{css_styles}}
  </style>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FFCC00 0%, #FFB700 100%); padding: 30px 20px; text-align: center;">
      <h1 style="color: #000000; margin: 0; font-size: 24px; font-weight: bold;">
        🔔 Low Stock Alert
      </h1>
      <p style="color: #333333; margin: 10px 0 0 0; font-size: 14px;">
        {{shop_name}}
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hello,
      </p>

      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        You have <strong>{{item_count}} items</strong> that are running low on stock and need attention.
      </p>

      <!-- Items List -->
      <div style="background-color: #f9f9f9; border-left: 4px solid #FFCC00; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">
          Items Below Threshold:
        </h3>
        {{items_list}}
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboard_url}}" style="display: inline-block; background-color: #FFCC00; color: #000000; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">
          View Inventory Dashboard
        </a>
      </div>

      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
        Please review your inventory and place orders as needed to avoid stockouts.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        This is an automated notification from your inventory management system.
      </p>
      <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">
        &copy; {{current_year}} RepairCoin. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  ',
  '
body { font-family: Arial, sans-serif; }
.header { background: linear-gradient(135deg, #FFCC00 0%, #FFB700 100%); }
.item { padding: 10px; margin: 5px 0; background: white; border-radius: 4px; }
.cta-button { background-color: #FFCC00; color: #000; }
  ',
  '[
    {"name": "shop_name", "description": "Name of the shop", "required": true},
    {"name": "item_count", "description": "Number of low stock items", "required": true},
    {"name": "items_list", "description": "HTML list of low stock items", "required": true},
    {"name": "dashboard_url", "description": "URL to inventory dashboard", "required": true},
    {"name": "current_year", "description": "Current year", "required": false}
  ]'::jsonb,
  true,
  'system'
);

-- Add migration tracking
INSERT INTO migration_history (migration_number, migration_name, executed_at)
VALUES (118, '118_add_email_templates.sql', CURRENT_TIMESTAMP);
