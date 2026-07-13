// Twilio inbound webhook routing: signature gate, global STOP/START opt-out, delivery-status
// callbacks, and routing a plain inbound text into the ads lead loop. Deps are mocked; normalizePhone
// is the real (pure) util.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

const verify = jest.fn().mockReturnValue(true);
jest.mock('../../src/services/TwilioService', () => ({ twilioService: { verifyWebhookSignature: (...a: any) => verify(...a) } }));

const optOut = jest.fn(); const optIn = jest.fn();
jest.mock('../../src/repositories/SmsOptOutRepository', () => ({ smsOptOutRepository: { optOut: (...a: any) => optOut(...a), optIn: (...a: any) => optIn(...a) } }));

const handleInbound = jest.fn();
jest.mock('../../src/domains/AdsDomain/services/LeadAutoAnswerService', () => ({ leadAutoAnswerService: { handleInbound: (...a: any) => handleInbound(...a) } }));

const findByPhone = jest.fn();
jest.mock('../../src/domains/AdsDomain/repositories/LeadRepository', () => ({ LeadRepository: class { findByPhone = (...a: any) => findByPhone(...a); } }));

const updateStatus = jest.fn();
jest.mock('../../src/domains/AdsDomain/repositories/LeadMessageRepository', () => ({ LeadMessageRepository: class { updateDeliveryStatusByExternalId = (...a: any) => updateStatus(...a); } }));

import { receiveTwilioWebhook } from '../../src/domains/AdsDomain/controllers/TwilioWebhookController';

function mkRes() {
  const r: any = { statusCode: 0 };
  r.sendStatus = jest.fn((c: number) => { r.statusCode = c; return r; });
  r.type = jest.fn(() => r);
  r.send = jest.fn(() => r);
  return r;
}
function mkReq(body: any) {
  return { body, header: () => 'sig', headers: {}, protocol: 'https', get: () => 'api.example.com', originalUrl: '/api/ads/webhooks/twilio' } as any;
}

beforeEach(() => { jest.clearAllMocks(); verify.mockReturnValue(true); });

describe('receiveTwilioWebhook', () => {
  it('rejects a bad signature with 403 and does no processing', async () => {
    verify.mockReturnValueOnce(false);
    const res = mkRes();
    await receiveTwilioWebhook(mkReq({ From: '+15551234567', Body: 'STOP' }), res);
    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(optOut).not.toHaveBeenCalled();
  });

  it('records a GLOBAL opt-out on STOP', async () => {
    await receiveTwilioWebhook(mkReq({ From: '+1 (555) 123-4567', Body: 'STOP' }), mkRes());
    expect(optOut).toHaveBeenCalledWith('+15551234567', 'stop_keyword');
    expect(handleInbound).not.toHaveBeenCalled();
  });

  it('re-subscribes on START', async () => {
    await receiveTwilioWebhook(mkReq({ From: '+15551234567', Body: 'start' }), mkRes());
    expect(optIn).toHaveBeenCalledWith('+15551234567', 'start_keyword');
  });

  it('updates delivery status from a status callback (keyed on MessageSid)', async () => {
    await receiveTwilioWebhook(mkReq({ MessageStatus: 'delivered', MessageSid: 'SM1', From: '+15551234567' }), mkRes());
    expect(updateStatus).toHaveBeenCalledWith('SM1', 'delivered');
    expect(handleInbound).not.toHaveBeenCalled();
  });

  it('routes a plain inbound text into the lead loop when a lead matches the phone', async () => {
    findByPhone.mockResolvedValue({ id: 'L1' });
    await receiveTwilioWebhook(mkReq({ From: '+15551234567', Body: 'How much for a screen repair?', MessageSid: 'SM2' }), mkRes());
    expect(handleInbound).toHaveBeenCalledWith('L1', 'How much for a screen repair?', 'sms', 'SM2');
  });

  it('skips an inbound text from an unknown phone (no lead)', async () => {
    findByPhone.mockResolvedValue(null);
    await receiveTwilioWebhook(mkReq({ From: '+15559999999', Body: 'hi' }), mkRes());
    expect(handleInbound).not.toHaveBeenCalled();
  });
});
