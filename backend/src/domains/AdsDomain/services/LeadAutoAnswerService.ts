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
import { getAiMemoryService } from '../../AIAgentDomain/services/AiMemoryService';
import { shopRepository } from '../../../repositories';
import { ChatMessage, ClaudeModel } from '../../AIAgentDomain/types';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';
import { AiCostRepository } from '../repositories/AiCostRepository';
import { LeadMessageRepository, LeadMessage, MsgChannel } from '../repositories/LeadMessageRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { LeadChannelSender } from './LeadChannelSender';

const MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

/** Ground lead replies in the shop's live service catalog + the ad's creative copy (default on;
 *  set ADS_AI_CATALOG_GROUNDING=false to fall back to name/voice-only grounding). */
const catalogGroundingEnabled = (): boolean => process.env.ADS_AI_CATALOG_GROUNDING !== 'false';
const MAX_CATALOG_SERVICES = 30;

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
    private readonly services = new ServiceRepository(),
    private readonly creatives = new CreativeRepository(),
    private readonly channel = new LeadChannelSender()
  ) {}

  /** System block listing the shop's live, active services so the AI answers "do you offer X?"
   *  decisively (and declines what isn't offered) instead of always deferring to the team.
   *  Cached (stable per shop). Null when disabled, empty, or on error (behaviour-neutral fallback). */
  private async catalogBlock(shopId: string): Promise<string | null> {
    if (!catalogGroundingEnabled()) return null;
    try {
      const res = await this.services.getServicesByShop(shopId, { activeOnly: true, limit: MAX_CATALOG_SERVICES });
      const items = res.items || [];
      if (!items.length) return null;
      const lines = items
        .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.serviceName.localeCompare(b.serviceName))
        .slice(0, MAX_CATALOG_SERVICES)
        .map((s) => {
          const price = typeof s.priceUsd === 'number' && s.priceUsd > 0 ? `, $${s.priceUsd}` : '';
          const dur = s.durationMinutes ? `, ${s.durationMinutes}min` : '';
          const desc = s.description ? ` — ${s.description.slice(0, 120)}` : '';
          return `- ${s.serviceName} (${s.category})${price}${dur}${desc}`;
        });
      return (
        `These are the ONLY services this shop offers:\n${lines.join('\n')}\n` +
        `If the customer asks about something on this list, answer directly and name it (quote the price when shown). ` +
        `If they ask about something NOT on this list, tell them the shop doesn't offer it — do NOT invent services, ` +
        `prices, or guarantees. For scheduling/availability, say the team will confirm the time.`
      );
    } catch (e) {
      logger.warn(`LeadAutoAnswerService: catalog grounding failed for shop ${shopId}: ${(e as Error)?.message || e}`);
      return null;
    }
  }

  /** System block with the ad's copy (the lead's creative, else the campaign's approved creative) so
   *  the reply stays consistent with the promoted offer/promo. Cached. Null when disabled/unresolvable. */
  private async creativeBlock(creativeId: string | null, campaignId: string): Promise<string | null> {
    if (!catalogGroundingEnabled()) return null;
    try {
      let creative = creativeId ? await this.creatives.findById(creativeId) : null;
      if (!creative) {
        const all = await this.creatives.listByCampaign(campaignId);
        creative = all.find((c) => c.reviewStatus === 'approved') || all[0] || null;
      }
      if (!creative || (!creative.headline && !creative.body)) return null;
      const parts: string[] = [];
      if (creative.headline) parts.push(`Headline: "${creative.headline}"`);
      if (creative.body) parts.push(`Body: "${creative.body}"`);
      return `The customer clicked an ad that said — ${parts.join('. ')}. Stay consistent with that offer; if it named a promo or discount, honor it.`;
    } catch (e) {
      logger.warn(`LeadAutoAnswerService: creative grounding failed for campaign ${campaignId}: ${(e as Error)?.message || e}`);
      return null;
    }
  }

  async getThread(leadId: string): Promise<LeadMessage[]> {
    return this.messages.listByLead(leadId);
  }

  /** Store an inbound message from the lead. `externalId` = the source Message-ID (email dedupe). */
  async recordInbound(leadId: string, body: string, channel?: MsgChannel, externalId?: string | null): Promise<LeadMessage> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    const ch = channel ?? LeadChannelSender.pickChannel(lead);
    return this.messages.append({ leadId, direction: 'inbound', author: 'lead', channel: ch, body, externalId: externalId ?? null });
  }

  /** Store an admin's manual reply and (attempt to) deliver it. */
  async sendAdminMessage(leadId: string, body: string): Promise<LeadMessage> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    const channel = LeadChannelSender.pickChannel(lead);
    const deliveryStatus = await this.channel.deliver(channel, lead, body);
    await this.markRespondedIfNew(lead.id, lead.leadStatus);
    // A human engaged → clear any escalation (P3), so the hot-lead flag doesn't linger.
    await this.leads.clearEscalated(lead.id).catch(() => undefined);
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
    // AI Memory (Phase 5 shared reads): honor the owner's standing instructions
    // (tone, offers, do's/don'ts) in lead replies too. No-op when off/empty.
    const systemBlocks: { text: string; cache: boolean }[] = [
      { text: systemPromptFor(shopName, industry, voice, campaign?.name || 'an ad'), cache: true },
    ];
    // Ground the reply in what the shop actually sells + what the ad promised (both cached, stable per
    // shop/campaign → near-free after the first turn). Each is skipped cleanly when absent.
    const [catalog, creativeCtx] = await Promise.all([
      this.catalogBlock(shopId),
      this.creativeBlock(lead.creativeId, lead.campaignId),
    ]);
    if (catalog) systemBlocks.push({ text: catalog, cache: true });
    if (creativeCtx) systemBlocks.push({ text: creativeCtx, cache: true });
    const memBlock = await getAiMemoryService().recallBlock(shopId, last?.body);
    if (memBlock) systemBlocks.push({ text: memBlock, cache: false });
    try {
      const resp = await this.anthropic.complete({
        systemPrompt: systemBlocks,
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
  async handleInbound(leadId: string, body: string, channel?: MsgChannel, externalId?: string | null): Promise<AutoAnswerResult> {
    const inbound = await this.recordInbound(leadId, body, channel, externalId);
    const lead = await this.leads.findById(leadId);
    const campaign = lead ? await this.campaigns.findById(lead.campaignId) : null;

    // Take-over (P3): a human seized the conversation → record the reply but don't auto-answer over them.
    if (lead?.aiPaused) {
      return { inbound, reply: null, autoAnswered: false, reason: 'ai_paused' };
    }
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
