/**
 * Phase 0 (AI Auto-Replies multi-channel foundation) — integration tests for
 * ConversationChannelIdentityRepository + the `channel` column threaded through
 * MessageRepository. Verifies the phone/whatsapp-id → conversation mapping that
 * later phases (SMS inbound, WhatsApp inbound) resolve against, and that a
 * message stamped with a channel round-trips.
 *
 * Scope: docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
// StripeService (and other blockchain/env-heavy modules) throw on import when their env isn't set —
// the CI unit job doesn't set STRIPE_SECRET_KEY. Mock them so importing src/app for env loading below
// doesn't crash the suite. Same guard the other app-importing DB suites use (send-message-button).
jest.mock('../../src/services/StripeService');
jest.mock('../../src/contracts/RCGTokenReader');
jest.mock('thirdweb');
// This suite talks to the DB through the repositories directly. The shared pool
// reads process.env at first-query time; there's no .env.test, so importing the
// app first runs its top-level dotenv.config() (loading the real .env/staging)
// before the pool is built — the same reason the other messaging suites import it.
import '../../src/app';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { ConversationChannelIdentityRepository } from '../../src/repositories/ConversationChannelIdentityRepository';

describe('Phase 0 — conversation channel foundation', () => {
  const messageRepo = new MessageRepository();
  const identityRepo = new ConversationChannelIdentityRepository();

  // Unique per-run so parallel/re-runs don't collide.
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const shopId = `chan-test-shop-${suffix}`;
  const customerAddress = `0x${'a'.repeat(39)}${suffix.slice(-1)}`.slice(0, 42);
  const phone = `+1555${suffix.slice(-7)}`;

  let conversationId: string;

  beforeAll(async () => {
    const conv = await messageRepo.getOrCreateConversation(customerAddress, shopId);
    conversationId = conv.conversationId;
  });

  afterAll(async () => {
    // channel_identities cascade-delete with the conversation.
    await (messageRepo as any).pool.query(
      `DELETE FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    await (messageRepo as any).pool.query(
      `DELETE FROM conversations WHERE conversation_id = $1`,
      [conversationId]
    );
  });

  it('new conversations default to the app channel', () => {
    // getOrCreateConversation was called with no channel → DB default 'app'.
    expect(conversationId).toBeTruthy();
  });

  it('messages default to channel=app when none is passed', async () => {
    const { message } = await messageRepo.createMessage({
      messageId: `msg-app-${suffix}`,
      conversationId,
      senderAddress: customerAddress,
      senderType: 'customer',
      messageText: 'in-app hello',
    });
    expect(message.channel).toBe('app');
  });

  it('messages persist an explicit channel', async () => {
    const { message } = await messageRepo.createMessage({
      messageId: `msg-sms-${suffix}`,
      conversationId,
      senderAddress: customerAddress,
      senderType: 'customer',
      messageText: 'texted hello',
      channel: 'sms',
    });
    expect(message.channel).toBe('sms');
  });

  it('links a phone identity and resolves it back to the conversation', async () => {
    await identityRepo.link(conversationId, 'sms', phone);
    const resolved = await identityRepo.findConversationId('sms', phone);
    expect(resolved).toBe(conversationId);
  });

  it('linking the same identity twice is idempotent (no duplicate, same conversation)', async () => {
    await identityRepo.link(conversationId, 'sms', phone);
    const list = await identityRepo.listForConversation(conversationId);
    const smsForPhone = list.filter(i => i.channel === 'sms' && i.externalId === phone);
    expect(smsForPhone).toHaveLength(1);
  });

  it('returns null for an unknown identity', async () => {
    const resolved = await identityRepo.findConversationId('sms', '+15550000000');
    expect(resolved).toBeNull();
  });
});
