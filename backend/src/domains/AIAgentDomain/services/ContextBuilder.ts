// backend/src/domains/AIAgentDomain/services/ContextBuilder.ts
//
// Assembles per-request context for a Claude AI sales reply. Pulls service,
// customer, shop, conversation, and (optionally) sibling-service data in
// parallel using existing repositories.
//
// Goal of this layer: take database rows and produce a clean, prompt-ready
// AgentContext. PromptTemplates consumes the result; AnthropicClient never
// sees raw rows. This keeps the prompt-templating logic decoupled from DB
// schema changes.
//
// Used by AgentOrchestrator (Task 5). Not yet wired to any HTTP route.

import { logger } from "../../../utils/logger";
import { CustomerRepository } from "../../../repositories/CustomerRepository";
import { ShopRepository } from "../../../repositories/ShopRepository";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { MessageRepository } from "../../../repositories/MessageRepository";
import {
  AgentContext,
  AgentServiceContext,
  AgentCustomerContext,
  AgentShopContext,
  AgentMessageContext,
  AgentSiblingService,
} from "../types";

/**
 * Hard cap on conversation history. Keeps the prompt size predictable and
 * cost-bounded. The strategy doc estimates ~3K tokens for 20 messages of
 * typical chat turns. If a conversation goes longer, only the most recent
 * 20 are included; older history is summarized in a single line.
 */
const MAX_CONVERSATION_MESSAGES = 20;

/**
 * Hard cap on sibling services for upsell suggestions. More than 5 dilutes
 * the recommendation and bloats the prompt.
 */
const MAX_SIBLING_SERVICES = 5;

export interface BuildContextParams {
  customerAddress: string;
  serviceId: string;
  conversationId: string;
  /**
   * If true, fetches up to MAX_SIBLING_SERVICES sibling services from the
   * same shop with ai_sales_enabled=true, for the AI to mention as upsells.
   * Defaults to whatever the service's `aiSuggestUpsells` setting is.
   */
  includeUpsells?: boolean;
}

export class ContextBuilder {
  // Repositories instantiated in constructor — makes the class easy to mock
  // in tests by passing custom repo instances.
  constructor(
    private readonly customerRepo: CustomerRepository = new CustomerRepository(),
    private readonly shopRepo: ShopRepository = new ShopRepository(),
    private readonly serviceRepo: ServiceRepository = new ServiceRepository(),
    private readonly messageRepo: MessageRepository = new MessageRepository()
  ) {}

  /**
   * Pull service + customer + shop + conversation + optional siblings in
   * parallel and return a normalized AgentContext.
   *
   * Throws if the service, customer, or shop is not found — Phase 3 callers
   * must validate these exist before calling. Conversation history may be
   * empty (new conversation) — that's not an error.
   */
  async build(params: BuildContextParams): Promise<AgentContext> {
    const { customerAddress, serviceId, conversationId } = params;

    // Phase 1: pull service first because we need its `aiSuggestUpsells`
    // flag to decide whether the upsells query should fire at all.
    const serviceRow = await this.serviceRepo.getServiceById(serviceId);
    if (!serviceRow) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const includeUpsells =
      params.includeUpsells ?? serviceRow.aiSuggestUpsells ?? false;

    // Phase 2: pull everything else in parallel
    const [customerRow, shopRow, messagesResult, siblingsResult] = await Promise.all([
      this.customerRepo.getCustomer(customerAddress),
      this.shopRepo.getShop(serviceRow.shopId),
      this.messageRepo.getConversationMessages(conversationId, {
        limit: MAX_CONVERSATION_MESSAGES,
        sort: "asc", // Oldest-first; newest is the message Claude is about to reply to
      }),
      includeUpsells
        ? this.fetchSiblingServices(serviceRow.shopId, serviceId)
        : Promise.resolve([] as AgentSiblingService[]),
    ]);

    if (!customerRow) {
      throw new Error(`Customer not found: ${customerAddress}`);
    }
    if (!shopRow) {
      throw new Error(`Shop not found: ${serviceRow.shopId}`);
    }

    return {
      service: this.toServiceContext(serviceRow),
      customer: this.toCustomerContext(customerRow),
      shop: this.toShopContext(shopRow),
      conversationHistory: messagesResult.items.map((m: any) =>
        this.toMessageContext(m)
      ),
      siblingServices: siblingsResult,
    };
  }

  // ============================================================================
  // Private mappers — db row → AgentContext shape
  // ============================================================================

  private toServiceContext(row: any): AgentServiceContext {
    return {
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      description: row.description ?? "",
      priceUsd: Number(row.priceUsd ?? 0),
      durationMinutes: row.durationMinutes,
      category: row.category ?? "general",
      customInstructions: row.aiCustomInstructions ?? null,
      bookingAssistance: row.aiBookingAssistance ?? false,
      suggestUpsells: row.aiSuggestUpsells ?? false,
    };
  }

  private toCustomerContext(row: any): AgentCustomerContext {
    // Customer row uses snake_case from BaseRepository mapping;
    // some fields may be camelCase depending on which method was called.
    // Be defensive — read both shapes.
    const name =
      row.name ??
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ??
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ??
      null;

    return {
      address: row.address,
      name: name || null,
      tier: row.tier ?? "BRONZE",
      rcnBalance: Number(row.currentBalance ?? row.current_balance ?? 0),
      joinedAt: row.joinDate ?? row.join_date ?? row.createdAt ?? row.created_at ?? null,
    };
  }

  private toShopContext(row: any): AgentShopContext {
    // Same defensive both-shapes read as customer
    return {
      shopId: row.shopId ?? row.shop_id,
      shopName: row.name ?? row.shopName ?? "the shop",
      category: row.category ?? null,
      hoursSummary: this.summarizeHours(row),
      timezone: row.timezone ?? null,
    };
  }

  private toMessageContext(row: any): AgentMessageContext {
    // Messages from MessageRepository have sender_type='customer' or 'shop'.
    // For the AI prompt, customer = "user" (asks questions), shop = "assistant"
    // (the agent that's replying — historical replies before this turn).
    const senderType = row.senderType ?? row.sender_type;
    return {
      role: senderType === "customer" ? "user" : "assistant",
      content: row.content ?? "",
      createdAt: row.createdAt ?? row.created_at,
    };
  }

  /**
   * Heuristic: build a "Mon-Fri 9am-6pm" style summary if the shop has
   * structured hours. If not available on the shop row, returns null and the
   * prompt template will handle the absence gracefully ("hours unknown — ask
   * the shop directly").
   *
   * Phase 3 MVP: returns null. Phase 4 can wire in a proper hours summarizer
   * once we know the actual hours-storage shape on shops table.
   */
  private summarizeHours(_row: any): string | null {
    // Intentionally minimal in MVP — building a robust hours-summary helper
    // is its own feature. AI prompt instructs: "If you don't know the shop's
    // hours, say so — never invent them."
    return null;
  }

  /**
   * Pull up to MAX_SIBLING_SERVICES other services from the same shop with
   * `ai_sales_enabled=true`, excluding the current service. Returns a
   * minimal blurb-shape suitable for the prompt (not the full service object).
   */
  private async fetchSiblingServices(
    shopId: string,
    excludeServiceId: string
  ): Promise<AgentSiblingService[]> {
    try {
      const result = await this.serviceRepo.getServicesByShop(shopId, {
        activeOnly: true,
        page: 1,
        limit: MAX_SIBLING_SERVICES + 5, // Pull a few extra; we filter post-fetch
      });
      const siblings = (result.items ?? [])
        .filter(
          (s: any) =>
            s.serviceId !== excludeServiceId && (s.aiSalesEnabled ?? false)
        )
        .slice(0, MAX_SIBLING_SERVICES)
        .map((s: any) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          priceUsd: Number(s.priceUsd ?? 0),
          durationMinutes: s.durationMinutes,
          shortBlurb: this.buildSiblingBlurb(s),
        }));
      return siblings;
    } catch (err) {
      logger.warn("Failed to fetch sibling services for upsells:", err);
      return [];
    }
  }

  private buildSiblingBlurb(s: any): string {
    const desc = (s.description ?? "").trim();
    if (!desc) return s.serviceName;
    // Trim to one sentence-ish (~120 chars) to keep prompt size bounded
    const firstSentence = desc.split(/(?<=\.)\s/)[0] ?? desc;
    return firstSentence.length > 120
      ? firstSentence.slice(0, 117) + "..."
      : firstSentence;
  }
}

/**
 * Singleton instance for convenience (uses default repository instances).
 * Tests instantiate their own ContextBuilder with mocked repositories.
 */
export const contextBuilder = new ContextBuilder();
