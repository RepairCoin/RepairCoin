// backend/src/domains/AdsDomain/services/LeadAutoAnswerService.ts
//
// Stage 3.5 — FULL AI auto-answer. When a lead replies and the campaign has
// ai_agent_enabled, the AI answers automatically (multi-turn, brand-voiced),
// persists the exchange, and hands the reply to the channel sender. With the toggle
// off it stays draft-only (Option C / LeadAIService). Spend-capped + cost-ledgered
// like every other ads AI call. It answers questions and nudges toward booking; it
// does NOT itself create bookings (that handoff is a later, separate integration).

import { logger } from '../../../utils/logger';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { BrandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { shopRepository } from '../../../repositories';
import { ChatMessage, ClaudeModel } from '../../AIAgentDomain/types';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { AiCostRepository } from '../repositories/AiCostRepository';
import { LeadMessageRepository, LeadMessage, MsgChannel } from '../repositories/LeadMessageRepository';
import { LeadChannelSender } from './LeadChannelSender';

const MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

const systemPromptFor = (shopName: string, industry: string, voice: string, campaign: string): string =>
  `You are the customer-service assistant for ${shopName}, a ${industry}. A lead responded ` +
  `to the "${campaign}" ad and is now messaging. Hold a natural, helpful conversation: answer ` +
  `their questions, address concerns, and gently move them toward booking an appointment. ` +
  `Rules: plain text only, NO markdown; 1-3 short sentences; warm and professional in this brand ` +
  `voice — ${voice}. NEVER invent prices, availability, or guarantees you weren't given; if you ` +
  `don't know, offer to have the team confirm. If the lead wants to book, tell them you'll get ` +
  `them set up and that the team will confirm the time. Do not claim a booking is already made. ` +
  `Output ONLY the message to send.`;

export interface AutoAnswerResult {
  inbound: LeadMessage;
  reply: LeadMessage | null;
  autoAnswered: boolean;
  reason?: string; // why no reply (toggle off, budget, etc.)
}

export class LeadAutoAnswerService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = new BrandKitService(),
    private readonly leads = new LeadRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly aiCosts = new AiCostRepository(),
    private readonly messages = new LeadMessageRepository(),
    private readonly channel = new LeadChannelSender()
  ) {}

  async getThread(leadId: string): Promise<LeadMessage[]> {
    return this.messages.listByLead(leadId);
  }

  /** Store an inbound message from the lead. */
  async recordInbound(leadId: string, body: string, channel?: MsgChannel): Promise<LeadMessage> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    const ch = channel ?? LeadChannelSender.pickChannel(lead);
    return this.messages.append({ leadId, direction: 'inbound', author: 'lead', channel: ch, body });
  }

  /** Store an admin's manual reply and (attempt to) deliver it. */
  async sendAdminMessage(leadId: string, body: string): Promise<LeadMessage> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    const channel = LeadChannelSender.pickChannel(lead);
    const deliveryStatus = await this.channel.deliver(channel, lead, body);
    await this.markRespondedIfNew(lead.id, lead.leadStatus);
    return this.messages.append({ leadId, direction: 'outbound', author: 'admin', channel, body, deliveryStatus });
  }

  /** Generate (and persist + deliver) an AI reply for the current thread. Used both
   *  by the auto path and the admin "AI answer" button. Throws {status} on a gate. */
  async generateReply(leadId: string): Promise<LeadMessage> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    const campaign = await this.campaigns.findById(lead.campaignId);
    const shopId = campaign?.shopId;
    if (!shopId) throw Object.assign(new Error('Lead campaign/shop not found'), { status: 404 });

    const spend = await this.spendCap.canSpend(shopId);
    if (!spend.allowed) {
      throw Object.assign(new Error('Monthly AI budget exhausted. Try again next month.'), { status: 429 });
    }

    const [shop, kit, thread] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
      this.messages.listByLead(leadId),
    ]);
    const shopName = (shop as any)?.name || 'the shop';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const industry = kit?.industryStyle || 'local service business';

    // Map the thread to chat turns: the lead is the "user", AI/admin are "assistant".
    const history: ChatMessage[] = thread.map((m) => ({
      role: m.author === 'lead' ? 'user' : 'assistant',
      content: m.body,
    }));
    // Anthropic requires the first turn to be a user turn; drop any leading assistant
    // turns (e.g. an AI first-outreach with no inbound yet).
    while (history.length && history[0].role === 'assistant') history.shift();
    if (history.length === 0) {
      throw Object.assign(new Error('Nothing from the lead to answer yet.'), { status: 400 });
    }
    // Don't answer if the conversation already ended with the shop's turn — there's
    // no pending customer message, so the model would just return an empty reply.
    const last = thread[thread.length - 1];
    if (last && last.author !== 'lead') {
      throw Object.assign(
        new Error("The last message is already a reply — wait for the customer's next message before answering again."),
        { status: 400 }
      );
    }

    const channel = LeadChannelSender.pickChannel(lead);
    try {
      const resp = await this.anthropic.complete({
        systemPrompt: [{ text: systemPromptFor(shopName, industry, voice, campaign?.name || 'an ad'), cache: true }],
        messages: history,
        model: MODEL,
        maxTokens: 400,
      });
      const reply = resp.text.trim();
      // Never store an empty reply (e.g. the model had nothing to add).
      if (!reply) {
        throw Object.assign(new Error('The AI did not produce a reply — please try again.'), { status: 503 });
      }
      const deliveryStatus = await this.channel.deliver(channel, lead, reply);
      const stored = await this.messages.append({
        leadId, direction: 'outbound', author: 'ai', channel,
        body: reply, aiCostCents: resp.costUsd * 100, deliveryStatus,
      });

      await this.spendCap.recordSpend(shopId, resp.costUsd);
      try {
        await this.aiCosts.record({
          campaignId: lead.campaignId, leadId: lead.id,
          costCents: resp.costUsd * 100, kind: 'auto_answer', model: resp.model,
        });
      } catch (e) { logger.error('LeadAutoAnswerService: failed to record AI cost', e); }
      await this.markRespondedIfNew(lead.id, lead.leadStatus);

      return stored;
    } catch (err: any) {
      if (err?.status) throw err;
      logger.error('LeadAutoAnswerService.generateReply failed', err);
      throw Object.assign(new Error("Couldn't generate a reply right now."), { status: 503 });
    }
  }

  /** Inbound entry point: store the lead's message, then auto-answer IF the campaign
   *  has ai_agent_enabled. Otherwise leave it for the admin (draft-only). */
  async handleInbound(leadId: string, body: string, channel?: MsgChannel): Promise<AutoAnswerResult> {
    const inbound = await this.recordInbound(leadId, body, channel);
    const lead = await this.leads.findById(leadId);
    const campaign = lead ? await this.campaigns.findById(lead.campaignId) : null;

    if (!campaign?.aiAgentEnabled) {
      return { inbound, reply: null, autoAnswered: false, reason: 'ai_agent_disabled' };
    }
    try {
      const reply = await this.generateReply(leadId);
      return { inbound, reply, autoAnswered: true };
    } catch (err: any) {
      logger.error('LeadAutoAnswerService.handleInbound auto-answer failed', err);
      return { inbound, reply: null, autoAnswered: false, reason: err?.message || 'auto_answer_failed' };
    }
  }

  private async markRespondedIfNew(leadId: string, status: string): Promise<void> {
    if (status === 'new') {
      await this.leads.updateStatus(leadId, 'contacted').catch((e) =>
        logger.error('LeadAutoAnswerService: failed to mark lead contacted', e)
      );
    }
  }
}

export const leadAutoAnswerService = new LeadAutoAnswerService();
