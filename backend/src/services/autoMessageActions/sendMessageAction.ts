// backend/src/services/autoMessageActions/sendMessageAction.ts
//
// The `send_message` action — the historical behaviour of every auto-message rule, lifted verbatim
// out of AutoMessageSchedulerService so it becomes one handler among many rather than the only thing
// the engine can do.
//
// This exact block (get-or-create conversation → skip if blocked → create message → bump unread) was
// duplicated in BOTH engine paths (immediate sends and queued drip steps). Extracting it removes that
// duplication as well as hard-coding.

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import type {
  AutoMessageActionContext,
  AutoMessageActionHandler,
  AutoMessageActionResult,
} from './types';

/** The slice of MessageRepository this action needs — injected so it stays unit-testable. */
export interface SendMessageDeps {
  getOrCreateConversation(customerAddress: string, shopId: string): Promise<{ conversationId: string; isBlocked?: boolean }>;
  createMessage(input: Record<string, unknown>): Promise<{ message: { messageId: string } }>;
  incrementUnreadCount(conversationId: string, side: string, preview: string): Promise<unknown>;
}

export class SendMessageAction implements AutoMessageActionHandler {
  readonly type = 'send_message';

  constructor(private readonly messages: SendMessageDeps) {}

  async execute(ctx: AutoMessageActionContext): Promise<AutoMessageActionResult> {
    const messageText = (ctx.messageText ?? '').trim();
    if (!messageText) {
      // Historically impossible (message_template is NOT NULL), but a drip step whose template was
      // emptied should no-op rather than post a blank message to a customer.
      logger.warn('send_message action skipped — empty body', { ruleId: ctx.rule.id, shopId: ctx.shopId });
      return { ok: false, skipped: 'empty' };
    }

    const conversation = await this.messages.getOrCreateConversation(ctx.customerAddress, ctx.shopId);

    // A blocked conversation has always been a silent skip, not a failure. Callers rely on this.
    if (conversation.isBlocked) {
      logger.debug('Skipping blocked conversation', { ruleId: ctx.rule.id, customer: ctx.customerAddress });
      return { ok: false, skipped: 'blocked', conversationId: conversation.conversationId };
    }

    const messageId = `msg_${uuidv4()}`;
    const { message } = await this.messages.createMessage({
      messageId,
      conversationId: conversation.conversationId,
      senderAddress: ctx.shopId,
      senderType: 'shop',
      messageText,
      messageType: 'text',
      metadata: {
        autoMessageId: ctx.rule.id,
        autoMessageName: ctx.rule.name,
        isAutoMessage: true,
      },
    });

    await this.messages.incrementUnreadCount(conversation.conversationId, 'customer', messageText);

    return { ok: true, messageId: message.messageId, conversationId: conversation.conversationId };
  }
}
