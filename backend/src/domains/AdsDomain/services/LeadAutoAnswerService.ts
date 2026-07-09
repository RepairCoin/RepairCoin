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
import { AppointmentService } from '../../ServiceDomain/services/AppointmentService';
import { AppointmentRepository, TimeSlot } from '../../../repositories/AppointmentRepository';
import { getCurrentTimeInTimezone } from '../../../utils/timezoneUtils';
import { LeadBookingService } from './LeadBookingService';
import { LeadChannelSender } from './LeadChannelSender';

const MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

/** Ground lead replies in the shop's live service catalog + the ad's creative copy (default on;
 *  set ADS_AI_CATALOG_GROUNDING=false to fall back to name/voice-only grounding). */
const catalogGroundingEnabled = (): boolean => process.env.ADS_AI_CATALOG_GROUNDING !== 'false';
const MAX_CATALOG_SERVICES = 30;

/** Phase 3 — read-only availability grounding: answer "when can I come in?" from real slots.
 *  Default OFF (opt-in per env) until validated live. */
const availabilityGroundingEnabled = (): boolean => process.env.ADS_AI_AVAILABILITY_GROUNDING === 'true';
/** Cheap pre-filter so we only pay the extraction call on plausibly-scheduling messages. */
const SCHEDULING_RE = /\b(availab|schedul|book|appointment|slot|reserv|when|what time|open on|opening hours|this week|next week|today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

/** Phase 4 — AI creates the booking on explicit confirmation (write-path). Default OFF. */
const bookingEnabled = (): boolean => process.env.ADS_AI_BOOKING_ENABLED === 'true';
/** The lead is affirming / asking to book. */
const BOOK_INTENT_RE = /\b(book|reserve|schedule me|sign me up|confirm|i'?ll take|take it|lock it in|works for me|that works|sounds good|let'?s do|yes|yeah|yep|sure|ok|okay|sige|go ahead)\b/i;
/** A clock time in the message (e.g. "9am", "10:30"). */
const CLOCK_RE = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d{1,2}:\d{2}\b/i;
/** A prior assistant turn already handed over a REAL pay link → don't re-book. Match only the delivered
 *  Stripe checkout URL — NOT phrases like "payment link", which the AI also says while ASKING for contact. */
const ALREADY_BOOKED_RE = /checkout\.stripe\.com/i;
/** The message plausibly contains contact info (email or a phone-like number) → worth an enrichment extract. */
const CONTACT_RE = /\S+@\S+\.\S+|\+?\d[\d\s().-]{6,}\d/;

const systemPromptFor = (shopName: string, industry: string, voice: string, campaign: string, canBook: boolean): string => {
  const base =
    `You are the AI sales assistant for ${shopName}, a ${industry}. A lead responded to the "${campaign}" ad ` +
    `and is now messaging. Hold a natural, helpful conversation: answer their questions, address concerns, and ` +
    `drive toward booking an appointment. Rules: plain text only, NO markdown; 1-3 short sentences; warm and ` +
    `professional in this brand voice — ${voice}. NEVER invent prices, availability, or guarantees you weren't given. `;
  const close = canBook
    ? `YOU close the deal yourself — this is an automated assistant on autopilot; there is NO team to hand off to. ` +
      `When the lead wants to book, propose a specific time, collect their name, email and phone, then confirm the ` +
      `appointment and send the secure payment link. Do NOT say "the team will confirm/check/get back to you" or defer ` +
      `to anyone — you own scheduling and booking. Only for a genuinely unknown detail you weren't given (e.g. an unusual ` +
      `policy) may you say you'll double-check — never use that to defer the booking itself. Do not claim a booking is ` +
      `paid/complete until the payment link has been used. `
    : `If you don't know something, offer to have the team confirm. If the lead wants to book, tell them you'll get them ` +
      `set up and that the team will confirm the time. Do not claim a booking is already made. `;
  return base + close + `Output ONLY the message to send.`;
};

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
    private readonly appointments = new AppointmentService(),
    private readonly appointmentRepo = new AppointmentRepository(),
    private readonly channel = new LeadChannelSender(),
    private readonly booking = new LeadBookingService()
  ) {}

  /** Capture contact details (name/email/phone) a customer volunteers in chat and persist them onto the LEAD
   *  (and link to an existing customer if the email/phone matches). Cheap — gated on a contact-looking message.
   *  Enrichment happens here for EVERY inbound (form parity: landing captures name/phone/email); booking just
   *  reuses whatever's been captured. Returns the extraction cost. Fails safe. */
  private async enrichLeadContact(leadId: string, userMsg: string): Promise<number> {
    if (!userMsg || !CONTACT_RE.test(userMsg)) return 0;
    try {
      const extract = await this.anthropic.complete({
        systemPrompt: [{
          text:
            `From the customer's message, extract any contact details they provided as JSON ONLY: ` +
            `{"name": string|null, "email": string|null, "phone": string|null}. Only include values actually ` +
            `present in the message; use null otherwise. Output ONLY the JSON.`,
          cache: false,
        }],
        messages: [{ role: 'user', content: userMsg }],
        model: MODEL,
        maxTokens: 80,
      });
      const cost = extract.costUsd || 0;
      const m = extract.text.match(/\{[\s\S]*\}/);
      if (!m) return cost;
      const c = JSON.parse(m[0]) as { name?: string | null; email?: string | null; phone?: string | null };
      if (c.name || c.email || c.phone) await this.leads.updateContact(leadId, c);
      return cost;
    } catch (e) {
      logger.warn(`LeadAutoAnswerService: lead contact enrichment failed for ${leadId}: ${(e as Error)?.message || e}`);
      return 0;
    }
  }

  /** Phase 4 — booking on explicit confirmation (WRITE). When the customer agrees to a specific slot the AI
   *  offered and has given name+email, create the pending booking + Stripe pay link and hand the link back so
   *  the reply delivers it (also emailed). Missing contact → ask for it. Never books twice (thread guard),
   *  never without an explicit confirm. Returns a guidance block (+ extraction cost). Fails safe to null. */
  private async bookingBlock(shopId: string, leadId: string, thread: LeadMessage[]): Promise<{ text: string | null; costUsd: number }> {
    if (!bookingEnabled() || !thread.length) return { text: null, costUsd: 0 };
    const last = thread[thread.length - 1];
    if (!last || last.author !== 'lead') return { text: null, costUsd: 0 };
    // Already handed over a pay link in this thread → don't re-book on follow-up messages.
    if (thread.some((m) => m.author !== 'lead' && ALREADY_BOOKED_RE.test(m.body || ''))) return { text: null, costUsd: 0 };
    // Gate: the AI must have offered real times, and the customer must be affirming / naming a time.
    const offered = thread.some((m) => m.author !== 'lead' && /\d{1,2}:\d{2}/.test(m.body || ''));
    // The AI's most recent turn already asked for booking details → the customer's reply (their contact)
    // is completing the booking even though it has no "book"/time word.
    const lastAi = [...thread].reverse().find((m) => m.author !== 'lead')?.body || '';
    const askedToBook = /name,?\s*email|to (lock|book)|payment link|secure payment|get you (booked|set up)/i.test(lastAi);
    const explicitBook = /\b(book|reserve|schedule)\b/i.test(last.body);
    const responding = BOOK_INTENT_RE.test(last.body) || CLOCK_RE.test(last.body) || CONTACT_RE.test(last.body);
    if (!(explicitBook || (responding && (offered || askedToBook)))) return { text: null, costUsd: 0 };
    // "Completing" = the AI just asked for booking details and the customer replied WITH contact info. Real Haiku
    // won't reliably call a contact-only message "confirming", so treat this state as an implicit confirmation.
    const completing = askedToBook && CONTACT_RE.test(last.body);

    let costUsd = 0;
    try {
      const cat = await this.services.getServicesByShop(shopId, { activeOnly: true, limit: MAX_CATALOG_SERVICES });
      const items = cat.items || [];
      if (!items.length) return { text: null, costUsd };
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId, null).catch(() => null);
      const tz = config?.timezone || 'America/New_York';
      const today = getCurrentTimeInTimezone(tz).dateString;
      const transcript = thread.slice(-8).map((m) => `${m.author === 'lead' ? 'Customer' : 'Assistant'}: ${m.body}`).join('\n');

      const extract = await this.anthropic.complete({
        systemPrompt: [{
          text:
            `Today is ${today}; shop timezone ${tz}. Date reference: ${LeadAutoAnswerService.dateReference(today)}. ` +
            `Services: ${JSON.stringify(items.map((s) => s.serviceName))}. Recent conversation:\n${transcript}\n` +
            `The customer is trying to book. Using the WHOLE conversation, extract JSON ONLY: ` +
            `{"confirming": boolean, "service": <EXACT service name from the list|null>, "date": "YYYY-MM-DD"|null, ` +
            `"time": "HH:MM"|null, "name": string|null, "email": string|null, "phone": string|null}. confirming=true if the ` +
            `customer has chosen a SPECIFIC time to book — either they just agreed to one, OR they agreed earlier and are now ` +
            `providing their contact details to finalize it. service/date/time = the slot being booked (from anywhere in the ` +
            `conversation). name/email/phone = the customer's contact IF given anywhere, else null. Output ONLY the JSON.`,
          cache: false,
        }],
        messages: [{ role: 'user', content: last.body }],
        model: MODEL,
        maxTokens: 160,
      });
      costUsd = extract.costUsd || 0;
      const match = extract.text.match(/\{[\s\S]*\}/);
      if (!match) return { text: null, costUsd };
      const p = JSON.parse(match[0]) as { confirming?: boolean; service?: string | null; date?: string | null; time?: string | null; name?: string | null; email?: string | null; phone?: string | null };
      if (!p.confirming && !completing) return { text: null, costUsd };

      const wanted = (p.service || '').toLowerCase().trim();
      const svc = items.find((s) => s.serviceName.toLowerCase() === wanted) || (items.length === 1 ? items[0] : undefined);
      const validDate = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date);
      const validTime = p.time && /^\d{1,2}:\d{2}$/.test(p.time);
      if (!svc || !validDate || !validTime) {
        return { text: `The customer seems ready to book, but the exact service/date/time isn't clear yet. Ask them to confirm which service and which of the times you offered. Do NOT say anything is booked.`, costUsd };
      }
      if (!p.email) {
        return { text: `The customer wants to book ${svc.serviceName} on ${LeadAutoAnswerService.humanDate(p.date!)} at ${p.time}. To lock it in, ask for their full name, email, and phone number so you can send the confirmation and a secure payment link. Do NOT say it's booked yet.`, costUsd };
      }

      try {
        const result = await this.booking.createLeadBooking({
          leadId, shopId, serviceId: svc.serviceId, bookingDate: p.date!, bookingTimeSlot: p.time!,
          customerName: p.name || 'Messenger Lead', customerEmail: p.email, customerPhone: p.phone || null,
        });
        const when = `${LeadAutoAnswerService.humanDate(result.bookingDate)} at ${result.bookingTimeSlot}`;
        if (result.paymentUrl) {
          return { text: `BOOKING CREATED (held, pending payment): ${result.serviceName} on ${when} for $${result.price}. Give the customer this EXACT secure payment link to confirm — it's also emailed to them and expires in 24 hours: ${result.paymentUrl} . Tell them the slot is reserved for 24h pending payment.`, costUsd };
        }
        return { text: `BOOKING CREATED (held, pending payment): ${result.serviceName} on ${when} for $${result.price}. Tell the customer their slot is reserved and the team will follow up shortly with payment details.`, costUsd };
      } catch (e: any) {
        if (e?.status === 409) {
          return { text: `That time was JUST taken by someone else. Apologize briefly and offer to check other available times for ${svc.serviceName}. Do NOT say it's booked.`, costUsd };
        }
        logger.error(`LeadAutoAnswerService: booking failed for lead ${leadId}: ${e?.message || e}`);
        return { text: `There was a problem finalizing the booking just now. Tell the customer you're getting the team to confirm their ${svc.serviceName} slot and will follow up shortly. Do NOT claim it's booked or paid.`, costUsd };
      }
    } catch (e) {
      logger.warn(`LeadAutoAnswerService: booking grounding failed for shop ${shopId}: ${(e as Error)?.message || e}`);
      return { text: null, costUsd };
    }
  }

  private static humanDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
  }

  /** Explicit date→weekday table for the next N days, so the extraction resolves "Friday"/"next Monday"
   *  by lookup instead of (unreliable) LLM date arithmetic. */
  private static dateReference(todayIso: string, days = 14): string {
    const [y, m, d] = todayIso.split('-').map(Number);
    const out: string[] = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
      const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      out.push(`${iso}=${dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`);
    }
    return out.join(', ');
  }

  private static filterByTimeOfDay(slots: TimeSlot[], tod: string | null): TimeSlot[] {
    if (!tod) return slots;
    return slots.filter((s) => {
      const h = Number(s.time.split(':')[0]);
      if (tod === 'morning') return h < 12;
      if (tod === 'afternoon') return h >= 12 && h < 17;
      if (tod === 'evening') return h >= 17;
      return true;
    });
  }

  /** Phase 3 — READ-ONLY availability grounding. On a scheduling question, use a cheap extraction call
   *  to resolve service + date (in the shop's timezone), fetch the shop's REAL open slots, and return a
   *  grounding block so the AI can answer "when" with actual times — but never books (that's a later phase).
   *  Returns the block text (or null) + the extraction call's cost (folded into spend). Fails safe to null. */
  private async availabilityBlock(shopId: string, userMsg: string): Promise<{ text: string | null; costUsd: number }> {
    if (!availabilityGroundingEnabled() || !userMsg || !SCHEDULING_RE.test(userMsg)) return { text: null, costUsd: 0 };
    let costUsd = 0;
    try {
      // Fetch the catalog first so the extraction can map the customer's words to an EXACT service name
      // (e.g. "baking training" → "Newly Baker") — code substring-matching misses that.
      const cat = await this.services.getServicesByShop(shopId, { activeOnly: true, limit: MAX_CATALOG_SERVICES });
      const items = cat.items || [];
      if (!items.length) return { text: null, costUsd };
      const names = items.map((s) => s.serviceName);

      const config = await this.appointmentRepo.getTimeSlotConfig(shopId, null).catch(() => null);
      const tz = config?.timezone || 'America/New_York';
      const today = getCurrentTimeInTimezone(tz).dateString; // YYYY-MM-DD in the shop's tz

      const extract = await this.anthropic.complete({
        systemPrompt: [{
          text:
            `Today is ${today} (${LeadAutoAnswerService.humanDate(today)}); shop timezone ${tz}. ` +
            `Date reference (use this to resolve day names EXACTLY — do not compute dates yourself): ` +
            `${LeadAutoAnswerService.dateReference(today)}. This shop's services: ${JSON.stringify(names)}. ` +
            `From the customer's latest message, extract booking intent as JSON ONLY: {"wantsAvailability": boolean, ` +
            `"service": <the EXACT service name from the list that best matches what they're asking about, or null>, ` +
            `"date": "YYYY-MM-DD"|null, "timeOfDay": "morning"|"afternoon"|"evening"|null}. For a bare weekday like ` +
            `"Friday", pick the NEXT matching date from the reference. wantsAvailability is true only if they ask about ` +
            `scheduling/availability/when. Output ONLY the JSON, no prose.`,
          cache: false,
        }],
        messages: [{ role: 'user', content: userMsg }],
        model: MODEL,
        maxTokens: 120,
      });
      costUsd = extract.costUsd || 0;
      const match = extract.text.match(/\{[\s\S]*\}/);
      if (!match) return { text: null, costUsd };
      const parsed = JSON.parse(match[0]) as { wantsAvailability?: boolean; service?: string | null; date?: string | null; timeOfDay?: string | null };
      if (!parsed.wantsAvailability || !parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return { text: null, costUsd };

      // Resolve the serviceId — exact name from the extraction, then a loose fallback, then single-service.
      const wanted = (parsed.service || '').toLowerCase().trim();
      let svc = wanted ? items.find((s) => s.serviceName.toLowerCase() === wanted) : undefined;
      if (!svc && wanted) svc = items.find((s) => s.serviceName.toLowerCase().includes(wanted) || wanted.includes(s.serviceName.toLowerCase()));
      if (!svc && items.length === 1) svc = items[0];
      if (!svc) {
        return {
          text: `The customer is asking about availability but hasn't made clear WHICH service. Before quoting any times, ask them which service they'd like to book. Do NOT invent available times.`,
          costUsd,
        };
      }

      const open = (await this.appointments.getAvailableTimeSlots(shopId, svc.serviceId, parsed.date)).filter((s) => s.available);
      const slots = LeadAutoAnswerService.filterByTimeOfDay(open, parsed.timeOfDay ?? null);
      const label = LeadAutoAnswerService.humanDate(parsed.date);
      const todLabel = parsed.timeOfDay ? ` (${parsed.timeOfDay})` : '';
      const pickLine = bookingEnabled()
        ? `If the customer picks one, ask for their name, email and phone so you can book it and send the payment link — YOU handle the booking, do NOT say a team will confirm.`
        : `If the customer picks one, tell them you'll get them booked and the team will confirm — do NOT claim the booking is already made.`;
      if (!slots.length) {
        return {
          text: `REAL AVAILABILITY CHECK — ${svc.serviceName} on ${label}${todLabel}: NO open slots (fully booked or the shop is closed that day). Tell the customer directly and offer the next available day yourself — do NOT say a team will check. Do NOT invent times.`,
          costUsd,
        };
      }
      return {
        text:
          `REAL AVAILABILITY — ${svc.serviceName} on ${label} (shop timezone ${tz}): ${slots.map((s) => s.time).join(', ')}. ` +
          `State these EXACT open times. ${pickLine} Do NOT invent any other times.`,
        costUsd,
      };
    } catch (e) {
      logger.warn(`LeadAutoAnswerService: availability grounding failed for shop ${shopId}: ${(e as Error)?.message || e}`);
      return { text: null, costUsd };
    }
  }

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
      { text: systemPromptFor(shopName, industry, voice, campaign?.name || 'an ad', bookingEnabled()), cache: true },
    ];
    // Ground the reply in what the shop actually sells + what the ad promised (both cached, stable per
    // shop/campaign → near-free after the first turn). Each is skipped cleanly when absent.
    const [catalog, creativeCtx] = await Promise.all([
      this.catalogBlock(shopId),
      this.creativeBlock(lead.creativeId, lead.campaignId),
    ]);
    if (catalog) systemBlocks.push({ text: catalog, cache: true });
    if (creativeCtx) systemBlocks.push({ text: creativeCtx, cache: true });
    // Phase 3: real availability for "when can I come in?" (read-only). Not cached — date/query-specific.
    const availability = await this.availabilityBlock(shopId, last?.body || '');
    if (availability.text) systemBlocks.push({ text: availability.text, cache: false });
    // Capture any contact the customer volunteered → enrich the LEAD (name/email/phone) + link existing customer.
    const enrichCost = await this.enrichLeadContact(lead.id, last?.body || '');
    // Phase 4: on explicit confirmation, create the booking + pay link (write). Not cached.
    const booking = await this.bookingBlock(shopId, lead.id, thread);
    if (booking.text) systemBlocks.push({ text: booking.text, cache: false });
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

      // Reply cost + the Phase 3/4 + enrichment extraction calls (when they ran) all count against budget.
      await this.spendCap.recordSpend(shopId, resp.costUsd + availability.costUsd + booking.costUsd + enrichCost);
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
