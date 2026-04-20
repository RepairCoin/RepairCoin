-- Migration 105: Create Email Templates System
-- Description: Create table for managing customizable email notification templates
-- Date: 2026-04-20

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
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

-- Create indexes for performance
CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_enabled ON email_templates(enabled);

-- Insert default email templates

-- 1. WELCOME TEMPLATES
INSERT INTO email_templates (template_key, template_name, category, subject, body_html, body_text, variables, is_default, created_by) VALUES
('customer_welcome', 'Customer Welcome Email', 'welcome',
'Welcome to {{platformName}}! 🎉',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Welcome {{customerName}}!</h1>
<p>Thank you for joining <strong>{{platformName}}</strong>, the blockchain-based customer loyalty and rewards platform.</p>
<p>Your account is now active and you can start earning RCN tokens for every repair service you complete.</p>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 0;"><strong>Your Wallet Address:</strong></p>
  <p style="font-family: monospace; margin: 5px 0;">{{walletAddress}}</p>
</div>
<p>Start exploring participating repair shops and earn rewards today!</p>
<p>If you have any questions, feel free to reach out to our support team.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Welcome {{customerName}}! Thank you for joining {{platformName}}. Your wallet address: {{walletAddress}}. Start earning RCN tokens today!',
'["customerName", "platformName", "walletAddress"]'::jsonb, true, 'system'),

('shop_welcome', 'Shop Welcome Email', 'welcome',
'Welcome to {{platformName}} - Your Shop is Approved! 🏪',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Congratulations {{shopName}}!</h1>
<p>Your shop application has been <strong>approved</strong> and you are now part of the {{platformName}} network.</p>
<div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
  <p style="margin: 0;"><strong>Shop Details:</strong></p>
  <p style="margin: 5px 0;">Name: {{shopName}}</p>
  <p style="margin: 5px 0;">Email: {{shopEmail}}</p>
  <p style="margin: 5px 0;">Approval Date: {{approvalDate}}</p>
</div>
<h3>Next Steps:</h3>
<ol>
  <li>Activate your subscription to start issuing rewards</li>
  <li>Purchase RCN tokens to reward your customers</li>
  <li>Set up your services in the marketplace</li>
</ol>
<p>Need help getting started? Check our documentation or contact support.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Congratulations {{shopName}}! Your shop has been approved on {{platformName}}. Approval date: {{approvalDate}}. Start issuing rewards to your customers today!',
'["shopName", "platformName", "shopEmail", "approvalDate"]'::jsonb, true, 'system');

-- 2. BOOKING TEMPLATES
INSERT INTO email_templates (template_key, template_name, category, subject, body_html, body_text, variables, is_default, created_by) VALUES
('booking_confirmation', 'Booking Confirmation', 'booking',
'Booking Confirmed: {{serviceName}} on {{bookingDate}} 📅',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Booking Confirmed!</h1>
<p>Hi {{customerName}},</p>
<p>Your booking has been confirmed. Here are the details:</p>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Service:</strong> {{serviceName}}</p>
  <p style="margin: 5px 0;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin: 5px 0;"><strong>Date:</strong> {{bookingDate}}</p>
  <p style="margin: 5px 0;"><strong>Time:</strong> {{bookingTime}}</p>
  <p style="margin: 5px 0;"><strong>Amount:</strong> ${{totalAmount}}</p>
</div>
<p>We look forward to serving you!</p>
<p>Best regards,<br>{{shopName}}</p>
</body></html>',
'Booking confirmed! Service: {{serviceName}} at {{shopName}} on {{bookingDate}} at {{bookingTime}}. Amount: ${{totalAmount}}',
'["customerName", "serviceName", "shopName", "bookingDate", "bookingTime", "totalAmount"]'::jsonb, true, 'system'),

('booking_reminder', 'Booking Reminder (24h)', 'booking',
'Reminder: Your appointment tomorrow at {{shopName}} 🔔',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Appointment Reminder</h1>
<p>Hi {{customerName}},</p>
<p>This is a friendly reminder about your upcoming appointment:</p>
<div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
  <p style="margin: 5px 0;"><strong>Service:</strong> {{serviceName}}</p>
  <p style="margin: 5px 0;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin: 5px 0;"><strong>Date:</strong> {{bookingDate}}</p>
  <p style="margin: 5px 0;"><strong>Time:</strong> {{bookingTime}}</p>
</div>
<p>Please arrive 5-10 minutes early. If you need to reschedule, please contact us as soon as possible.</p>
<p>See you soon!<br>{{shopName}}</p>
</body></html>',
'Reminder: Your appointment at {{shopName}} is tomorrow ({{bookingDate}}) at {{bookingTime}} for {{serviceName}}',
'["customerName", "serviceName", "shopName", "bookingDate", "bookingTime"]'::jsonb, true, 'system'),

('booking_cancelled', 'Booking Cancellation', 'booking',
'Booking Cancelled: {{serviceName}} ❌',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #ff5722;">Booking Cancelled</h1>
<p>Hi {{customerName}},</p>
<p>Your booking has been cancelled:</p>
<div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
  <p style="margin: 5px 0;"><strong>Service:</strong> {{serviceName}}</p>
  <p style="margin: 5px 0;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin: 5px 0;"><strong>Original Date:</strong> {{bookingDate}}</p>
  <p style="margin: 5px 0;"><strong>Cancelled On:</strong> {{cancellationDate}}</p>
</div>
<p>If you did not request this cancellation, please contact us immediately.</p>
<p>Best regards,<br>{{shopName}}</p>
</body></html>',
'Your booking for {{serviceName}} at {{shopName}} on {{bookingDate}} has been cancelled.',
'["customerName", "serviceName", "shopName", "bookingDate", "cancellationDate"]'::jsonb, true, 'system');

-- 3. TRANSACTION TEMPLATES
INSERT INTO email_templates (template_key, template_name, category, subject, body_html, body_text, variables, is_default, created_by) VALUES
('rcn_reward_received', 'RCN Reward Received', 'transaction',
'You earned {{amount}} RCN! 💰',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Congratulations {{customerName}}!</h1>
<p>You have received RCN tokens!</p>
<div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #4caf50;">
  <p style="font-size: 36px; margin: 0; color: #4caf50;"><strong>{{amount}} RCN</strong></p>
  <p style="margin: 5px 0; color: #666;">≈ ${{amountUsd}}</p>
</div>
<p><strong>Transaction Details:</strong></p>
<ul>
  <li>Shop: {{shopName}}</li>
  <li>Service: {{serviceName}}</li>
  <li>Date: {{transactionDate}}</li>
  <li>Transaction ID: {{transactionId}}</li>
</ul>
<p>Your new balance: <strong>{{newBalance}} RCN</strong></p>
<p>Redeem your tokens at any participating shop!</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'You earned {{amount}} RCN (≈${{amountUsd}}) from {{shopName}} for {{serviceName}}. Transaction ID: {{transactionId}}. New balance: {{newBalance}} RCN',
'["customerName", "amount", "amountUsd", "shopName", "serviceName", "transactionDate", "transactionId", "newBalance"]'::jsonb, true, 'system'),

('rcn_redemption_receipt', 'RCN Redemption Receipt', 'transaction',
'Redemption Confirmed: {{amount}} RCN ✅',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Redemption Successful!</h1>
<p>Hi {{customerName}},</p>
<p>Your RCN tokens have been successfully redeemed.</p>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Amount Redeemed:</strong> {{amount}} RCN</p>
  <p style="margin: 5px 0;"><strong>Value:</strong> ${{amountUsd}}</p>
  <p style="margin: 5px 0;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin: 5px 0;"><strong>Date:</strong> {{transactionDate}}</p>
  <p style="margin: 5px 0;"><strong>Transaction ID:</strong> {{transactionId}}</p>
</div>
<p>Your remaining balance: <strong>{{newBalance}} RCN</strong></p>
<p>Thank you for using RepairCoin!</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Redemption confirmed: {{amount}} RCN (≈${{amountUsd}}) at {{shopName}}. Transaction ID: {{transactionId}}. Remaining balance: {{newBalance}} RCN',
'["customerName", "amount", "amountUsd", "shopName", "transactionDate", "transactionId", "newBalance"]'::jsonb, true, 'system'),

('shop_rcn_purchase_receipt', 'Shop RCN Purchase Receipt', 'transaction',
'Purchase Confirmed: {{amount}} RCN Tokens 🪙',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Purchase Confirmed!</h1>
<p>Hi {{shopName}},</p>
<p>Your RCN token purchase has been completed.</p>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Tokens Purchased:</strong> {{amount}} RCN</p>
  <p style="margin: 5px 0;"><strong>Total Cost:</strong> ${{totalCost}}</p>
  <p style="margin: 5px 0;"><strong>Payment Method:</strong> {{paymentMethod}}</p>
  <p style="margin: 5px 0;"><strong>Purchase Date:</strong> {{purchaseDate}}</p>
  <p style="margin: 5px 0;"><strong>Reference:</strong> {{paymentReference}}</p>
</div>
<p>Your new token balance: <strong>{{newBalance}} RCN</strong></p>
<p>You can now reward your customers with these tokens!</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Purchase confirmed: {{amount}} RCN tokens for ${{totalCost}} via {{paymentMethod}}. Reference: {{paymentReference}}. New balance: {{newBalance}} RCN',
'["shopName", "amount", "totalCost", "paymentMethod", "purchaseDate", "paymentReference", "newBalance"]'::jsonb, true, 'system');

-- 4. SHOP MANAGEMENT TEMPLATES
INSERT INTO email_templates (template_key, template_name, category, subject, body_html, body_text, variables, is_default, created_by) VALUES
('shop_application_received', 'Shop Application Received', 'shop',
'Application Received - {{shopName}} 📋',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Application Received!</h1>
<p>Hi {{shopName}},</p>
<p>Thank you for applying to join the {{platformName}} network. We have received your application and it is currently under review.</p>
<div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
  <p style="margin: 5px 0;"><strong>Shop Name:</strong> {{shopName}}</p>
  <p style="margin: 5px 0;"><strong>Email:</strong> {{shopEmail}}</p>
  <p style="margin: 5px 0;"><strong>Submission Date:</strong> {{submissionDate}}</p>
</div>
<p><strong>What happens next?</strong></p>
<ol>
  <li>Our team will review your application (typically 1-3 business days)</li>
  <li>We may contact you for additional information</li>
  <li>You will receive an email with the approval decision</li>
</ol>
<p>Thank you for your patience!</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Application received for {{shopName}}. Submitted on {{submissionDate}}. We will review your application and contact you within 1-3 business days.',
'["shopName", "platformName", "shopEmail", "submissionDate"]'::jsonb, true, 'system'),

('shop_approved', 'Shop Application Approved', 'shop',
'Approved! Welcome to {{platformName}} 🎉',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #4caf50;">Congratulations {{shopName}}! 🎉</h1>
<p>Great news! Your application to join {{platformName}} has been <strong>approved</strong>!</p>
<div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #4caf50;">
  <p style="font-size: 24px; margin: 0; color: #4caf50;"><strong>✓ Approved</strong></p>
  <p style="margin: 10px 0;">Approval Date: {{approvalDate}}</p>
</div>
<h3>Get Started:</h3>
<ol>
  <li><strong>Activate Subscription:</strong> Choose your plan ($500/month)</li>
  <li><strong>Purchase RCN Tokens:</strong> Buy tokens to reward customers</li>
  <li><strong>Create Services:</strong> Add your repair services to marketplace</li>
  <li><strong>Start Rewarding:</strong> Issue tokens for completed services</li>
</ol>
<p>Access your dashboard to get started!</p>
<p>Welcome aboard!<br>The RepairCoin Team</p>
</body></html>',
'Congratulations {{shopName}}! Your application has been approved on {{approvalDate}}. Welcome to {{platformName}}!',
'["shopName", "platformName", "approvalDate"]'::jsonb, true, 'system'),

('shop_rejected', 'Shop Application Not Approved', 'shop',
'Application Update - {{shopName}} 📋',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #ff9800;">Application Decision</h1>
<p>Hi {{shopName}},</p>
<p>Thank you for your interest in joining {{platformName}}. After careful review, we are unable to approve your application at this time.</p>
<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
  <p style="margin: 0;"><strong>Reason:</strong></p>
  <p style="margin: 10px 0;">{{rejectionReason}}</p>
</div>
<p>You may reapply in the future once you have addressed the concerns mentioned above.</p>
<p>If you have questions or would like more information, please contact our support team.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Thank you for applying to {{platformName}}. We are unable to approve {{shopName}} at this time. Reason: {{rejectionReason}}',
'["shopName", "platformName", "rejectionReason"]'::jsonb, true, 'system'),

('shop_subscription_expiring_7d', 'Subscription Expiring (7 Days)', 'shop',
'Your subscription expires in 7 days ⚠️',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #ff9800;">Subscription Expiring Soon</h1>
<p>Hi {{shopName}},</p>
<p>This is a friendly reminder that your {{platformName}} subscription will expire in <strong>7 days</strong>.</p>
<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
  <p style="margin: 5px 0;"><strong>Expiration Date:</strong> {{expirationDate}}</p>
  <p style="margin: 5px 0;"><strong>Plan:</strong> {{planName}}</p>
  <p style="margin: 5px 0;"><strong>Monthly Cost:</strong> ${{monthlyCost}}</p>
</div>
<p><strong>To continue enjoying these benefits:</strong></p>
<ul>
  <li>Issue RCN rewards to customers</li>
  <li>Process redemptions</li>
  <li>List services in marketplace</li>
  <li>Access analytics dashboard</li>
</ul>
<p>Please renew your subscription before it expires to avoid service interruption.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Reminder: Your {{platformName}} subscription expires in 7 days ({{expirationDate}}). Please renew to continue service.',
'["shopName", "platformName", "expirationDate", "planName", "monthlyCost"]'::jsonb, true, 'system'),

('shop_subscription_expired', 'Subscription Expired', 'shop',
'Your subscription has expired ⛔',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #f44336;">Subscription Expired</h1>
<p>Hi {{shopName}},</p>
<p>Your {{platformName}} subscription has expired.</p>
<div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
  <p style="margin: 5px 0;"><strong>Expired On:</strong> {{expirationDate}}</p>
  <p style="margin: 5px 0;"><strong>Status:</strong> Inactive</p>
</div>
<p><strong>Services Now Limited:</strong></p>
<ul>
  <li>❌ Cannot issue new RCN rewards</li>
  <li>❌ Cannot process redemptions</li>
  <li>❌ Services removed from marketplace</li>
  <li>✓ Can still view purchase history</li>
</ul>
<p><strong>Renew now to restore full access!</strong></p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Your {{platformName}} subscription expired on {{expirationDate}}. Services are now limited. Please renew to restore access.',
'["shopName", "platformName", "expirationDate"]'::jsonb, true, 'system');

-- 5. SUPPORT TEMPLATES
INSERT INTO email_templates (template_key, template_name, category, subject, body_html, body_text, variables, is_default, created_by) VALUES
('account_suspended', 'Account Suspended', 'support',
'Account Suspended - Action Required ⚠️',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #f44336;">Account Suspended</h1>
<p>Hi {{customerName}},</p>
<p>Your {{platformName}} account has been temporarily suspended.</p>
<div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
  <p style="margin: 0;"><strong>Reason:</strong></p>
  <p style="margin: 10px 0;">{{suspensionReason}}</p>
  <p style="margin: 5px 0;"><strong>Suspended On:</strong> {{suspensionDate}}</p>
</div>
<p><strong>What this means:</strong></p>
<ul>
  <li>You cannot access your account</li>
  <li>You cannot earn or redeem tokens</li>
  <li>Your current balance is preserved</li>
</ul>
<p>If you believe this is an error or would like to appeal, please contact our support team immediately.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Your {{platformName}} account has been suspended. Reason: {{suspensionReason}}. Suspended on: {{suspensionDate}}. Contact support if you believe this is an error.',
'["customerName", "platformName", "suspensionReason", "suspensionDate"]'::jsonb, true, 'system'),

('account_unsuspended', 'Account Reinstated', 'support',
'Your account has been reinstated ✅',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #4caf50;">Account Reinstated!</h1>
<p>Hi {{customerName}},</p>
<p>Good news! Your {{platformName}} account has been reinstated and is now fully active.</p>
<div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
  <p style="margin: 5px 0;"><strong>Reinstated On:</strong> {{reinstatementDate}}</p>
  <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
</div>
<p>You now have full access to:</p>
<ul>
  <li>✓ Earn RCN tokens</li>
  <li>✓ Redeem tokens at shops</li>
  <li>✓ Browse marketplace</li>
  <li>✓ Book services</li>
</ul>
<p>Your token balance has been preserved: <strong>{{currentBalance}} RCN</strong></p>
<p>Welcome back!<br>The RepairCoin Team</p>
</body></html>',
'Your {{platformName}} account has been reinstated on {{reinstatementDate}}. You now have full access. Current balance: {{currentBalance}} RCN',
'["customerName", "platformName", "reinstatementDate", "currentBalance"]'::jsonb, true, 'system'),

('password_reset', 'Password Reset Request', 'support',
'Reset Your Password 🔑',
'<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h1 style="color: #FFCC00;">Password Reset Request</h1>
<p>Hi {{customerName}},</p>
<p>We received a request to reset your password for your {{platformName}} account.</p>
<div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
  <p style="margin: 0 0 15px 0;">Click the button below to reset your password:</p>
  <a href="{{resetLink}}" style="display: inline-block; padding: 12px 30px; background-color: #FFCC00; color: black; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
  <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">This link will expire in {{expirationTime}}</p>
</div>
<p><strong>If you did not request this, please ignore this email.</strong> Your password will remain unchanged.</p>
<p>For security, never share this email with anyone.</p>
<p>Best regards,<br>The RepairCoin Team</p>
</body></html>',
'Password reset requested for {{platformName}}. Click to reset: {{resetLink}}. Link expires in {{expirationTime}}. If you did not request this, ignore this email.',
'["customerName", "platformName", "resetLink", "expirationTime"]'::jsonb, true, 'system');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION update_email_template_timestamp();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE email_templates_id_seq TO your_app_user;

-- Migration complete
-- Total default templates: 16 (covering all major notification types)
