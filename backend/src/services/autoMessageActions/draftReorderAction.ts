// backend/src/services/autoMessageActions/draftReorderAction.ts
//
// Custom Workflows §9.2 item 2 — the `draft_reorder` action. Closes the loop `low_stock` opens: instead
// of only telling the owner a part is running out, the workflow drafts the purchase order.
//
// SHOP-SCOPED. Reordering happens to the shop's inventory, not to a customer, so it runs once per rule
// per tick rather than once per person in an audience — the same reason notify_staff and run_campaign
// are listed there.
//
// THIS ACTION WRITES, AND THAT IS THE POINT — which is worth stating because the last thing to call
// POSuggestionService from an automated path did so by accident. `reorder_recommendation`, an insights
// TOOL presented as a read, called generateSuggestions() from a nightly detector and manufactured 12
// purchase-order suggestions across 5 staging shops before anyone noticed. The lesson recorded then was
// "never call it from a detector or a sweep", and this is not a violation of it: a detector claims to
// observe, whereas an action the shop deliberately configured and published is asking for the write.
//
// Repeat firing is safe: createSuggestion() looks for an existing suggestion per item and returns it
// rather than creating a duplicate, so a low_stock rule that fires on consecutive ticks converges on
// one draft per item. Nothing here adds a second layer of de-duplication on top — two competing
// throttles is how you get either duplicates or silence, which is the same reasoning that keeps
// handleShopEvent free of its own dedup.
//
// A suggestion is a DRAFT: it lands in the shop's PO suggestions list for a human to approve. The
// workflow never places an order or spends money on its own.

import { logger } from '../../utils/logger';
import { getPOSuggestionService } from '../POSuggestionService';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

/** The slice this action needs, injected so it is testable without an inventory fixture. */
export interface ReorderDrafter {
  generateSuggestions(shopId: string): Promise<Array<unknown>>;
}

export class DraftReorderAction implements AutoMessageActionHandler {
  readonly type = 'draft_reorder';

  constructor(private readonly suggestions?: ReorderDrafter) {}

  private drafter(): ReorderDrafter {
    // Resolved lazily: getPOSuggestionService() reaches for the shared pool, and building it at module
    // load would drag the inventory service into every process that imports the registry.
    return this.suggestions ?? getPOSuggestionService();
  }

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    try {
      const drafted = await this.drafter().generateSuggestions(ctx.shopId);

      // Zero is a normal outcome, not a failure: the trigger fired for one item, and by the time the
      // action ran the reorder logic may find nothing at or below its threshold. Logged because a
      // workflow that reports success while drafting nothing, run after run, is worth being able to see.
      logger.info('draft_reorder ran', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        drafted: drafted.length,
      });

      return { ok: true };
    } catch (err) {
      // The scheduler is mid-tick across every shop; one inventory failure must not end the run.
      logger.error('draft_reorder failed', {
        ruleId: ctx.rule.id,
        shopId: ctx.shopId,
        error: (err as Error)?.message,
      });
      return { ok: false };
    }
  }
}
