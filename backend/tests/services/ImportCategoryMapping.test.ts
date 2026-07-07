// AI category mapping — the model's answers are VALIDATED against the fixed marketplace taxonomy:
// valid buckets are kept, anything outside the list is dropped (caller then defaults to the catch-all),
// and an over-budget shop falls back gracefully. AnthropicClient is stubbed (import-time construction).
jest.mock('../../src/domains/AIAgentDomain/services/AnthropicClient', () => ({ AnthropicClient: class {} }));

import { ImportMappingService } from '../../src/domains/customer/services/CustomerImportMappingService';
import { VALID_CATEGORIES } from '../../src/domains/ServiceDomain/constants';

const make = (opts: { text?: string; allowed?: boolean; throws?: boolean }) => {
  const anthropic: any = { complete: async () => { if (opts.throws) throw new Error('llm down'); return { text: opts.text ?? '{}', costUsd: 0.0002 }; } };
  const spendCap: any = { canSpend: async () => ({ allowed: opts.allowed ?? true }), recordSpend: async () => {} };
  return new ImportMappingService('services', anthropic, spendCap);
};

describe('ImportMappingService.mapCategories', () => {
  const CATS = Array.from(VALID_CATEGORIES);

  it('keeps valid buckets and DROPS answers outside the taxonomy', async () => {
    const svc = make({ text: '{"game_console_repairs":"repairs","boxing_&_accessories":"fitness_gyms","accessories":"made_up_bucket"}' });
    const { mapping } = await svc.mapCategories(['game_console_repairs', 'boxing_&_accessories', 'accessories'], CATS, 'shop1');
    expect(mapping['game_console_repairs']).toBe('repairs');
    expect(mapping['boxing_&_accessories']).toBe('fitness_gyms');
    expect(mapping['accessories']).toBeUndefined(); // invalid target rejected → caller defaults to other
  });

  it('falls back to {} when the shop is over AI budget (non-fatal)', async () => {
    const svc = make({ allowed: false, text: '{"x":"repairs"}' });
    expect((await svc.mapCategories(['x'], CATS, 'shop1')).mapping).toEqual({});
  });

  it('falls back to {} when the model call fails (non-fatal)', async () => {
    const svc = make({ throws: true });
    expect((await svc.mapCategories(['x'], CATS, 'shop1')).mapping).toEqual({});
  });

  it('no-ops on empty input (no AI call)', async () => {
    const svc = make({ text: '{}' });
    expect((await svc.mapCategories([], CATS, 'shop1')).mapping).toEqual({});
  });
});
