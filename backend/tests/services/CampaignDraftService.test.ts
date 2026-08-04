// P1 of ai-campaign-in-workflow.md — the campaign's SHAPE, extracted so two callers cannot disagree
// about it.
//
// It lived inside the assistant's propose_campaign_draft tool. The workflow builder needs the same
// answer, and a second copy would drift the first time a block type changed — with the divergence
// surfacing in a customer's inbox rather than in a test.

import * as fs from 'fs';
import * as path from 'path';
import {
  bodyToBlocks,
  buildDesignContent,
  truncate,
} from '../../src/services/CampaignDraftService';

const SUBJECT = 'We miss you at Marco Auto';
const BODY = 'Hi there, it has been a while.\n\nCome see us — the kettle is on.';

describe('blocks', () => {
  it('leads with the subject as the headline', () => {
    const [first] = bodyToBlocks(SUBJECT, BODY);
    expect(first).toMatchObject({ type: 'headline', content: SUBJECT });
  });

  // The preview and the email have to agree with the copy the shop reviewed.
  it('splits the body on blank lines, one text block per paragraph', () => {
    const text = bodyToBlocks(SUBJECT, BODY).filter((b) => b.type === 'text');
    expect(text).toHaveLength(2);
    expect(text[0].content).toContain('been a while');
    expect(text[1].content).toContain('kettle');
  });

  it('drops empty paragraphs rather than emitting blank blocks', () => {
    const blocks = bodyToBlocks(SUBJECT, 'One.\n\n\n\nTwo.');
    expect(blocks.filter((b) => b.type === 'text')).toHaveLength(2);
  });
});

describe('designContent', () => {
  it('puts the banner ABOVE the headline', () => {
    const d = buildDesignContent(SUBJECT, BODY, 'https://img.test/banner.png') as any;
    expect(d.blocks[0]).toMatchObject({ type: 'image', src: 'https://img.test/banner.png' });
    expect(d.blocks[1]).toMatchObject({ type: 'headline' });
  });

  // Image generation is refused for ordinary reasons — kill-switch off, spend cap reached, prompt
  // flagged. None of them should cost the shop the copy it already paid for.
  it('produces a valid campaign with no image at all', () => {
    const d = buildDesignContent(SUBJECT, BODY, null) as any;
    expect(d.blocks[0]).toMatchObject({ type: 'headline' });
    expect(d.blocks.some((b: any) => b.type === 'image')).toBe(false);
  });

  // A model only writes text, so "[Claim Your Account]" in the body is dead literal text. Without a
  // real button the recipient has no way to act on it.
  it('adds a real claim button for imported win-back', () => {
    const d = buildDesignContent(SUBJECT, BODY, null, 'imported_winback') as any;
    expect(d.blocks.at(-1)).toMatchObject({ type: 'button', url: '/customer' });
  });

  it('adds no button for any other audience', () => {
    const d = buildDesignContent(SUBJECT, BODY, null, 'all_customers') as any;
    expect(d.blocks.some((b: any) => b.type === 'button')).toBe(false);
  });

  // The sender renders an unsubscribe from this; losing it is a compliance problem, not a style one.
  it('keeps the unsubscribe footer', () => {
    const d = buildDesignContent(SUBJECT, BODY) as any;
    expect(d.footer.showUnsubscribe).toBe(true);
  });
});

describe('preview text', () => {
  it('leaves short copy alone', () => {
    expect(truncate('short', 20)).toBe('short');
  });

  it('trims long copy to the limit', () => {
    expect(truncate('x'.repeat(50), 10)).toHaveLength(10);
  });
});

// The point of the extraction: the tool must no longer carry its own copy of any of this.
describe('the assistant tool delegates rather than duplicating', () => {
  const tool = fs.readFileSync(
    path.join(
      __dirname, '..', '..', 'src', 'domains', 'AIAgentDomain', 'services', 'marketing',
      'tools', 'proposeCampaignDraft.ts'
    ),
    'utf8'
  );

  it('calls the shared service', () => {
    expect(tool).toMatch(/campaignDraftService\.createFromCopy/);
  });

  it('no longer defines its own block builder', () => {
    expect(tool).not.toMatch(/function bodyToBlocks/);
  });

  it('no longer assembles designContent itself', () => {
    expect(tool).not.toMatch(/showUnsubscribe:\s*true/);
  });
});
