// Regression: a Messenger/WhatsApp lead must route to its chat channel, not fall back to 'manual'.
// Bug (fixed): LeadRepository.mapRow computed hasChatChannel from messenger_id but never mapped the
// id onto the AdLead, so findById returned messengerId: undefined → LeadChannelSender.pickChannel
// fell through to 'manual' → deliver() recorded the AI reply but never sent it over the Send API.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { LeadRepository } from '../../src/domains/AdsDomain/repositories/LeadRepository';
import { LeadChannelSender } from '../../src/domains/AdsDomain/services/LeadChannelSender';

describe('LeadRepository.mapRow — chat-channel routing', () => {
  const repo = new LeadRepository();
  const map = (row: any) => (repo as any).mapRow({ campaign_id: 'C1', lead_status: 'new', ...row });

  it('maps messenger_id so the lead routes to Messenger (not manual)', () => {
    const lead = map({ id: 'L1', messenger_id: 'PSID123' });
    expect(lead.messengerId).toBe('PSID123');
    expect(lead.hasChatChannel).toBe(true);
    expect(LeadChannelSender.pickChannel(lead)).toBe('messenger');
  });

  it('maps whatsapp_id so the lead routes to WhatsApp', () => {
    const lead = map({ id: 'L2', whatsapp_id: 'WA1' });
    expect(lead.whatsappId).toBe('WA1');
    expect(LeadChannelSender.pickChannel(lead)).toBe('whatsapp');
  });

  it('leaves chat ids null and routes email/manual for non-chat leads', () => {
    const emailLead = map({ id: 'L3', email: 'a@b.com' });
    expect(emailLead.messengerId).toBeNull();
    expect(emailLead.whatsappId).toBeNull();
    expect(emailLead.hasChatChannel).toBe(false);
    expect(LeadChannelSender.pickChannel(emailLead)).toBe('email');

    const bare = map({ id: 'L4' });
    expect(LeadChannelSender.pickChannel(bare)).toBe('manual');
  });
});
