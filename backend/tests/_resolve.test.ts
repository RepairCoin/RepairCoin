import { describe, it, expect } from '@jest/globals';
describe('archive path resolution (Step 5 reversibility)', () => {
  it('TokenMinter loads via _archive path', async () => {
    const m = await import('../src/contracts/_archive/TokenMinter');
    expect(typeof m.getTokenMinter).toBe('function');
    expect(typeof m.TokenMinter).toBe('function');
  });
  it('shop BlockchainService loads via _archive path', async () => {
    const m = await import('../src/contracts/_archive/BlockchainService');
    expect(typeof m.getBlockchainService).toBe('function');
  });
  it('MultiContractMinter loads via _archive path', async () => {
    const m = await import('../src/contracts/_archive/MultiContractMinter');
    expect(m).toBeDefined();
  });
});
