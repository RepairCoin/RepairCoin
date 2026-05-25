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

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { CustomerRepository } from "../../../repositories/CustomerRepository";
import { ShopRepository } from "../../../repositories/ShopRepository";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { MessageRepository } from "../../../repositories/MessageRepository";
import { ServiceAIFaqRepository } from "../../../repositories/ServiceAIFaqRepository";
import { AppointmentRepository } from "../../../repositories/AppointmentRepository";
import { RescheduleRepository } from "../../../repositories/RescheduleRepository";
import { NoShowPolicyService } from "../../../services/NoShowPolicyService";
import { AvailabilityFetcher } from "./AvailabilityFetcher";
import {
  AgentContext,
  AgentServiceContext,
  AgentCustomerContext,
  AgentShopContext,
  AgentMessageContext,
  AgentSiblingService,
  AgentAvailabilitySlot,
  AgentShopServiceMenuItem,
  AgentServiceFaqEntry,
  AgentUpcomingAppointment,
} from "../types";

/**
 * Hard cap on conversation history. Keeps the prompt size predictable and
 * cost-bounded. The strategy doc estimates ~3K tokens for 20 messages of
 * typical chat turns. If a conversation goes longer, only the most recent
 * 20 are included; older history is summarized in a single line.
 */
const MAX_CONVERSATION_MESSAGES = 20;

/**
 * Shape of one row from the shop_availability table — the seven-day weekly
 * schedule the AI uses to answer "what are your hours?" questions. PG TIME
 * columns serialize as "HH:MM:SS" strings; null when day is closed or break
 * isn't configured.
 */
interface WeeklyHoursRow {
  day_of_week: number; // 0=Sun, 6=Sat
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
}

/**
 * Booking policy combining shop_time_slot_config and shop_no_show_policy.
 * Surfaced in the AI prompt so Claude can answer customer questions about
 * advance window, minimum notice, reschedules, and cancellations directly
 * instead of escalating each one to a human.
 *
 * Some fields are nullable from the LEFT JOIN: when a shop has a
 * time_slot_config row but no no_show_policy row, the cancellation
 * fields come back null and the prompt renders without that line.
 */
interface BookingPolicyRow {
  booking_advance_days: number;
  min_booking_hours: number;
  timezone: string | null;
  allow_reschedule: boolean | null;
  max_reschedules_per_order: number | null;
  reschedule_min_hours: number | null;
  /** From shop_no_show_policy.enabled — null when no policy row exists */
  no_show_policy_enabled: boolean | null;
  minimum_cancellation_hours: number | null;
}

/**
 * Customer's no-show policy standing, distilled to what the AI context
 * needs: the advance-notice floor for proposed slots, whether the customer
 * can book at all, and the human-readable restriction lines for the prompt.
 */
interface NoShowSummary {
  /** Per-customer minimum advance hours (0 = no extra restriction). */
  minAdvanceHours: number;
  /** False when the customer is suspended — AI must not propose any slot. */
  canBook: boolean;
  /** Human-readable restriction lines, e.g. "Must book at least 48 hours in advance". */
  restrictions: string[];
}

/**
 * Hard cap on sibling services for upsell suggestions. More than 5 dilutes
 * the recommendation and bloats the prompt.
 */
const MAX_SIBLING_SERVICES = 5;

/**
 * Hard cap on the shop's AI-enabled service menu surfaced in the prompt
 * (Phase 1 of multi-service architecture). Distinct from MAX_SIBLING_SERVICES:
 * the menu is the FULL set the AI knows about (used to answer "what else
 * do you offer?"), while siblings are the promoted subset for active
 * cross-selling. 15 is generous for typical shops (most have 1-8
 * AI-enabled services) and bounds prompt growth on outlier configurations.
 */
const MAX_SHOP_SERVICES_IN_PROMPT = 15;

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
  // Pool is for the shop_availability lookup (hours per day-of-week).
  // No repository owns this table cleanly — the AppointmentRepository handles
  // slot-config + per-day overrides but not the weekly schedule. Direct query
  // is the simplest path; injectable for tests via the constructor param.
  constructor(
    private readonly customerRepo: CustomerRepository = new CustomerRepository(),
    private readonly shopRepo: ShopRepository = new ShopRepository(),
    private readonly serviceRepo: ServiceRepository = new ServiceRepository(),
    private readonly messageRepo: MessageRepository = new MessageRepository(),
    private readonly availabilityFetcher: AvailabilityFetcher = new AvailabilityFetcher(),
    private readonly pool: Pool = getSharedPool(),
    private readonly faqRepo: ServiceAIFaqRepository = new ServiceAIFaqRepository(),
    // No-show policy: drives the per-customer advance-notice floor on
    // proposed slots + the restriction lines in the prompt.
    private readonly noShowPolicyService: NoShowPolicyService = new NoShowPolicyService(),
    // Reschedule + cancel context preload. Both repos are queried in
    // parallel via fetchUpcomingAppointments; the result powers the
    // propose-* tools and the in-prompt appointment block.
    private readonly appointmentRepo: AppointmentRepository = new AppointmentRepository(),
    private readonly rescheduleRepo: RescheduleRepository = new RescheduleRepository()
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
    const includeBookingSlots = serviceRow.aiBookingAssistance === true;

    // Phase 2 of multi-service architecture: fetch the shop service menu
    // first (sequential dependency) because the multi-service slot fetcher
    // below needs the full list of AI-enabled services to query.
    const shopServiceMenu = await this.fetchShopServiceMenu(
      serviceRow.shopId,
      serviceId
    );

    // No-show policy status for this customer at this shop. Fetched
    // sequentially (before the parallel block) because its result feeds
    // the slot fetcher below: a customer on a restriction tier must only
    // be offered slots beyond their personal advance-notice floor, or the
    // AI proposes a slot the checkout then rejects ("Booking Time Too
    // Soon"). Also surfaced in the prompt so the AI can EXPLAIN the
    // restriction if the customer asks for something sooner.
    const noShowStatus = await this.fetchCustomerNoShowStatus(
      customerAddress,
      serviceRow.shopId
    );

    // Phase 2 + follow-up: assemble the set of services the AI can book in
    // this conversation. Inclusion rule per service:
    //   - Focused service: included when its own aiBookingAssistance is true
    //     (gated upstream by `includeBookingSlots` — if that's false we
    //     never reach this code path).
    //   - Menu items: included ONLY when the menu item's own
    //     bookingAssistance is true. Without this filter, a shop owner who
    //     toggled aiBookingAssistance off for a service (intent: "discuss
    //     but don't auto-book") would still have it booked from a sibling
    //     chat — a Phase 2 design bug. Menu items the AI may DESCRIBE but
    //     not BOOK stay in shopServiceMenu (read by PromptTemplates) but
    //     never reach this list.
    //
    // Each entry carries serviceName so PromptTemplates can render the slot
    // list with human-readable service labels and the tool's serviceId enum
    // can include all of them.
    const bookableServices = [
      { serviceId, serviceName: serviceRow.serviceName },
      ...shopServiceMenu
        .filter((m) => m.bookingAssistance === true)
        .map((m) => ({
          serviceId: m.serviceId,
          serviceName: m.serviceName,
        })),
    ];

    // Phase 2: pull everything else in parallel
    const [customerRow, shopRow, messagesResult, siblingsResult, availabilitySlots, weeklyHours, bookingPolicy, faqEntriesResult, upcomingAppointments] = await Promise.all([
      this.customerRepo.getCustomer(customerAddress),
      this.shopRepo.getShop(serviceRow.shopId),
      // The RECENT window, oldest-first. Must NOT use
      // getConversationMessages(sort:'asc',limit:N) — that returns the
      // OLDEST N, so once a conversation passes N messages the AI's
      // context freezes on the first N and it keeps replying to a stale
      // turn. getRecentConversationMessages takes the newest N then
      // re-sorts ascending. See that method's doc comment.
      this.messageRepo.getRecentConversationMessages(
        conversationId,
        MAX_CONVERSATION_MESSAGES
      ),
      includeUpsells
        ? this.fetchSiblingServices(serviceRow.shopId, serviceId)
        : Promise.resolve([] as AgentSiblingService[]),
      // Phase 2 of multi-service architecture: fetch real bookable slots
      // for ALL AI-enabled services at the shop (not just the focused
      // service). Each slot is tagged with its serviceId + serviceName so
      // the tool's enum + the prompt's slot list both name the right
      // service. Still gated by the focused service's
      // aiBookingAssistance flag — turning it off for the focused service
      // disables the booking-card path entirely.
      // Booking slots — gated by the focused service's aiBookingAssistance
      // AND the customer's no-show standing. A suspended customer (canBook
      // false) is offered NO slots: the AI must not propose any booking.
      // For restricted-but-allowed tiers, minAdvanceHours pushes the slot
      // window out so every proposed slot survives the checkout's
      // advance-notice check.
      includeBookingSlots && noShowStatus.canBook
        ? this.availabilityFetcher.fetchUpcomingSlotsForServices(
            serviceRow.shopId,
            bookableServices,
            noShowStatus.minAdvanceHours
          )
        : Promise.resolve([] as AgentAvailabilitySlot[]),
      // Weekly operating hours so the AI can answer "what are your hours?"
      // accurately instead of saying "not on file" (Phase 3 follow-up).
      this.fetchWeeklyHours(serviceRow.shopId),
      // Booking policy (advance days + min notice) — same source the
      // AvailabilityFetcher already reads internally, but we surface it
      // in the prompt so the AI can REASON about it ("we book up to 6
      // days in advance — that date isn't open yet"). Duplicate query
      // with AvailabilityFetcher is ~10ms and parallel; not worth
      // plumbing a shared cache through both.
      this.fetchBookingPolicy(serviceRow.shopId),
      // FAQ entries (Q&A pairs) for the focused service. Additive to
      // description — when populated, rendered as a structured FAQ block;
      // when empty, the prompt is unchanged from pre-FAQ behavior.
      // Strategy doc: ai-knowledge-base-strategy.md
      this.faqRepo.getEntriesForService(serviceId),
      // Customer's upcoming paid bookings at THIS shop, with pending-
      // reschedule-request markers merged in. Drives the propose_cancellation
      // + propose_reschedule_request tools (reschedule-cancel-scope.md).
      // Empty array on any error so the orchestrator path stays alive.
      this.fetchUpcomingAppointments(customerAddress, serviceRow.shopId),
    ]);

    if (!customerRow) {
      throw new Error(`Customer not found: ${customerAddress}`);
    }
    if (!shopRow) {
      throw new Error(`Shop not found: ${serviceRow.shopId}`);
    }

    return {
      service: this.toServiceContext(serviceRow, faqEntriesResult),
      customer: this.toCustomerContext(customerRow, noShowStatus),
      shop: this.toShopContext(shopRow, weeklyHours, bookingPolicy),
      conversationHistory: messagesResult.map((m: any) =>
        this.toMessageContext(m)
      ),
      siblingServices: siblingsResult,
      availabilitySlots,
      shopServiceMenu,
      upcomingAppointments,
    };
  }

  /**
   * Pull the customer's upcoming PAID bookings at this shop, then
   * annotate each with `pendingRescheduleRequestId`. Two queries in
   * parallel; merge by `orderId`. Empty arrays/maps on error so the
   * orchestrator never sees a context-build failure from this path.
   */
  private async fetchUpcomingAppointments(
    customerAddress: string,
    shopId: string
  ): Promise<AgentUpcomingAppointment[]> {
    try {
      const rows = await this.appointmentRepo.getUpcomingAppointmentsForShop(
        customerAddress,
        shopId
      );
      if (rows.length === 0) return [];

      const orderIds = rows.map((r) => r.orderId);
      const pendingMap =
        await this.rescheduleRepo.getPendingRescheduleRequestsForOrders(
          orderIds
        );

      return rows.map((r) => ({
        orderId: r.orderId,
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        bookingDate: r.bookingDate,
        bookingTime: r.bookingTime,
        status: r.status,
        withinCancellationWindow: r.withinCancellationWindow,
        pendingRescheduleRequestId: pendingMap.get(r.orderId) ?? null,
      }));
    } catch (error) {
      logger.error("ContextBuilder.fetchUpcomingAppointments failed:", error);
      return [];
    }
  }

  /**
   * Pull all AI-enabled services for the shop (Phase 1 of multi-service
   * architecture). Distinct from `fetchSiblingServices`:
   *
   *   fetchSiblingServices: gated by current service's aiSuggestUpsells.
   *     Returns the "promote these alongside" set. May be empty even
   *     when the shop has many AI-enabled services.
   *   fetchShopServiceMenu: unconditional. Returns ALL AI-enabled services
   *     for the shop so the AI can answer "what other services do you offer?"
   *     accurately regardless of which service was clicked into.
   *
   * Always excludes the current focused service (already in
   * AgentContext.service). Capped at MAX_SHOP_SERVICES_IN_PROMPT.
   * Errors are swallowed — empty menu is harmless (AI just doesn't
   * surface other services if the query fails).
   */
  private async fetchShopServiceMenu(
    shopId: string,
    excludeServiceId: string
  ): Promise<AgentShopServiceMenuItem[]> {
    try {
      const result = await this.serviceRepo.getServicesByShop(shopId, {
        activeOnly: true,
        page: 1,
        // Pull more than the cap so we can filter by aiSalesEnabled in-memory
        // and still hit the cap when most are non-AI-enabled.
        limit: MAX_SHOP_SERVICES_IN_PROMPT + 10,
      });
      const baseItems = (result.items ?? [])
        .filter(
          (s: any) =>
            s.serviceId !== excludeServiceId && (s.aiSalesEnabled ?? false)
        )
        .slice(0, MAX_SHOP_SERVICES_IN_PROMPT)
        .map((s: any) => {
          // Distinct from sibling blurb: menu shortBlurb is null when no
          // real description exists (caller renders without the dash).
          const desc = (s.description ?? "").trim();
          let shortBlurb: string | null = null;
          if (desc) {
            const firstSentence = desc.split(/(?<=\.)\s/)[0] ?? desc;
            shortBlurb = firstSentence.length > 120
              ? firstSentence.slice(0, 117) + "..."
              : firstSentence;
          }
          return {
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            priceUsd: Number(s.priceUsd ?? 0),
            ...(s.durationMinutes ? { durationMinutes: s.durationMinutes } : {}),
            category: s.category ?? "general",
            shortBlurb,
            bookingAssistance: s.aiBookingAssistance === true,
          };
        });

      // Hydrate FAQ entries per menu item in parallel. Without this, the
      // AI only had detailed Q&As for the focused service — when asked
      // about a non-focused service ("what's included in Newly Baker?"
      // on an I Robot anchor) it would admit "I only have FAQ for the
      // focused service here" even though FAQ rows exist in DB. Per-
      // service failures are swallowed (empty FAQ for that item),
      // matching the same failure-tolerance the rest of this method has.
      const faqResults = await Promise.all(
        baseItems.map((item) =>
          this.faqRepo
            .getEntriesForService(item.serviceId)
            .catch((err) => {
              logger.warn(
                "ContextBuilder: menu-item FAQ fetch failed; rendering item without FAQ",
                {
                  serviceId: item.serviceId,
                  error: (err as Error)?.message,
                }
              );
              return [];
            })
        )
      );
      return baseItems.map((item, idx) => ({
        ...item,
        faqEntries: (faqResults[idx] ?? []).map((e) => ({
          question: e.question,
          answer: e.answer,
        })),
      }));
    } catch (err) {
      logger.warn("ContextBuilder: shop service menu query failed; AI menu will be empty", {
        shopId,
        error: (err as Error)?.message,
      });
      return [];
    }
  }

  /**
   * Read the shop's booking policy (advance days + min notice hours +
   * reschedule rules + cancellation hours) via a single JOIN across
   * shop_time_slot_config and shop_no_show_policy. Returns null when no
   * config row exists yet (new shop that hasn't run the appointment
   * setup wizard) — the prompt handles null gracefully by omitting the
   * policy block. Errors are swallowed to keep the AI reply unaffected
   * by transient DB hiccups.
   *
   * The LEFT JOIN ensures shops with time_slot_config but no
   * no_show_policy row still get the booking-window/reschedule fields
   * surfaced. Cancellation hours stays null in that case; the prompt
   * renders it conditionally.
   */
  private async fetchBookingPolicy(shopId: string): Promise<BookingPolicyRow | null> {
    try {
      const result = await this.pool.query<BookingPolicyRow>(
        `SELECT
           c.booking_advance_days,
           c.min_booking_hours,
           c.timezone,
           c.allow_reschedule,
           c.max_reschedules_per_order,
           c.reschedule_min_hours,
           p.enabled AS no_show_policy_enabled,
           p.minimum_cancellation_hours
         FROM shop_time_slot_config c
         LEFT JOIN shop_no_show_policy p ON p.shop_id = c.shop_id
         WHERE c.shop_id = $1
         LIMIT 1`,
        [shopId]
      );
      return result.rows[0] ?? null;
    } catch (err) {
      logger.warn("ContextBuilder: booking policy query failed; policy block will be omitted from prompt", {
        shopId,
        error: (err as Error)?.message,
      });
      return null;
    }
  }

  /**
   * Read shop_availability rows for one shop. Returns the seven-day weekly
   * schedule (some days may be `is_open=false`). Errors are swallowed —
   * a transient DB hiccup shouldn't block the AI reply, and the prompt has
   * a graceful fallback for missing hours.
   */
  private async fetchWeeklyHours(shopId: string): Promise<WeeklyHoursRow[]> {
    try {
      const result = await this.pool.query<WeeklyHoursRow>(
        `SELECT day_of_week, is_open, open_time, close_time,
                break_start_time, break_end_time
         FROM shop_availability
         WHERE shop_id = $1
           AND day_of_week BETWEEN 0 AND 6
         ORDER BY day_of_week`,
        [shopId]
      );
      return result.rows;
    } catch (err) {
      logger.warn("ContextBuilder: shop_availability query failed; hours will be 'not on file' in prompt", {
        shopId,
        error: (err as Error)?.message,
      });
      return [];
    }
  }

  // ============================================================================
  // Private mappers — db row → AgentContext shape
  // ============================================================================

  private toServiceContext(
    row: any,
    faqEntries: { question: string; answer: string }[]
  ): AgentServiceContext {
    return {
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      description: row.description ?? "",
      priceUsd: Number(row.priceUsd ?? 0),
      durationMinutes: row.durationMinutes,
      category: row.category ?? "general",
      bookingAssistance: row.aiBookingAssistance ?? false,
      suggestUpsells: row.aiSuggestUpsells ?? false,
      faqEntries: faqEntries.map((e) => ({
        question: e.question,
        answer: e.answer,
      })),
    };
  }

  private toCustomerContext(
    row: any,
    noShow: NoShowSummary
  ): AgentCustomerContext {
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
      canBook: noShow.canBook,
      minAdvanceHours: noShow.minAdvanceHours,
      bookingRestrictions: noShow.restrictions,
    };
  }

  /**
   * Fetch the customer's no-show policy standing at this shop. Wrapped so a
   * transient failure (DB hiccup, missing policy row) degrades to
   * "unrestricted" rather than breaking the AI reply — the checkout still
   * enforces the real rule, so fail-open here just reverts to pre-fix
   * behavior for that one reply instead of dropping the whole response.
   */
  private async fetchCustomerNoShowStatus(
    customerAddress: string,
    shopId: string
  ): Promise<NoShowSummary> {
    try {
      const status = await this.noShowPolicyService.getCustomerStatus(
        customerAddress,
        shopId
      );
      return {
        minAdvanceHours: status.minimumAdvanceHours ?? 0,
        canBook: status.canBook !== false,
        restrictions: Array.isArray(status.restrictions) ? status.restrictions : [],
      };
    } catch (err) {
      logger.warn(
        "ContextBuilder: no-show status fetch failed — treating customer as unrestricted",
        { customerAddress, shopId, error: (err as Error)?.message }
      );
      return { minAdvanceHours: 0, canBook: true, restrictions: [] };
    }
  }

  private toShopContext(
    row: any,
    weeklyHours: WeeklyHoursRow[],
    bookingPolicy: BookingPolicyRow | null
  ): AgentShopContext {
    // Same defensive both-shapes read as customer
    // Cancellation hours: only surface when the no-show policy is
    // explicitly enabled. If policy row exists but enabled=false, treat
    // as "no policy" — the shop is signaling they don't enforce a
    // window, so the AI shouldn't claim one.
    const cancellationMinHours = bookingPolicy?.no_show_policy_enabled === true
      ? bookingPolicy?.minimum_cancellation_hours ?? null
      : null;
    // Reschedule-related fields: null them out when allow_reschedule is
    // false, so the prompt renders "Reschedules: not allowed" cleanly
    // rather than "not allowed but max 2 per booking with 24 hour notice"
    // (contradictory).
    const reschedulesAllowed = bookingPolicy?.allow_reschedule ?? null;
    const maxReschedulesPerBooking = reschedulesAllowed === true
      ? bookingPolicy?.max_reschedules_per_order ?? null
      : null;
    const rescheduleMinHours = reschedulesAllowed === true
      ? bookingPolicy?.reschedule_min_hours ?? null
      : null;

    // Contact details — empty strings get normalized to null so the
    // prompt renderer can skip them cleanly. snake_case from raw pg rows,
    // camelCase via ShopRepository mappings — defensive read of both.
    const normalizeContact = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    return {
      shopId: row.shopId ?? row.shop_id,
      shopName: row.name ?? row.shopName ?? "the shop",
      category: row.category ?? null,
      hoursSummary: this.summarizeHours(weeklyHours),
      timezone: row.timezone ?? bookingPolicy?.timezone ?? null,
      bookingAdvanceDays: bookingPolicy?.booking_advance_days ?? null,
      minBookingHours: bookingPolicy?.min_booking_hours ?? null,
      reschedulesAllowed,
      maxReschedulesPerBooking,
      rescheduleMinHours,
      cancellationMinHours,
      address: normalizeContact(row.address),
      phone: normalizeContact(row.phone),
      email: normalizeContact(row.email),
      website: normalizeContact(row.website),
    };
  }

  private toMessageContext(row: any): AgentMessageContext {
    // Messages from MessageRepository have sender_type='customer' or 'shop'.
    // For the AI prompt, customer = "user" (asks questions), shop = "assistant"
    // (the agent that's replying — historical replies before this turn).
    const senderType = row.senderType ?? row.sender_type;
    // The Message type uses `messageText` (camelCase) for the body text; raw
    // pg rows expose it as `message_text`. Fall back to `content` for any
    // hypothetical caller using a custom shape, then to "" so the type stays
    // satisfied. Truly-empty messages (attachment-only, system, encrypted
    // ciphertext) are filtered upstream by the orchestrator before being sent
    // to Claude — Anthropic rejects user messages with empty content.
    const content = row.messageText ?? row.message_text ?? row.content ?? "";
    // Plumb metadata so the orchestrator's loop guard can read prior
    // booking_suggestions. Strictly internal — never sent to Anthropic.
    const metadata = (row.metadata ?? undefined) as
      | Record<string, any>
      | undefined;
    return {
      role: senderType === "customer" ? "user" : "assistant",
      content,
      createdAt: row.createdAt ?? row.created_at,
      ...(metadata ? { metadata } : {}),
    };
  }

  /**
   * Build a friendly "Mon-Fri 9am-6pm, Sat closed" style summary from the
   * shop_availability rows. The AI uses this to answer "what are your hours?"
   * questions accurately instead of saying "not on file."
   *
   * Returns null when no rows exist or all days are closed — the prompt
   * falls back to "hours not on file, will have someone confirm" in that
   * case (intentional: better to disclose ignorance than fabricate hours).
   *
   * Implementation notes:
   * - day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday (per the existing
   *   shop_availability rows on staging — Postgres TIME columns serialize
   *   as "HH:MM:SS" strings so we parse and reformat).
   * - Adjacent days with identical hours are compressed (e.g. "Mon-Fri 9am-6pm").
   * - Days marked is_open=false render as "Sat closed".
   * - Break times are NOT included — too noisy for a one-line summary; the
   *   AI's booking flow already accounts for breaks via AvailabilityFetcher
   *   when proposing actual slots.
   */
  private summarizeHours(rows: WeeklyHoursRow[]): string | null {
    if (!rows || rows.length === 0) return null;

    // Index rows by day-of-week. Missing days = closed.
    const byDay = new Map<number, WeeklyHoursRow>();
    for (const row of rows) {
      if (typeof row.day_of_week === "number" && row.day_of_week >= 0 && row.day_of_week <= 6) {
        byDay.set(row.day_of_week, row);
      }
    }

    if (byDay.size === 0) return null;

    // Build per-day strings for Sun-Sat (day 0 to 6).
    // Day labels match common shop-hours-page wording.
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const perDay: { day: number; label: string; hours: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const row = byDay.get(d);
      if (!row || row.is_open === false) {
        perDay.push({ day: d, label: DAY_NAMES[d], hours: "closed" });
      } else {
        const open = formatTime(row.open_time);
        const close = formatTime(row.close_time);
        if (!open || !close) {
          perDay.push({ day: d, label: DAY_NAMES[d], hours: "closed" });
        } else {
          perDay.push({ day: d, label: DAY_NAMES[d], hours: `${open}-${close}` });
        }
      }
    }

    // If literally every day is "closed", give up — looks like the shop
    // hasn't configured anything meaningful. Same outcome as no rows.
    if (perDay.every((d) => d.hours === "closed")) return null;

    // Compress adjacent days with identical hours strings into ranges.
    // "Mon 9am-6pm, Tue 9am-6pm, Wed 9am-6pm" → "Mon-Wed 9am-6pm"
    const groups: { startDay: number; endDay: number; hours: string }[] = [];
    let current: { startDay: number; endDay: number; hours: string } | null = null;
    for (const d of perDay) {
      if (!current || current.hours !== d.hours) {
        if (current) groups.push(current);
        current = { startDay: d.day, endDay: d.day, hours: d.hours };
      } else {
        current.endDay = d.day;
      }
    }
    if (current) groups.push(current);

    // Format each group: single day = "Mon 9am-6pm", range = "Mon-Fri 9am-6pm".
    const parts = groups.map((g) => {
      const range =
        g.startDay === g.endDay
          ? DAY_NAMES[g.startDay]
          : `${DAY_NAMES[g.startDay]}-${DAY_NAMES[g.endDay]}`;
      return `${range} ${g.hours}`;
    });

    return parts.join(", ");
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

/**
 * Format a Postgres TIME string ("HH:MM:SS") as a friendly "9am" / "5pm"
 * style label. Used by summarizeHours to build the weekly summary the AI
 * sees in the prompt. Returns null on malformed input so the caller can
 * fall back to "closed" rather than emit a broken string.
 *
 * Examples:
 *   "09:00:00" → "9am"
 *   "17:30:00" → "5:30pm"
 *   "00:00:00" → "12am"
 *   "12:00:00" → "12pm"
 */
function formatTime(t: string | null): string | null {
  if (!t || typeof t !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!match) return null;
  const hour24 = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hour24) || Number.isNaN(minutes)) return null;
  if (hour24 < 0 || hour24 > 23 || minutes < 0 || minutes > 59) return null;

  const period = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
}
