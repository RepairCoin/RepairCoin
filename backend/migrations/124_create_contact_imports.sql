-- Migration 124: Create contact imports table for mass communication
-- Description: Allow shops to import contacts (email, phone, name) for sending
--              mass email and SMS campaigns to promote app downloads

-- Create contact_imports table
CREATE TABLE IF NOT EXISTS contact_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'invalid')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'api')),
  tags TEXT[], -- Array of tags for segmentation (e.g., ['vip', 'new_leads'])
  notes TEXT,
  email_sent_count INTEGER DEFAULT 0,
  sms_sent_count INTEGER DEFAULT 0,
  last_email_sent_at TIMESTAMP,
  last_sms_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- At least one contact method (email or phone) must be provided
ALTER TABLE contact_imports ADD CONSTRAINT contact_method_required
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_contact_imports_shop_id ON contact_imports(shop_id);
CREATE INDEX idx_contact_imports_status ON contact_imports(status);
CREATE INDEX idx_contact_imports_email ON contact_imports(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contact_imports_phone ON contact_imports(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contact_imports_created_at ON contact_imports(created_at DESC);

-- Create unique constraint to prevent duplicate contacts per shop
CREATE UNIQUE INDEX idx_contact_imports_shop_email ON contact_imports(shop_id, email)
  WHERE email IS NOT NULL AND status != 'invalid';
CREATE UNIQUE INDEX idx_contact_imports_shop_phone ON contact_imports(shop_id, phone)
  WHERE phone IS NOT NULL AND status != 'invalid';

-- Create communication_campaigns table to track mass email/SMS campaigns
CREATE TABLE IF NOT EXISTS communication_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('email', 'sms', 'both')),
  subject TEXT, -- For emails
  message_template TEXT NOT NULL,
  target_status TEXT[] DEFAULT ARRAY['active'], -- Which contact statuses to target
  target_tags TEXT[], -- Which tags to target (null = all)
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by TEXT NOT NULL, -- Wallet address of shop owner
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for campaigns
CREATE INDEX idx_communication_campaigns_shop_id ON communication_campaigns(shop_id);
CREATE INDEX idx_communication_campaigns_status ON communication_campaigns(status);
CREATE INDEX idx_communication_campaigns_created_at ON communication_campaigns(created_at DESC);

-- Create campaign_recipients table to track individual sends
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES communication_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contact_imports(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('email', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered')),
  error_message TEXT,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for campaign recipients
CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_contact_id ON campaign_recipients(contact_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- Create unique constraint to prevent duplicate sends in a campaign
CREATE UNIQUE INDEX idx_campaign_recipients_unique ON campaign_recipients(campaign_id, contact_id, delivery_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_imports_updated_at_trigger
BEFORE UPDATE ON contact_imports
FOR EACH ROW
EXECUTE FUNCTION update_contact_imports_updated_at();

CREATE TRIGGER communication_campaigns_updated_at_trigger
BEFORE UPDATE ON communication_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_contact_imports_updated_at();

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 124 completed: Created contact_imports, communication_campaigns, and campaign_recipients tables';
END $$;
