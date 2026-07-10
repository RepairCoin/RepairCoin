// Channel derivation: per-lead click-ids are the precise signal; a landing-page lead with no
// click-id falls back to the campaign's ad platform (Meta→Facebook, Google→Google) so FB
// link-click ads that land on our page aren't mislabelled as generic "Web form".
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { deriveLeadChannel } from '../../src/domains/AdsDomain/repositories/LeadRepository';

describe('deriveLeadChannel', () => {
  it('uses the lead identifiers first (most precise), regardless of platform', () => {
    expect(deriveLeadChannel({ messenger_id: 'PSID' }, 'meta')).toBe('messenger');
    expect(deriveLeadChannel({ whatsapp_id: 'WA' }, 'meta')).toBe('whatsapp');
    expect(deriveLeadChannel({ gclid: 'g' }, 'meta')).toBe('google');   // gclid wins over meta platform
    expect(deriveLeadChannel({ fbclid: 'f' }, 'google')).toBe('facebook');
    expect(deriveLeadChannel({ meta_lead_id: 'm' }, 'meta')).toBe('meta_form');
  });

  it('falls back to the campaign platform for a no-click-id landing-page lead', () => {
    expect(deriveLeadChannel({}, 'meta')).toBe('facebook');   // FB link-click ad → our page
    expect(deriveLeadChannel({}, 'google')).toBe('google');
  });

  it('is "webform" only when there is no click-id and no known platform', () => {
    expect(deriveLeadChannel({})).toBe('webform');
    expect(deriveLeadChannel({}, null)).toBe('webform');
    expect(deriveLeadChannel({}, 'unknown')).toBe('webform');
  });
});
