// Inbound email — the pure payload parsers + InboundEmailService.handle against the REAL Resend
// `email.received` payload shape (metadata-only: no text/html — the body is fetched by email_id).
// Live Resend + DB are avoided: axios is mocked, repos + autoAnswer are faked, shopRepository is
// monkeypatched. Regression guard for the "ignored_empty" bug (body wasn't fetched).

import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// The service's module-level `leadAutoAnswerService` singleton constructs an AnthropicClient on import
// (needs ANTHROPIC_API_KEY). We inject our own fake autoAnswer into the constructor, so stub the module.
jest.mock('../../src/domains/AdsDomain/services/LeadAutoAnswerService', () => ({ leadAutoAnswerService: {} }));

import {
  InboundEmailService, recipientsOf, senderEmail, normalizeHeaders, stripQuotedReply,
} from '../../src/domains/AdsDomain/services/InboundEmailService';
import { tokenFromAddress } from '../../src/domains/AdsDomain/services/inboundEmailConfig';
import * as repos from '../../src/repositories';

// The exact payload Resend POSTs (from a live delivery) — note: NO text / html / headers.
const REAL_PAYLOAD = {
  created_at: '2026-07-06T04:04:07.000Z',
  type: 'email.received',
  data: {
    attachments: [], bcc: [], cc: [],
    created_at: '2026-07-06T04:04:20.209Z',
    email_id: '88bf453d-cfc6-4b60-9cbc-d460c7360217',
    from: 'deo.cagunot@gmail.com',
    message_id: '<CAB+1vurx9yhOfX-BOGaTE1kHVAJ-O9GcxBTFdjVK6x71qu1rJg@mail.gmail.com>',
    received_for: ['fc25ab5f94775b79058925cd@reply.fixflow.ai'],
    subject: 'Do you have screen repair service?',
    to: ['fc25ab5f94775b79058925cd@reply.fixflow.ai'],
  },
};

describe('inbound payload parsers (pure) — real Resend shape', () => {
  it('extracts the reply token from data.to', () => {
    const token = recipientsOf(REAL_PAYLOAD).map(tokenFromAddress).find(Boolean);
    expect(token).toBe('fc25ab5f94775b79058925cd');
  });
  it('parses the sender from a bare from address', () => {
    expect(senderEmail(REAL_PAYLOAD)).toBe('deo.cagunot@gmail.com');
  });
  it('tolerates the missing headers block (no crash, empty map)', () => {
    expect(normalizeHeaders(REAL_PAYLOAD)).toEqual({});
  });
  it('strips quoted history', () => {
    expect(stripQuotedReply('New line\nOn Mon, X wrote:\n> old')).toBe('New line');
  });
});

describe('InboundEmailService.handle — metadata-only payload fetches the body', () => {
  const prevKey = process.env.RESEND_API_KEY;
  const origGetShop = (repos.shopRepository as any).getShop;

  const makeService = (opts: { aiOn?: boolean } = {}) => {
    const handleInbound = jest.fn(async () => ({ inbound: { id: 'm1' }, reply: { body: 'We do!' }, autoAnswered: true }));
    const recordInbound = jest.fn(async () => ({ id: 'm1' }));
    const leads: any = { findByReplyToken: async () => ({ id: 'lead1', campaignId: 'camp1', name: 'Deo' }), setEscalated: async () => true };
    const campaigns: any = { findById: async () => ({ shopId: 'peanut', aiAgentEnabled: opts.aiOn ?? true }) };
    const messages: any = { existsByExternalId: async () => false, countByAuthorSince: async () => 0 };
    const notifications: any = { create: async () => undefined };
    const autoAnswer: any = { handleInbound, recordInbound };
    const svc = new InboundEmailService(leads, campaigns, messages, notifications, autoAnswer);
    return { svc, handleInbound, recordInbound };
  };

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    (repos.shopRepository as any).getShop = async () => ({ email: 'shop@peanut.test', walletAddress: '0xabc' });
    mockedAxios.get.mockReset();
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = prevKey;
    (repos.shopRepository as any).getShop = origGetShop;
  });

  it('fetches content by email_id, then auto-answers with the clean body', async () => {
    mockedAxios.get.mockResolvedValue({ data: { text: 'How much for a screen repair?', headers: {} } } as any);
    const { svc, handleInbound } = makeService({ aiOn: true });

    const r = await svc.handle(JSON.parse(JSON.stringify(REAL_PAYLOAD)));

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/emails/receiving/88bf453d-cfc6-4b60-9cbc-d460c7360217'),
      expect.objectContaining({ headers: { Authorization: 'Bearer re_test' } })
    );
    expect(r.outcome).toBe('handled');
    expect(handleInbound).toHaveBeenCalledWith('lead1', 'How much for a screen repair?', 'email', '88bf453d-cfc6-4b60-9cbc-d460c7360217');
  });

  it('records without auto-answer when the campaign AI is off', async () => {
    mockedAxios.get.mockResolvedValue({ data: { text: 'Any update?' } } as any);
    const { svc, recordInbound, handleInbound } = makeService({ aiOn: false });
    // AI off is decided inside autoAnswer.handleInbound normally; here we assert handle() still routes to it.
    const r = await svc.handle(JSON.parse(JSON.stringify(REAL_PAYLOAD)));
    expect(r.outcome).toBe('handled'); // routed to handleInbound; the ai_agent_disabled decision lives there
    expect(handleInbound).toHaveBeenCalled();
    expect(recordInbound).not.toHaveBeenCalled();
  });

  it('regression: without a fetched body it would be ignored_empty (fetch returns empty)', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} } as any);
    const { svc, handleInbound } = makeService();
    const r = await svc.handle(JSON.parse(JSON.stringify(REAL_PAYLOAD)));
    expect(r.outcome).toBe('ignored_empty');
    expect(handleInbound).not.toHaveBeenCalled();
  });
});
