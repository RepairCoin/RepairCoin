/**
 * Phase 1 Slice 2A — SmsCustomerResolver + CustomerRepository.findAddressByPhone /
 * getOrCreateSmsGuest against the real DB. Verifies guest minting, returning-texter reuse, and
 * known-customer attach end-to-end (FK to customers, UNIQUE(customer_address, shop_id), channel
 * identity). Imports the app first for env (no .env.test — see Phase 0 note).
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
// Mock env-heavy modules so importing src/app for env loading doesn't crash the suite when the CI
// unit job hasn't set STRIPE_SECRET_KEY (mirrors send-message-button.test.ts).
jest.mock('../../src/services/StripeService');
jest.mock('../../src/contracts/RCGTokenReader');
jest.mock('thirdweb');
import '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { SmsCustomerResolver } from '../../src/domains/messaging/services/SmsCustomerResolver';

describe('Phase 1 Slice 2A — SMS customer resolution (DB)', () => {
  const customerRepo = new CustomerRepository();
  const messageRepo = new MessageRepository();
  const resolver = new SmsCustomerResolver({ customerRepo, messageRepo });
  const pool = (customerRepo as any).pool;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const shopId = `sms-res-shop-${suffix}`;
  // Unique 10-digit-ish US numbers for this run.
  const guestPhone = `+1555${suffix.slice(-7)}`;
  const knownPhone = `+1544${suffix.slice(-7)}`;
  const knownAddress = `0x${'b'.repeat(40)}`.slice(0, 42);

  const createdAddresses: string[] = [knownAddress];
  const createdConversations: string[] = [];

  beforeAll(async () => {
    // A known customer whose phone is stored in a DIFFERENT format than the inbound E.164, to
    // exercise the last-10-digit match path.
    await pool.query(
      `INSERT INTO customers (address, wallet_address, phone, name, is_active)
       VALUES ($1, $1, $2, 'Known Tester', true) ON CONFLICT (address) DO NOTHING`,
      [knownAddress, `(544) ${suffix.slice(-7, -4)}-${suffix.slice(-4)}`]
    );
  });

  afterAll(async () => {
    for (const c of createdConversations) {
      await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [c]);
      await pool.query(`DELETE FROM conversations WHERE conversation_id = $1`, [c]);
    }
    for (const a of createdAddresses) {
      await pool.query(`DELETE FROM customers WHERE address = $1`, [a.toLowerCase()]);
    }
  });

  it('mints a synthetic guest + sms conversation for an unknown phone', async () => {
    const res = await resolver.resolve(guestPhone, shopId);
    expect(res).not.toBeNull();
    expect(res!.isGuest).toBe(true);
    expect(res!.customerAddress).toBe(SmsCustomerResolver.guestAddressForPhone(guestPhone));
    createdAddresses.push(res!.customerAddress);
    createdConversations.push(res!.conversationId);

    const conv = await messageRepo.getConversationById(res!.conversationId);
    expect(conv?.channel).toBe('sms');

    // The guest customer row exists and is flagged.
    const cust = await pool.query(`SELECT auth_method FROM customers WHERE address = $1`, [res!.customerAddress]);
    expect(cust.rows[0]?.auth_method).toBe('sms_guest');
  });

  it('a returning guest texter resolves to the SAME conversation (idempotent)', async () => {
    const first = await resolver.resolve(guestPhone, shopId);
    const second = await resolver.resolve(guestPhone, shopId);
    expect(second!.conversationId).toBe(first!.conversationId);
    expect(second!.isGuest).toBe(true);
  });

  it('attaches to a KNOWN customer (last-10 match) without minting a guest', async () => {
    const res = await resolver.resolve(knownPhone, shopId);
    expect(res).not.toBeNull();
    expect(res!.isGuest).toBe(false);
    expect(res!.customerAddress).toBe(knownAddress.toLowerCase());
    createdConversations.push(res!.conversationId);

    // No guest was created under the synthetic address for this phone.
    const guestAddr = SmsCustomerResolver.guestAddressForPhone(res!.phone);
    const guest = await pool.query(`SELECT 1 FROM customers WHERE address = $1`, [guestAddr]);
    expect(guest.rows).toHaveLength(0);
  });

  it('findAddressByPhone returns null for a phone no customer has', async () => {
    const addr = await customerRepo.findAddressByPhone('+15550009999');
    expect(addr).toBeNull();
  });
});
