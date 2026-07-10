// Messenger leads arrive as a bare PSID (no name) → "Unnamed lead". getProfileName trades the PSID
// for the user's public name via the Page token so the card shows a real name. Best-effort: any
// error (privacy block / expired token / permission gap) must resolve to null, never throw.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { MessengerService } from '../../src/domains/AdsDomain/services/MessengerService';

describe('MessengerService.getProfileName', () => {
  const svc = new MessengerService();
  beforeEach(() => mockedAxios.get.mockReset());

  it('joins first + last name from the User Profile API', async () => {
    mockedAxios.get.mockResolvedValue({ data: { first_name: 'Jorge', last_name: 'Santos' } } as any);
    expect(await svc.getProfileName('PAGE_TOKEN', 'PSID1')).toBe('Jorge Santos');
    // Hits the PSID node with the name fields + the page token.
    const [url, opts] = mockedAxios.get.mock.calls[0];
    expect(url).toContain('/PSID1');
    expect((opts as any).params).toMatchObject({ fields: 'first_name,last_name', access_token: 'PAGE_TOKEN' });
  });

  it('falls back to whichever name part is present', async () => {
    mockedAxios.get.mockResolvedValue({ data: { first_name: 'Jorge' } } as any);
    expect(await svc.getProfileName('t', 'PSID2')).toBe('Jorge');
  });

  it('returns null (not "") when the profile has no name', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} } as any);
    expect(await svc.getProfileName('t', 'PSID3')).toBeNull();
  });

  it('swallows API errors and returns null (lead creation must never fail on this)', async () => {
    mockedAxios.get.mockRejectedValue({ response: { data: { error: { message: 'no permission', code: 10 } } } });
    await expect(svc.getProfileName('t', 'PSID4')).resolves.toBeNull();
  });
});
