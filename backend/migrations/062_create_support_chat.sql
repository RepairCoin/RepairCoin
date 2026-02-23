-- Migration: Create support chat system for shop-to-admin communication
-- Date: 2026-02-02
-- Description: Support tickets and messages for shops to contact admins

-- =====================================================
-- 1. Support Tickets Table
-- =====================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_shop', 'resolved', 'closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category VARCHAR(50) CHECK (category IN ('billing', 'technical', 'account', 'general', 'feature_request')),
  assigned_to VARCHAR(255), -- admin wallet address
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. Support Messages Table
-- =====================================================
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('shop', 'admin', 'system')),
  sender_id VARCHAR(255) NOT NULL, -- shop_id or admin wallet
  sender_name VARCHAR(255), -- cached name for display
  message TEXT NOT NULL,
  attachments JSONB, -- array of file URLs
  is_internal BOOLEAN DEFAULT false, -- internal admin notes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  edited_at TIMESTAMP
);

-- =====================================================
-- 3. Support Ticket Views (for quick access)
-- =====================================================
CREATE TABLE IF NOT EXISTS support_ticket_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  viewer_type VARCHAR(20) NOT NULL CHECK (viewer_type IN ('shop', 'admin')),
  viewer_id VARCHAR(255) NOT NULL,
  last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ticket_id, viewer_type, viewer_id)
);

-- =====================================================
-- 4. Indexes for Performance
-- =====================================================
CREATE INDEX idx_support_tickets_shop ON support_tickets(shop_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_updated ON support_tickets(updated_at DESC);
CREATE INDEX idx_support_tickets_last_message ON support_tickets(last_message_at DESC);

CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id);
CREATE INDEX idx_support_messages_created ON support_messages(created_at);
CREATE INDEX idx_support_messages_sender ON support_messages(sender_type, sender_id);

CREATE INDEX idx_support_ticket_views_ticket ON support_ticket_views(ticket_id);
CREATE INDEX idx_support_ticket_views_viewer ON support_ticket_views(viewer_type, viewer_id);

-- =====================================================
-- 5. Triggers for Auto-Updates
-- =====================================================

-- Update support_tickets.updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trigger_update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

-- Update ticket's last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET last_message_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ticket_last_message ON support_messages;
CREATE TRIGGER trigger_update_ticket_last_message
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_message();

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================
COMMENT ON TABLE support_tickets IS 'Support tickets created by shops to contact admins';
COMMENT ON TABLE support_messages IS 'Messages in support ticket conversations';
COMMENT ON TABLE support_ticket_views IS 'Track when tickets were last viewed by shops/admins';

COMMENT ON COLUMN support_tickets.status IS 'Ticket status: open, in_progress, waiting_shop, resolved, closed';
COMMENT ON COLUMN support_tickets.priority IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN support_tickets.category IS 'Ticket category for organization';
COMMENT ON COLUMN support_tickets.assigned_to IS 'Admin wallet address assigned to handle this ticket';
COMMENT ON COLUMN support_tickets.last_message_at IS 'Timestamp of most recent message (for sorting)';

COMMENT ON COLUMN support_messages.sender_type IS 'Who sent the message: shop, admin, or system';
COMMENT ON COLUMN support_messages.is_internal IS 'True for internal admin notes not visible to shops';
COMMENT ON COLUMN support_messages.attachments IS 'JSON array of attachment URLs';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Support chat system created successfully';
  RAISE NOTICE 'Created tables: support_tickets, support_messages, support_ticket_views';
END $$;
