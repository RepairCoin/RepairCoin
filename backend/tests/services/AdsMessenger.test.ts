// Messenger channel (P1) — the pure inbound parser + the transport enable gate. Live sending is
// App-Review-gated (pages_messaging), so only the pure logic is unit-tested here.
import { parseMessagingEvents } from '../../src/domains/AdsDomain/services/MetaWebhookService';
import { MessengerService } from '../../src/domains/AdsDomain/services/MessengerService';

describe('parseMessagingEvents (pure)', () => {
  it('extracts sender PSID, text, page id, mid, and the CTM referral ad id', () => {
    const payload = {
      object: 'page',
      entry: [{
        id: 'PAGE123',
        messaging: [{
          sender: { id: 'PSID999' },
          recipient: { id: 'PAGE123' },
          message: { mid: 'mid.abc', text: 'How much for a repair?' },
          referral: { ad_id: 'AD777', source: 'ADS' },
        }],
      }],
    };
    expect(parseMessagingEvents(payload)).toEqual([
      { pageId: 'PAGE123', senderPsid: 'PSID999', text: 'How much for a repair?', mid: 'mid.abc', refAdId: 'AD777' },
    ]);
  });

  it('skips echoes (our own outbound), receipts, and non-text messages', () => {
    const payload = {
      entry: [{
        id: 'P1',
        messaging: [
          { sender: { id: 'S1' }, message: { is_echo: true, text: 'AI reply' } }, // our echo
          { sender: { id: 'S1' }, delivery: { mids: ['x'] } },                     // delivery receipt
          { sender: { id: 'S1' }, message: { attachments: [{ type: 'image' }] } }, // no text
          { sender: { id: 'S2' }, message: { mid: 'm2', text: 'hi' } },            // the real one
        ],
      }],
    };
    expect(parseMessagingEvents(payload)).toEqual([
      { pageId: 'P1', senderPsid: 'S2', text: 'hi', mid: 'm2', refAdId: undefined },
    ]);
  });

  it('tolerates an empty / malformed payload', () => {
    expect(parseMessagingEvents({})).toEqual([]);
    expect(parseMessagingEvents(null)).toEqual([]);
    expect(parseMessagingEvents({ entry: [{ id: 'P', messaging: [{}] }] })).toEqual([]);
  });
});

describe('MessengerService.enabled', () => {
  const prev = process.env.ADS_MESSENGER_ENABLED;
  afterEach(() => { if (prev === undefined) delete process.env.ADS_MESSENGER_ENABLED; else process.env.ADS_MESSENGER_ENABLED = prev; });
  it('reflects the flag', () => {
    const svc = new MessengerService();
    process.env.ADS_MESSENGER_ENABLED = 'true';
    expect(svc.enabled()).toBe(true);
    process.env.ADS_MESSENGER_ENABLED = 'false';
    expect(svc.enabled()).toBe(false);
  });
});
