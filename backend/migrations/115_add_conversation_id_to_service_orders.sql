-- 115_add_conversation_id_to_service_orders.sql
--
-- Links a service order back to the AI chat conversation it was booked
-- from. Drives the AI booking-confirmation message (see
-- docs/tasks/strategy/ai-sales-agent/ai-booking-confirmation-message.md):
--
--   conversation_id SET   → the customer booked by tapping an AI booking
--                           card in chat. On payment, BookingConfirmationHandler
--                           posts a "your appointment is confirmed" message
--                           into exactly this conversation, and the frontend
--                           redirects the customer back into that thread.
--   conversation_id NULL  → booked from the marketplace / direct. No chat
--                           message; customer lands on /customer/orders.
--
-- Threaded end-to-end: booking card URL → Stripe PaymentIntent metadata →
-- persisted here when the order row is created on payment success.
--
-- Nullable, no FK: conversations use a string id (conv_*) and a booking
-- may outlive a conversation row; treat this as a soft link.

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;

COMMENT ON COLUMN service_orders.conversation_id IS
  'The AI chat conversation this order was booked from (conv_*). Set only when the customer booked via an AI booking card; NULL for marketplace/direct bookings. Soft link — no FK.';
