// Custom Workflows — the campaign is required to PUBLISH, not to save.
// Plan: docs/tasks/strategy/custom-workflows/campaign-action-editor-embed.md (P1, decision D3).
//
// The requirement was applied at save, which sounded right and destroyed work. A shop with no
// campaign yet had to leave the builder for Marketing, and lost the trigger, name and timing on the
// way out. But the reason the requirement exists — a live rule erroring hourly against a campaign it
// does not have — is a property of a PUBLISHED rule. A draft never runs, so it cannot error.

import * as fs from 'fs';
import * as path from 'path';

const controller = fs
  .readFileSync(
    path.join(__dirname, '..', '..', 'src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts'),
    'utf8'
  )
  // Assert against code, not the comments that explain the old behaviour.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('saving a campaign workflow', () => {
  /** The run_campaign arm of parseAction, up to its return. */
  const arm = (() => {
    const start = controller.indexOf("if (actionType === 'run_campaign')");
    expect(start).toBeGreaterThan(-1);
    return controller.slice(start, controller.indexOf('}', controller.indexOf('return', start)));
  })();

  it('does not reject a save for a missing campaign', () => {
    expect(arm).not.toMatch(/error:\s*'run_campaign needs/);
  });

  it('still stores the campaign when one was chosen', () => {
    expect(arm).toMatch(/parseRunCampaignPayload\(rawPayload\)/);
  });
});

describe('publishing a campaign workflow', () => {
  const handler = (() => {
    const start = controller.indexOf('publishAutoMessage = async');
    expect(start).toBeGreaterThan(-1);
    return controller.slice(start, controller.indexOf('toggleAutoMessage', start));
  })();

  // The whole point of moving the check: a published rule with no campaign logs an error every tick
  // and sends nothing, which is the silent failure this validator exists to prevent.
  it('refuses to publish a campaign workflow with no campaign', () => {
    expect(handler).toMatch(/actionType === 'run_campaign'/);
    expect(handler).toMatch(/campaignId/);
    expect(handler).toMatch(/status\(400\)/);
  });

  // The error has to name something visible on the form. "actionPayload.campaignId" appears nowhere
  // on screen, so it would read as an internal fault rather than an instruction.
  it('says it in the words the form uses', () => {
    expect(handler).toMatch(/Pick the campaign this workflow should send/);
  });

  // getById is not shop-scoped. A rule belonging to another shop must read as "not found", not as a
  // validation failure — the latter confirms it exists.
  it('checks ownership before validating', () => {
    expect(handler).toMatch(/existing\.shopId !== shopId/);
    expect(handler).toMatch(/status\(404\)/);
  });
});
