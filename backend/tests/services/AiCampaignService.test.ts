// P3 of ai-campaign-in-workflow.md — brief in, draft campaign out.
//
// The behaviour worth pinning is what happens when the IMAGE is refused. That is not an edge case:
// the ai_images_enabled kill-switch is off for some shops, the spend cap is monthly, and prompts get
// flagged. A shop that has used its image budget must still get a campaign, because the copy was
// already generated and paid for by then.

import { AiCampaignService } from '../../src/services/AiCampaignService';

const COPY = {
  subject: 'We have missed you',
  body: 'It has been a while.\n\nCome say hello.',
  imagePrompt: 'A tidy workshop in morning light',
};

const make = (over: { image?: any; copy?: any } = {}) => {
  const created: any[] = [];
  const copy = { generate: jest.fn(async () => over.copy ?? COPY) } as any;
  const drafts = {
    createFromCopy: jest.fn(async (input: any) => {
      created.push(input);
      return { id: 'camp-1', ...input };
    }),
  } as any;
  const images = {
    generate: jest.fn(async () => over.image ?? { ok: true, status: 200, imageUrl: 'https://img/b.png' }),
  } as any;
  return { svc: new AiCampaignService(copy, drafts, images), created, copy, drafts, images };
};

describe('the happy path', () => {
  it('writes copy, renders a banner, and persists a draft', async () => {
    const { svc, created } = make();
    const out = await svc.createDraft('peanut', { brief: 'win them back', name: 'Win back' });

    expect(out.campaign.id).toBe('camp-1');
    expect(out.imageSkipped).toBeUndefined();
    expect(created[0]).toMatchObject({
      shopId: 'peanut',
      subject: COPY.subject,
      imageUrl: 'https://img/b.png',
    });
  });

  it('names the campaign after the workflow, falling back to the subject', async () => {
    const { svc, created } = make();
    await svc.createDraft('peanut', {});
    expect(created[0].name).toBe(COPY.subject);
  });

  // The workflow has no Target Audience for a campaign action — the campaign resolves its own, and
  // the two vocabularies do not line up (inactive_30d vs top_spenders). Starting at everyone is
  // honest; inventing a mapping would be guessing who the shop meant.
  it('starts at all customers rather than inventing an audience', async () => {
    const { svc, created } = make();
    await svc.createDraft('peanut', { targetAudience: 'inactive_30d' });
    expect(created[0].audienceType).toBe('all_customers');
  });
});

describe('when the banner is refused', () => {
  it('still creates the campaign, and says why there is no image', async () => {
    const { svc, created } = make({
      image: { ok: false, status: 429, error: 'Monthly image budget reached.' },
    });
    const out = await svc.createDraft('peanut', {});

    expect(out.campaign.id).toBe('camp-1');
    expect(out.imageSkipped).toMatch(/budget/i);
    expect(created[0].imageUrl).toBeNull();
  });

  it('survives the image service throwing outright', async () => {
    const images = {
      generate: jest.fn(async () => {
        throw new Error('storage unreachable');
      }),
    } as any;
    const copy = { generate: jest.fn(async () => COPY) } as any;
    const drafts = { createFromCopy: jest.fn(async (i: any) => ({ id: 'camp-1', ...i })) } as any;

    const out = await new AiCampaignService(copy, drafts, images).createDraft('peanut', {});
    expect(out.campaign.id).toBe('camp-1');
    expect(out.imageSkipped).toBeTruthy();
  });

  it('skips the image step entirely when no brief was written for it', async () => {
    const { svc, images } = make({ copy: { ...COPY, imagePrompt: '' } });
    const out = await svc.createDraft('peanut', {});

    expect(images.generate).not.toHaveBeenCalled();
    expect(out.imageSkipped).toBeTruthy();
  });
});

describe('when the copy fails', () => {
  // Copy is the one step with no degraded path — there is no campaign without it. The error carries
  // its own status (429 budget, 422 invented offer, 502 unusable) so the caller can relay the reason
  // rather than flattening it.
  it('does not create an empty campaign', async () => {
    const copy = {
      generate: jest.fn(async () => {
        throw Object.assign(new Error('AI budget reached'), { status: 429 });
      }),
    } as any;
    const drafts = { createFromCopy: jest.fn() } as any;
    const images = { generate: jest.fn() } as any;

    await expect(
      new AiCampaignService(copy, drafts, images).createDraft('peanut', {})
    ).rejects.toMatchObject({ status: 429 });

    expect(drafts.createFromCopy).not.toHaveBeenCalled();
    expect(images.generate).not.toHaveBeenCalled();
  });
});
