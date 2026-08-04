// P2 of ai-campaign-in-workflow.md — one call writes the subject, the body and the image brief.
//
// The parsing matters more than it looks: the model returns JSON, and a model that wraps it in a
// fence is not misbehaving, it is being a model. Failing on that would be a self-inflicted outage on
// the shop's dime, since the generation was already paid for by the time we try to read it.

import { CampaignCopyService } from '../../src/services/CampaignCopyService';
import { statesUnaskedOffer } from '../../src/services/aiCopyGuards';

const GOOD = {
  subject: 'We have missed you at Marco Auto',
  body: 'It has been a while since your last visit.\n\nWe are open Saturdays now — come say hello.',
  imagePrompt: 'A tidy repair workshop with morning light through the roller door',
};

const make = (text: string, costUsd = 0.002) => {
  const anthropic = { complete: jest.fn(async () => ({ text, costUsd })) } as any;
  const spendCap = {
    canSpend: jest.fn(async () => ({ allowed: true })),
    recordSpend: jest.fn(async () => undefined),
  } as any;
  const brandKit = { getBrandKit: jest.fn(async () => null) } as any;
  return {
    svc: new CampaignCopyService(anthropic, spendCap, brandKit),
    anthropic,
    spendCap,
  };
};

describe('one call, three outputs', () => {
  it('returns subject, body and image brief together', async () => {
    const { svc, anthropic } = make(JSON.stringify(GOOD));
    const out = await svc.generate('peanut', { brief: 'friendly nudge' });

    expect(out.subject).toBe(GOOD.subject);
    expect(out.body).toContain('Saturdays');
    expect(out.imagePrompt).toContain('workshop');
    // The whole point: one generation, not one for copy and another to describe an image.
    expect(anthropic.complete).toHaveBeenCalledTimes(1);
  });

  it('reads JSON the model wrapped in a code fence', async () => {
    const { svc } = make('```json\n' + JSON.stringify(GOOD) + '\n```');
    await expect(svc.generate('peanut', {})).resolves.toMatchObject({ subject: GOOD.subject });
  });

  it('reads JSON with prose around it', async () => {
    const { svc } = make(`Sure! Here you go:\n${JSON.stringify(GOOD)}\nHope that helps.`);
    await expect(svc.generate('peanut', {})).resolves.toMatchObject({ subject: GOOD.subject });
  });
});

describe('when it cannot be used', () => {
  it('fails loudly on unparseable output rather than persisting nothing useful', async () => {
    const { svc } = make('I would be happy to help you write that campaign!');
    await expect(svc.generate('peanut', {})).rejects.toThrow(/usable campaign/i);
  });

  it('fails when the copy came back empty', async () => {
    const { svc } = make(JSON.stringify({ subject: '', body: '', imagePrompt: 'x' }));
    await expect(svc.generate('peanut', {})).rejects.toThrow(/usable campaign/i);
  });

  // The spend happened whether or not the output was readable. Not recording it would under-report
  // the shop's usage and let a loop of failed generations run past the cap unnoticed.
  it('records the spend even when the output is unusable', async () => {
    const { svc, spendCap } = make('nonsense');
    await expect(svc.generate('peanut', {})).rejects.toThrow();
    expect(spendCap.recordSpend).toHaveBeenCalled();
  });

  it('refuses before spending when the monthly budget is gone', async () => {
    const { svc, anthropic, spendCap } = make(JSON.stringify(GOOD));
    spendCap.canSpend.mockResolvedValueOnce({ allowed: false });

    await expect(svc.generate('peanut', {})).rejects.toThrow(/budget/i);
    expect(anthropic.complete).not.toHaveBeenCalled();
  });
});

describe('offers it will not invent', () => {
  it('rejects a discount the brief never asked for', async () => {
    const { svc } = make(
      JSON.stringify({ ...GOOD, body: 'Come back for 20% off your next service.' })
    );
    await expect(svc.generate('peanut', { brief: 'friendly nudge' })).rejects.toThrow(/20% off|percentage/i);
  });

  it('allows an offer the shop asked for', async () => {
    const { svc } = make(
      JSON.stringify({ ...GOOD, body: 'Here is 20% off your next visit, as promised.' })
    );
    await expect(svc.generate('peanut', { brief: 'give them 20% off' })).resolves.toBeTruthy();
  });

  // Shared with the AI step deliberately — an email campaign carries the same risk as an in-app
  // message, and two definitions of "an offer we did not agree to" would drift.
  it('uses the same rule the AI step uses', () => {
    expect(statesUnaskedOffer('save 30%', undefined)).toMatch(/percentage/);
    expect(statesUnaskedOffer('feel free to call', undefined)).toBeNull();
  });
});
