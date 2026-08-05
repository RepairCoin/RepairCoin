"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Zap, Calendar, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AutoMessage, CreateAutoMessageRequest, UpdateAutoMessageRequest } from "@/services/api/messaging";
import { generateAutoMessageContent, getAutoMessageAbResults, type AbResults } from "@/services/api/messaging";
import dynamic from "next/dynamic";
import { getCampaigns, aiDraftCampaign, type MarketingCampaign } from "@/services/api/marketing";
import { useAuthStore } from "@/stores/authStore";

/**
 * The real campaign designer, rendered OVER this builder rather than navigated to.
 *
 * Lazy on purpose: it is a 2,477-line block editor with its own image handling, and pulling it into
 * this chunk would make every workflow — most of which never touch a campaign — pay for it.
 *
 * Embedding rather than rebuilding is the whole decision here. Campaigns need images to get read, so
 * an inline composer would either duplicate that editor or ship something that cannot do the one job
 * the campaign exists for. See campaign-action-editor-embed.md §2.
 */
const CampaignBuilderModal = dynamic(
  () => import("@/components/shop/marketing/CampaignBuilderModal").then((m) => m.CampaignBuilderModal),
  { ssr: false }
);
import toast from "react-hot-toast";

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const EVENT_TYPES = [
  { value: "booking_completed", label: "Booking Completed" },
  { value: "booking_cancelled", label: "Booking Cancelled" },
  { value: "first_visit", label: "First Visit" },
  { value: "inactive_30_days", label: "Inactive 30 Days" },
  { value: "low_bookings", label: "Slow Week (low bookings)" },
  // Operations triggers (W3) — each backed by a real platform event.
  { value: "no_show", label: "Customer No-Show" },
  { value: "review_received", label: "Review Received" },
  { value: "low_rating", label: "Low Rating (1–2 stars)" },
  { value: "payment_failed", label: "Payment Failed" },
  { value: "low_stock", label: "Low Stock (shop alert)" },
  { value: "new_ad_lead", label: "New Ad Lead (shop alert)" },
];

/**
 * Triggers that happen to the SHOP rather than to a customer. There is nobody to message, so these
 * force a shop-facing action — the API rejects the alternative, and a form that let you pick it would
 * just be a 400 waiting to happen.
 */
const SHOP_SCOPED_EVENTS = new Set(["low_stock", "new_ad_lead"]);

/**
 * Event triggers that SWEEP instead of reacting: nothing hands them a customer, so the engine resolves
 * a target audience for them. Kept in step with the two sweeps in AutoMessageSchedulerService — for
 * every other event the audience is dead config, which is why the field hides itself.
 */
const AUDIENCE_AWARE_EVENTS = new Set(["inactive_30_days", "low_bookings"]);

/**
 * Every action, and whether it acts on the SHOP rather than on a customer.
 *
 * One table instead of conditions repeated per field. Four separate places keyed on
 * `actionType === "notify_staff"` as shorthand for "shop-facing", which was true until three more
 * actions arrived — after which a campaign rule offered a Target Audience it does not consult, a
 * reorder rule offered a per-customer send cap, and a shop-scoped trigger claimed the action was
 * "Notify my team" whatever it actually was.
 *
 * `shopScoped` mirrors SHOP_SCOPED_ACTIONS in the backend registry; the two must agree, because the
 * API rejects a shop-scoped trigger paired with a customer-facing action.
 */
const ACTIONS: ReadonlyArray<{ value: string; label: string; hint: string; shopScoped: boolean }> = [
  { value: "send_message", label: "Send a message", hint: "To the customer", shopScoped: false },
  { value: "issue_reward", label: "Issue an RCN reward", hint: "Credits the customer", shopScoped: false },
  { value: "ai_step", label: "Let AI write it", hint: "Fresh copy each run", shopScoped: false },
  { value: "notify_staff", label: "Notify my team", hint: "Alerts you, not the customer", shopScoped: true },
  { value: "run_campaign", label: "Send a campaign", hint: "One send to a whole audience", shopScoped: true },
  { value: "draft_reorder", label: "Draft a reorder", hint: "A purchase order to approve", shopScoped: true },
];

const SHOP_SCOPED_ACTIONS = new Set(ACTIONS.filter((a) => a.shopScoped).map((a) => a.value));

const TARGET_AUDIENCES = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active (last 30 days)" },
  { value: "inactive_30d", label: "Inactive (30+ days)" },
  { value: "has_balance", label: "Has RCN Balance" },
  { value: "completed_booking", label: "Completed a Booking" },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Shared by the hour dropdown and its own trigger label, so the two can't drift. */
const hourLabel = (h: number) =>
  `${h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`} (UTC)`;

/**
 * Every `SelectValue` below is given EXPLICIT children rather than letting the trigger resolve its own
 * label.
 *
 * Left to itself, the trigger's text comes from the selected item, and the items only exist while the
 * dropdown is open. A select that is mounted BEFORE its value arrives therefore renders its
 * placeholder and never re-resolves — the value is correct in state and in what gets saved, but the
 * field reads as empty.
 *
 * That is exactly what happened here. Editing a saved rule showed "Select audience" on a rule that had
 * a stored audience, because Target Audience is mounted on first render (it sits outside the trigger
 * blocks) and the prefill effect sets it a tick later. Event looked fine purely by luck of mounting:
 * it lives inside `triggerType === "event"`, which is false on first render, so it mounts fresh with
 * its value already set. Same component, same props, opposite outcome — decided by mount order.
 *
 * Deriving the label from state removes the timing question entirely.
 *
 * That reasoning did NOT fix Target Audience — it stayed blank on the deployed build — so that one
 * field goes further and renders its label as a plain span, bypassing `SelectValue` altogether. See
 * `effectiveAudience`. The explicit children below remain correct and are worth keeping regardless;
 * they are simply not sufficient on their own.
 */

const TEMPLATE_VARIABLES = [
  { key: "{{customerName}}", label: "Customer Name" },
  { key: "{{rcnBalance}}", label: "RCN Balance" },
  { key: "{{shopName}}", label: "Shop Name" },
  { key: "{{lastServiceName}}", label: "Last Service" },
  { key: "{{lastVisitDate}}", label: "Last Visit Date" },
];

/** One step of a workflow. `actionType` absent = a message step, the pre-A1 shape. */
interface WorkflowStep {
  actionType?: string;
  actionPayload?: Record<string, any> | null;
  messageTemplate?: string;
  delayHours: number;
}

interface AutoMessageRuleModalProps {
  /**
   * An existing rule to edit, OR a template prefill (A3) — a partial with no `id`, which opens the
   * builder populated but still in "create" mode so the owner reviews the copy before it goes live.
   */
  rule?: (Partial<AutoMessage> & { id?: string }) | null;
  onClose: () => void;
  onSave: (data: CreateAutoMessageRequest | UpdateAutoMessageRequest) => Promise<void>;
  /**
   * Which surface is using the builder (D7). One component, two entry points — rather than a second
   * builder that drifts. 'workflow' relabels the message-centric copy and lets each sequence step
   * choose its own action; 'campaign' keeps the AI Campaigns wording exactly as it was.
   */
  surface?: "campaign" | "workflow";
}

export const AutoMessageRuleModal: React.FC<AutoMessageRuleModalProps> = ({
  rule,
  onClose,
  onSave,
  surface = "campaign",
}) => {
  const isWorkflow = surface === "workflow";
  // A template (A3) is passed in as a `rule` with NO id — it prefills every field but still saves as a
  // new workflow, so the owner reviews and tweaks the copy before anything goes live.
  const isEditing = !!rule?.id;
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  // What the rule DOES when it fires (Custom Workflows W2). 'send_message' is everything that existed
  // before actions; 'issue_reward' sends nothing and needs no template.
  const [actionType, setActionType] = useState<
    "send_message" | "issue_reward" | "notify_staff" | "run_campaign" | "ai_step" | "draft_reorder"
  >("send_message");
  /** run_campaign: the campaign used as a template. Each firing clones and sends a copy. */
  const [campaignId, setCampaignId] = useState("");
  /**
   * The shop's campaigns, kept WHOLE rather than narrowed.
   *
   * They were mapped down to a handful of fields, which threw away everything the summary needed and
   * — once the editor could be opened from here — left nothing to hand it: `existingCampaign` wants
   * the real row, and refetching one we already had would be a second request to rebuild an object we
   * chose to discard.
   */
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  /** The brief for an AI-drafted campaign, and whether one is being written right now. */
  const [campaignBrief, setCampaignBrief] = useState("");
  const [draftingCampaign, setDraftingCampaign] = useState(false);
  /**
   * Why the last AI draft has no banner image.
   *
   * Kept and shown rather than swallowed: the image is refused for ordinary reasons — the shop's
   * kill-switch is off, its monthly image budget is gone, the prompt was flagged — and a campaign
   * that quietly arrives without the picture the owner expected reads as broken.
   */
  const [campaignImageSkipped, setCampaignImageSkipped] = useState<string | null>(null);
  /**
   * The campaign summary, so a freshly drafted campaign can be scrolled into view.
   *
   * The brief and the button sit at the TOP of the panel and the result lands below the fold, so a
   * success looked like nothing had happened — the shop reported the feature as broken for a
   * campaign that had been created, written and illustrated.
   */
  const campaignSummaryRef = React.useRef<HTMLDivElement | null>(null);
  /** Which campaign the embedded editor is open on, and why. `null` = closed. */
  const [campaignEditor, setCampaignEditor] = useState<
    { mode: "create" | "edit" | "view"; campaign: MarketingCampaign | null } | null
  >(null);
  /** Subscribed rather than read via getState(), so the editor gets the shop even on a late login. */
  const shopProfile = useAuthStore((s) => s.userProfile);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(25);
  const [rewardReason, setRewardReason] = useState("");
  /** Body of a `notify_staff` alert. Separate from rewardReason — see the prefill note below. */
  const [alertText, setAlertText] = useState("");
  /** ai_step: the owner's brief. Optional — the generator also has the trigger, audience and name. */
  const [aiBrief, setAiBrief] = useState("");
  /**
   * A one-off sample of what this workflow might send.
   *
   * Without it the owner publishes a BEHAVIOUR rather than a message — they never see a sentence
   * before real customers do. It is called on demand only: every sample is a real generation against
   * the shop's monthly AI allowance, so it must never fire on typing.
   */
  const [aiSample, setAiSample] = useState("");
  const [samplingAi, setSamplingAi] = useState(false);
  const [triggerType, setTriggerType] = useState<"schedule" | "event">("schedule");
  /**
   * Has the trigger been chosen deliberately (by a click or a template) rather than left at its default?
   * Picking "Notify my team" flips an untouched default to Event, because "tell me when X happens" is
   * what an alert almost always means — and the Schedule default silently produced the one shape that
   * ignores everything happening in the shop.
   */
  const [triggerTouched, setTriggerTouched] = useState(false);
  const [scheduleType, setScheduleType] = useState("daily");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleHour, setScheduleHour] = useState(10);
  const [eventType, setEventType] = useState("booking_completed");
  const [delayHours, setDelayHours] = useState(24);
  const [targetAudience, setTargetAudience] = useState("all");
  /**
   * The audience this form is actually operating on.
   *
   * Target Audience rendered as an empty "Select audience" on rules that demonstrably HAVE a stored
   * audience — the API returns `inactive_30d`, the database agrees, and yet the control came up blank.
   * Two causes were possible and I could not tell them apart from outside the browser: either the state
   * was somehow empty, or the dropdown was failing to reflect a state that was fine.
   *
   * Rather than guess again, this collapses both. The value is whatever the state holds IF that is a
   * real option; otherwise it falls back to the rule's stored audience, and only then to "all". So a
   * blank or corrupted state can no longer either display as empty or be SAVED over the top of a
   * correct stored value — which was the actual risk, since an owner seeing a blank field would pick
   * something and overwrite an audience that was right all along.
   *
   * It never invents a value that contradicts the rule: the fallback IS the stored one.
   */
  const isAudience = (v: unknown): v is string =>
    typeof v === "string" && TARGET_AUDIENCES.some((a) => a.value === v);
  const storedAudience = rule?.targetAudience;
  const effectiveAudience = isAudience(targetAudience)
    ? targetAudience
    : isAudience(storedAudience)
    ? storedAudience
    : "all";
  const [maxSendsPerCustomer, setMaxSendsPerCustomer] = useState(1);
  // Drip sequence (multi-step) state. Sequences are event-triggered only.
  const [useSequence, setUseSequence] = useState(false);
  // A1: steps are workflow-shaped (each may carry its own action), not message-shaped.
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [stopOnBooking, setStopOnBooking] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<number | null>(null);
  // A/B test state (Phase 4). Mutually exclusive with sequences.
  const [useAbTest, setUseAbTest] = useState(false);
  const [variantB, setVariantB] = useState("");
  const [generatingB, setGeneratingB] = useState(false);
  const [abResults, setAbResults] = useState<AbResults | null>(null);

  // The alert goes to the shop and its team, so nothing about this rule concerns a customer.
  const notifiesStaff = actionType === "notify_staff";

  /**
   * Does the ACTION act on the shop rather than on a customer?
   *
   * Distinct from `shopScoped`, which asks the same of the TRIGGER. Either one being true means no
   * customer is involved, so a target audience and a per-customer send cap are both meaningless.
   */
  const actionActsOnShop = SHOP_SCOPED_ACTIONS.has(actionType);

  /**
   * Does Target Audience actually do anything for this configuration?
   *
   * It only ever did for rules where the engine has to decide WHO to act on: schedule rules, plus the
   * two "sweep" events that fire without a customer attached (`processInactiveCustomers`,
   * `processLowBookings`). Every other event arrives carrying the customer it happened to — the engine
   * never consults the audience — so showing the field there promised a filter that did not exist.
   */
  const audienceApplies =
    // run_campaign is shop-scoped — it fires once, not once per customer — but it DOES consult the
    // audience now: the engine resolves it on each firing and hands the campaign that exact list.
    // Hiding it here was right when the campaign chose for itself; it is wrong now, and it left a
    // recurring campaign quietly going to every customer the shop has.
    (!actionActsOnShop || actionType === "run_campaign") &&
    (triggerType === "schedule" || AUDIENCE_AWARE_EVENTS.has(eventType));

  /**
   * Does the engine actually wait before acting?
   *
   * `delayHours` is only read on the event-DISPATCH path (`handleEventTrigger`), where a real event
   * hands over a customer and the send can be queued for later. The two SWEEP events resolve their
   * own audience in `processInactiveCustomers` / `processLowBookings` and send immediately, and the
   * shop-scoped events run through `handleShopEvent`, which has no delay either.
   *
   * Found the hard way: a published "Inactive 30 days + 1h" workflow sent within the same tick. The
   * field promised a wait that nothing implements — the same dead config Target Audience was, and
   * worth hiding for the same reason.
   */
  const delayApplies =
    triggerType === "event" &&
    !SHOP_SCOPED_EVENTS.has(eventType) &&
    !AUDIENCE_AWARE_EVENTS.has(eventType);

  useEffect(() => {
    if (rule) {
      // Fallbacks throughout, because `rule` may be a TEMPLATE prefill (A3) that only sets the fields
      // it cares about — a template shouldn't have to spell out every schedule field it doesn't use,
      // and an undefined here would leave a controlled input uncontrolled.
      setName(rule.name ?? "");
      setMessageTemplate(rule.messageTemplate ?? "");
      setActionType(
        rule.actionType === "issue_reward" ||
          rule.actionType === "notify_staff" ||
          rule.actionType === "run_campaign" ||
          rule.actionType === "ai_step" ||
          rule.actionType === "draft_reorder"
          ? rule.actionType
          : "send_message"
      );
      setRewardAmount(Number(rule.actionPayload?.amountRcn) || 25);
      // Separate fields per action. They used to share one piece of state, so text typed as a 500-char
      // staff alert reappeared in a reward "Reason" box labelled 120 — and survived, because maxLength
      // doesn't trim a value set programmatically.
      setRewardReason(typeof rule.actionPayload?.reason === "string" ? rule.actionPayload.reason : "");
      setAlertText(typeof rule.actionPayload?.message === "string" ? rule.actionPayload.message : "");
      setAiBrief(
        typeof rule.actionPayload?.prompt === "string" ? rule.actionPayload.prompt : ""
      );
      setCampaignId(
        typeof rule.actionPayload?.campaignId === "string" ? rule.actionPayload.campaignId : ""
      );
      setTriggerType(rule.triggerType ?? "schedule");
      // A prefill that states a trigger has made the choice deliberately — don't second-guess it below.
      if (rule.triggerType) setTriggerTouched(true);
      setScheduleType(rule.scheduleType || "daily");
      setScheduleDayOfWeek(rule.scheduleDayOfWeek ?? 1);
      setScheduleDayOfMonth(rule.scheduleDayOfMonth ?? 1);
      setScheduleHour(rule.scheduleHour ?? 10);
      setEventType(rule.eventType || "booking_completed");
      setDelayHours(rule.delayHours ?? 24);
      setTargetAudience(rule.targetAudience ?? "all");
      setMaxSendsPerCustomer(rule.maxSendsPerCustomer ?? 1);
      const hasSteps = !!rule.steps && rule.steps.length > 0;
      setUseSequence(hasSteps);
      setSteps(hasSteps ? rule.steps!.map((s) => ({ ...s })) : []);
      setStopOnBooking(rule.stopOnBooking ?? false);
      setUseAbTest(!!rule.variantB);
      setVariantB(rule.variantB || "");
      // Load A/B results — only for a SAVED rule. A template prefill has no id and no results yet.
      if (rule.variantB && rule.id) {
        getAutoMessageAbResults(rule.id).then(setAbResults).catch(() => setAbResults(null));
      }
    }
  }, [rule]);

  const generateB = async () => {
    setGeneratingB(true);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience: effectiveAudience,
        name: name || undefined,
        prompt: "This is variant B of an A/B test — write a distinctly different angle from variant A.",
      });
      setVariantB(text);
      toast.success("AI drafted variant B");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate — please try again");
    } finally {
      setGeneratingB(false);
    }
  };

  const draftCampaignWithAi = async () => {
    const shopId = shopProfile?.shopId;
    if (!shopId) return;
    setDraftingCampaign(true);
    setCampaignImageSkipped(null);
    try {
      const { campaign, imageSkipped } = await aiDraftCampaign(shopId, {
        brief: campaignBrief.trim() || undefined,
        triggerType,
        eventType: triggerType === "event" ? eventType : undefined,
        name: name.trim() || undefined,
      });
      // Selected immediately — the point of drafting it here is that the owner does not then have to
      // go and find it in a list they never left.
      setCampaigns((prev) => [campaign, ...prev.filter((c) => c.id !== campaign.id)]);
      setCampaignId(campaign.id);
      setCampaignImageSkipped(imageSkipped);
      toast.success("Campaign drafted — preview it before you publish");
      // Bring the result into view. A toast at the top of the screen is not evidence that something
      // appeared at the bottom of a scrolling form; the shop has to SEE the thing that was made.
      // Deferred a frame so the summary has rendered before we scroll to it.
      requestAnimationFrame(() =>
        campaignSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch (e: any) {
      // The API chooses its status for a reason: budget reached, an offer nobody asked for, or
      // unusable output. Relaying its message keeps that reason instead of "something went wrong".
      toast.error(e?.response?.data?.error || "Couldn't draft the campaign — please try again");
    } finally {
      setDraftingCampaign(false);
    }
  };

  const sampleAiMessage = async () => {
    setSamplingAi(true);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        scheduleType: triggerType === "schedule" ? scheduleType : undefined,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience: effectiveAudience,
        name: name || undefined,
        prompt: aiBrief.trim() || undefined,
      });
      setAiSample(text);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't write a sample — please try again");
    } finally {
      setSamplingAi(false);
    }
  };

  const addStep = () =>
    setSteps((p) => [...p, { messageTemplate: "", delayHours: p.length === 0 ? 0 : 24 }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<WorkflowStep>) =>
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const generateStep = async (i: number) => {
    setGeneratingStep(i);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience: effectiveAudience,
        name: name || undefined,
        prompt: `This is step ${i + 1} of a multi-step sequence. Keep it distinct from earlier steps.`,
      });
      updateStep(i, { messageTemplate: text });
      toast.success(`AI drafted step ${i + 1}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate — please try again");
    } finally {
      setGeneratingStep(null);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => prev + variable);
  };

  // AI-draft the message from the rule's current trigger/audience/name context.
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { messageTemplate: text } = await generateAutoMessageContent({
        triggerType,
        scheduleType: triggerType === "schedule" ? scheduleType : undefined,
        eventType: triggerType === "event" ? eventType : undefined,
        targetAudience: effectiveAudience,
        name: name || undefined,
      });
      setMessageTemplate(text);
      toast.success("AI drafted your message — edit as you like");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Couldn't generate a message — please try again");
    } finally {
      setGenerating(false);
    }
  };

  const resolvePreview = (template: string) => {
    return template
      .replace(/\{\{customerName\}\}/g, "John")
      .replace(/\{\{rcnBalance\}\}/g, "150")
      .replace(/\{\{shopName\}\}/g, "My Shop")
      .replace(/\{\{lastServiceName\}\}/g, "Oil Change")
      .replace(/\{\{lastVisitDate\}\}/g, "Mar 1, 2026");
  };

  // A reward rule sends nothing, so drip sequences and A/B (both message concepts) don't apply to it.
  // A shop-scoped trigger (low stock) has no customer, so messaging, rewards, sequences and A/B all
  // become meaningless — there is nobody on the other end.
  const shopScoped = triggerType === "event" && SHOP_SCOPED_EVENTS.has(eventType);
  const rewardMode = actionType === "issue_reward" && !shopScoped;

  /**
   * Does this rule compose a customer message IN THIS FORM?
   *
   * Only `send_message` does. Every other action either carries its own content (a campaign has its
   * own subject and body), writes it at send time (`ai_step`), or messages nobody at all (reward,
   * staff alert, reorder). For all of them the Message Template, the variable chips, the drip
   * sequence and the A/B toggle are meaningless — and worse than meaningless, because the form
   * accepted text there and then discarded it at submit, so choosing "Let AI write it" still showed a
   * template box to fill in.
   *
   * Written as one predicate rather than repeated inline conditions, which is how the three actions
   * added on 2026-08-03 came to be missed in two places at once.
   */
  const composesMessage = !shopScoped && actionType === "send_message";
  // Sequences are event-triggered only (enrollment is wired into the event path).
  // Keyed on composesMessage, not just on "not a reward": a rule loaded WITH steps and then switched
  // to an AI or campaign action would otherwise keep sequenceMode true while its editor is hidden —
  // invisible state still driving what gets submitted.
  const sequenceMode = useSequence && triggerType === "event" && composesMessage;
  // A/B works on any single-message rule; can't combine with a sequence.
  const abMode = useAbTest && !sequenceMode && composesMessage;

  // Does this rule carry a message on the RULE itself? A sequence keeps its copy in the steps.
  const needsRuleMessage = composesMessage && !sequenceMode;

  /**
   * Campaigns available as templates for `run_campaign`.
   *
   * Fetched lazily — only when the action is actually chosen — so opening the builder to edit a
   * message rule doesn't pull a campaign list nobody asked for. Failure is silent and leaves the
   * list empty: the select then says there are none, which is the same thing a shop with no
   * campaigns sees, and is better than an error toast on a field you may not be using.
   */
  useEffect(() => {
    if (actionType !== "run_campaign" || campaignsLoaded) return;
    const shopId = useAuthStore.getState().userProfile?.shopId;
    if (!shopId) return;
    setCampaignsLoaded(true);
    getCampaigns(shopId, 1, 50)
      .then((res) =>
        setCampaigns(res.items ?? [])
      )
      .catch(() => setCampaigns([]));
  }, [actionType, campaignsLoaded]);

  // Picking a shop-scoped trigger forces the shop-facing action, so the form can't produce a rule the
  // API will reject.
  useEffect(() => {
    // Any SHOP-scoped action is legitimate here, not just the staff alert — a campaign resolves its
    // own audience, so "stock is low → send the clearance campaign" is coherent. Only a
    // customer-facing action needs correcting, and notify_staff is the safe landing spot.
    if (
      shopScoped &&
      actionType !== "notify_staff" &&
      actionType !== "run_campaign" &&
      actionType !== "draft_reorder"
    ) {
      setActionType("notify_staff");
    }
  }, [shopScoped, actionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (rewardMode && (!Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100)) {
      toast.error("Reward amount must be between 1 and 100 RCN");
      return;
    }

    // No campaign-required check at SAVE. A draft never runs, so it cannot error, and blocking the
    // save meant a shop with no campaign yet lost its half-configured workflow on the way to
    // Marketing to build one. The requirement is enforced at Publish, where it actually matters.

    let cleanSteps: WorkflowStep[] = [];
    if (rewardMode || actionType === "notify_staff" || actionType === "run_campaign" || actionType === "ai_step" || actionType === "draft_reorder") {
      // None of these sends a customer message, so there is no body to validate.
    } else if (sequenceMode) {
      // Keep a step if it's a non-messaging step (nothing to compose) OR a message step with a body.
      cleanSteps = steps
        .map((s) => {
          const action = s.actionType || "send_message";
          const delayHours = Number(s.delayHours) || 0;
          if (action === "issue_reward") {
            return { actionType: action, actionPayload: { amountRcn: Number(s.actionPayload?.amountRcn) || 0 }, delayHours };
          }
          if (action === "notify_staff") {
            const msg = String(s.actionPayload?.message ?? "").trim();
            return { actionType: action, actionPayload: msg ? { message: msg } : {}, delayHours };
          }
          return { actionType: action, messageTemplate: (s.messageTemplate || "").trim(), delayHours };
        })
        .filter((s) => s.actionType !== "send_message" || s.messageTemplate);

      if (cleanSteps.length === 0) {
        toast.error("Add at least one step");
        return;
      }
      const badReward = cleanSteps.find(
        (s) => s.actionType === "issue_reward" && (!s.actionPayload?.amountRcn || Number(s.actionPayload.amountRcn) > 100)
      );
      if (badReward) {
        toast.error("Each reward step needs an amount between 1 and 100 RCN");
        return;
      }
    } else if (!messageTemplate.trim()) {
      // Say why. A silent return is what made the disabled button so confusing in the first place —
      // the form refused to proceed and never explained itself.
      toast.error("Add a message to send");
      return;
    }

    setSaving(true);
    try {
      const isReward = actionType === "issue_reward";
      const isNotify = actionType === "notify_staff";
      const isCampaign = actionType === "run_campaign";
      const isAiStep = actionType === "ai_step";
      const isReorder = actionType === "draft_reorder";
      // None of these stores a message_template: a campaign carries its own body, and an AI step
      // writes one when it runs — a stored template is the thing it exists to replace.
      const sendsNoMessage = isReward || isNotify || isCampaign || isAiStep || isReorder;
      const data: CreateAutoMessageRequest = {
        name: name.trim(),
        // An action that sends nothing carries no template. In a sequence the rule-level template
        // mirrors the first MESSAGE step; a workflow made only of rewards/alerts has none, which
        // migration 248 allows.
        messageTemplate: sendsNoMessage
          ? null
          : sequenceMode
          ? cleanSteps.find((s) => s.actionType === "send_message")?.messageTemplate ?? null
          : messageTemplate.trim(),
        actionType,
        actionPayload: isReward
          ? { amountRcn: rewardAmount, ...(rewardReason.trim() ? { reason: rewardReason.trim() } : {}) }
          : isNotify
          ? (alertText.trim() ? { message: alertText.trim() } : {})
          : isCampaign
          ? { campaignId }
          : isAiStep
          ? (aiBrief.trim() ? { prompt: aiBrief.trim() } : {})
          : null,
        triggerType,
        ...(triggerType === "schedule" && {
          scheduleType,
          ...(scheduleType === "weekly" && { scheduleDayOfWeek }),
          ...(scheduleType === "monthly" && { scheduleDayOfMonth }),
          scheduleHour,
        }),
        ...(triggerType === "event" && {
          eventType,
          // Forced to 0 where the engine ignores it, so the stored rule cannot claim a wait that
          // never happens — hiding the input alone would leave the old value in place on edit.
          delayHours: delayApplies ? delayHours : 0,
        }),
        targetAudience: effectiveAudience,
        // Hiding the input is not enough: it defaults to 1, and the engine's per-customer cap applies
        // to a staff alert on a customer event too — so a repeat no-show by the same customer would be
        // reported once and then never again. 0 means uncapped (the engine's check is truthy).
        maxSendsPerCustomer: actionActsOnShop ? 0 : maxSendsPerCustomer,
        // Send the sequence (or clear it when not in sequence mode).
        steps: sequenceMode ? cleanSteps : null,
        stopOnBooking: sequenceMode ? stopOnBooking : false,
        // A/B variant B (or clear it) — never alongside a sequence.
        variantB: abMode ? (variantB.trim() || null) : null,
      };
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">
            {isWorkflow
              ? isEditing ? "Edit Workflow" : "New Workflow"
              : isEditing ? "Edit Auto-Message Rule" : "New Auto-Message Rule"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Loyalty Reminder"
              maxLength={200}
              className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
            />
          </div>

          {/* What the rule DOES (Custom Workflows W2). Everything above/below — triggers, audience,
              timing — applies identically whichever action is chosen. */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Then do this</label>
            {/* Driven by the ACTIONS table, so a new action cannot be added to the picker and
                forgotten in the shop-scoped case. A shop-scoped TRIGGER now NARROWS the choice to
                shop-facing actions rather than asserting one: "low stock → draft a reorder" is the
                obvious workflow for that trigger, and the hardcoded "Notify my team" box made it
                unreachable in the UI entirely. */}
            {shopScoped && (
              <p className="text-xs text-gray-400 mb-2">
                This one happens to your shop, not to a customer — so it can only do something for you.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.filter((a) => !shopScoped || a.shopScoped).map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => {
                    setActionType(a.value as typeof actionType);
                    // "Alert me when X happens" is the overwhelmingly common intent. Only nudge an
                    // untouched default — a deliberate Schedule choice ("every Monday, remind the
                    // team") is legitimate and must survive.
                    if (a.value === "notify_staff" && !triggerTouched) setTriggerType("event");
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm text-left ${
                    actionType === a.value
                      ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-gray-500">{a.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {actionType === "draft_reorder" && (
            // No config: the reorder logic already decides which items and how many from usage
            // analytics. A quantity field here would just be a second opinion competing with it.
            <div className="rounded-lg border border-gray-700 bg-[#0D0D0D] px-3 py-2">
              <p className="text-xs text-gray-400">
                Drafts a purchase order for whatever is at or below its reorder level, and puts it in
                your PO suggestions to approve. It never places an order or spends money on its own,
                and running again won&apos;t create a duplicate draft for the same item.
              </p>
            </div>
          )}

          {actionType === "ai_step" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">What should it say? (optional)</label>
              <textarea
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                placeholder="e.g. friendly nudge, mention we're open Sundays"
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
              />
              {/* Says the two things an owner would otherwise have to discover: the copy changes
                  between runs, and it is written once per run rather than once per person — which is
                  what keeps it affordable against the shop's monthly AI allowance. */}
              <p className="text-xs text-gray-500 mt-1">
                Written fresh each time this runs, using your brand voice. One version per run, with{" "}
                {"{{customerName}}"} filled in per customer. Leave blank and it works from the trigger
                and audience alone.
              </p>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={sampleAiMessage}
                  disabled={samplingAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs hover:border-gray-600 disabled:opacity-60"
                >
                  {samplingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {aiSample ? "Show another example" : "Show me an example"}
                </button>
                <span className="text-xs text-gray-500">Uses a little of your AI allowance</span>
              </div>

              {aiSample && (
                <div className="mt-2 rounded-lg border border-gray-700 bg-[#0D0D0D] p-3">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{aiSample}</p>
                  {/* "Example", never "preview". The live message is generated fresh at send time, so
                      this is not what will be sent — saying otherwise would set an expectation the
                      feature cannot keep. */}
                  <p className="text-xs text-gray-500 mt-2">
                    An example of what it might say. The real message is written when the workflow
                    runs, so it will read differently.
                  </p>
                </div>
              )}
            </div>
          )}

          {actionType === "run_campaign" && (
            <div>
              {/* AI first. Writing a campaign by hand — subject, body, and an image that makes it
                  worth opening — is work a shop owner will not do, which is the whole reason this
                  action went unused. The designer below stays for fixing what the AI wrote. */}
              <div className="rounded-lg border border-[#FFCC00]/40 bg-[#FFCC00]/5 p-3 mb-3">
                <label className="block text-sm text-white mb-1">Let AI write the campaign</label>
                <p className="text-xs text-gray-400 mb-2">
                  Describe it in a line and AI writes the subject, the body and a banner image. You
                  preview it before anything is published.
                </p>
                <input
                  type="text"
                  value={campaignBrief}
                  onChange={(e) => setCampaignBrief(e.target.value)}
                  placeholder="e.g. win back customers we haven't seen since spring"
                  maxLength={500}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={draftCampaignWithAi}
                    disabled={draftingCampaign}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00] text-black text-xs font-medium disabled:opacity-60"
                  >
                    {draftingCampaign ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    {draftingCampaign ? "Writing…" : "Create it for me"}
                  </button>
                  {/* Regeneration is a decision, not a reflex — each press is a Claude call plus an
                      image, and the image is the expensive half. */}
                  <span className="text-xs text-gray-500">Writes copy and an image — uses your AI allowance</span>
                </div>
                {campaignImageSkipped && (
                  <p className="text-xs text-amber-400/90 mt-2">
                    Written without a banner image: {campaignImageSkipped} You can add one in Edit.
                  </p>
                )}
              </div>

              <label className="block text-sm text-gray-400 mb-2">Campaign to send</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
              >
                <option value="">
                  {/* No longer sends anyone to Marketing: both routes out of an empty list are on
                      this screen now — let AI write one, or build one in the designer. */}
                  {campaigns.length ? "Select a campaign…" : "No campaigns yet — let AI write one above"}
                </option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {/* A draft is the RECOMMENDED choice, not an unfinished one: the workflow only
                        ever sends copies, so a draft is never itself sent and stays editable
                        forever. A sent campaign is read-only, so picking one freezes the content of
                        this workflow for good. "(draft)" alone read as a warning about the better
                        option. */}
                    {c.status === "sent" ? " — content locked" : c.status === "draft" ? " — editable" : ""}
                  </option>
                ))}
              </select>
              {/* Both sentences describe behaviour a shop would otherwise discover by accident: that
                  the campaign is reused rather than consumed, and that its rewards do NOT fire on a
                  schedule nobody approved. */}
              {(() => {
                const picked = campaigns.find((c) => c.id === campaignId);
                if (!picked) return null;
                const audience = picked.audienceType
                  ? picked.audienceType.replace(/_/g, " ")
                  : "its own audience";
                // The banner, straight out of the campaign we are already holding. AI drawing a
                // picture is the most reassuring part of what just happened, and the summary was
                // four lines of grey text — so the shop asked where the image was for a campaign
                // that had one all along.
                const banner = (picked.designContent as { blocks?: Array<{ type?: string; src?: string }> })
                  ?.blocks?.find((b) => b.type === "image" && b.src)?.src;

                return (
                  <div ref={campaignSummaryRef} className="mt-2 rounded-lg border border-gray-700 bg-[#0D0D0D] p-3 space-y-2">
                    {banner && (
                      // eslint-disable-next-line @next/next/no-img-element
                      // Full width, natural height — NOT object-cover. Cropping a banner to a fixed
                      // height cut the middle out of it, which is the one thing a preview must not
                      // do: the owner is deciding whether to send this, so they have to see what
                      // the customer sees, not a slice of it.
                      <img
                        src={banner}
                        alt=""
                        className="w-full h-auto rounded border border-gray-800"
                      />
                    )}
                    <p className="text-sm text-gray-200">
                      {picked.subject || <span className="text-gray-500">No subject line set</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Goes to {audience}
                      {picked.deliveryMethod ? ` by ${picked.deliveryMethod.replace(/_/g, "-")}` : ""}
                      {picked.totalRecipients ? ` · reached ${picked.totalRecipients} last time` : ""}
                    </p>
                    {picked.status === "sent" && (
                      <p className="text-xs text-amber-400/90">
                        This one has been sent, so its content can no longer be edited. Pick a draft
                        campaign if you want to change the wording later.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Design, preview and edit happen HERE. Sending the shop to Marketing mid-task was the
                  whole complaint: they lost the half-built workflow on the way out, and a shop with
                  no campaigns hit a dead end. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCampaignEditor({ mode: "create", campaign: null })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs hover:border-gray-600"
                >
                  <Plus className="w-3.5 h-3.5" /> Create new campaign
                </button>
                {(() => {
                  const picked = campaigns.find((c) => c.id === campaignId);
                  if (!picked) return null;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setCampaignEditor({ mode: "view", campaign: picked })}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs hover:border-gray-600"
                      >
                        Preview
                      </button>
                      {/* A sent campaign is read-only, so an Edit button here would only ever produce
                          a 400. The locked state in the summary explains why instead. */}
                      {picked.status !== "sent" && (
                        <button
                          type="button"
                          onClick={() => setCampaignEditor({ mode: "edit", campaign: picked })}
                          className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs hover:border-gray-600"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Used as a template — each run sends a fresh copy, so the original keeps its own history.
                The campaign picks its own audience, and any RCN rewards on it are <strong>not</strong>{" "}
                issued by the workflow.
              </p>
            </div>
          )}

          {actionType === "notify_staff" && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Alert text (optional)</label>
              <input
                type="text"
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                placeholder="e.g. Reorder before the weekend"
                maxLength={500}
                className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Goes to you and your team. Leave blank to use the workflow name.
              </p>
            </div>
          )}

          {rewardMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount (RCN)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Debited from your RCN balance each time this fires. Max 100 per automated issue.
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={rewardReason}
                  onChange={(e) => setRewardReason(e.target.value)}
                  placeholder="e.g. Loyalty bonus"
                  maxLength={120}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Trigger Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Trigger Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setTriggerTouched(true); setTriggerType("schedule"); }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  triggerType === "schedule"
                    ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                    : "border-gray-700 bg-[#0D0D0D] text-gray-400 hover:border-gray-500"
                }`}
              >
                <Calendar className="w-5 h-5 mb-1" />
                <p className="text-sm font-medium">Schedule</p>
                <p className="text-xs text-gray-500">
                  {notifiesStaff ? "On a clock — not when something happens" : "Daily, weekly, or monthly"}
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setTriggerTouched(true); setTriggerType("event"); }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  triggerType === "event"
                    ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                    : "border-gray-700 bg-[#0D0D0D] text-gray-400 hover:border-gray-500"
                }`}
              >
                <Zap className="w-5 h-5 mb-1" />
                <p className="text-sm font-medium">Event</p>
                {/* Was "After booking actions", which stopped being true once W3 added reviews, low
                    ratings, failed payments and low stock — and steered people to Schedule. */}
                <p className="text-xs text-gray-500">When something happens in your shop</p>
              </button>
            </div>
          </div>

          {/* Schedule Config */}
          {triggerType === "schedule" && (
            <div className="space-y-3 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                <Select value={scheduleType} onValueChange={(value) => setScheduleType(value)}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select frequency">
                      {SCHEDULE_TYPES.find((t) => t.value === scheduleType)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {SCHEDULE_TYPES.map((t) => (
                      <SelectItem variant="dark" key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scheduleType === "weekly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Week</label>
                  <Select value={String(scheduleDayOfWeek)} onValueChange={(value) => setScheduleDayOfWeek(parseInt(value))}>
                    <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                      <SelectValue placeholder="Select day">{DAYS_OF_WEEK[scheduleDayOfWeek]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent variant="dark">
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem variant="dark" key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scheduleType === "monthly" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day of Month</label>
                  <Select value={String(scheduleDayOfMonth)} onValueChange={(value) => setScheduleDayOfMonth(parseInt(value))}>
                    <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                      <SelectValue placeholder="Select day">{String(scheduleDayOfMonth)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent variant="dark">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem variant="dark" key={d} value={String(d)}>{String(d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Send at (UTC Hour)</label>
                <Select value={String(scheduleHour)} onValueChange={(value) => setScheduleHour(parseInt(value))}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select hour">{hourLabel(scheduleHour)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem variant="dark" key={i} value={String(i)}>
                        {hourLabel(i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Event Config */}
          {triggerType === "event" && (
            <div className="space-y-3 p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Event</label>
                <Select value={eventType} onValueChange={(value) => setEventType(value)}>
                  <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                    <SelectValue placeholder="Select event">
                      {EVENT_TYPES.find((t) => t.value === eventType)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent variant="dark">
                    {EVENT_TYPES.map((t) => (
                      <SelectItem variant="dark" key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Hidden where the engine never waits — see delayApplies. A sweep sends the moment it
                  runs, so offering a delay there promises something nothing implements. */}
              <div className={delayApplies ? "" : "hidden"}>
                <label className="block text-xs text-gray-400 mb-1">Delay (hours after event)</label>
                <input
                  type="number"
                  value={delayHours}
                  onChange={(e) => setDelayHours(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  max={720}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                />
              </div>
              {!delayApplies && (
                <p className="text-xs text-gray-500">
                  This one runs on a sweep, so it acts as soon as it finds someone — there is nothing
                  to delay.
                </p>
              )}
            </div>
          )}

          {/* Target Audience — hidden when the engine won't consult it (see audienceApplies). */}
          <div className={audienceApplies ? "" : "hidden"}>
            <label className="block text-sm text-gray-400 mb-1">Target Audience</label>
            <Select value={effectiveAudience} onValueChange={(value) => setTargetAudience(value)}>
              {/* The label is rendered directly, NOT via <SelectValue>. SelectValue only shows its
                  children when the library's own copy of the value is non-empty; when that copy went
                  empty the field showed a placeholder over a rule that had a perfectly good audience.
                  A plain span cannot do that — it renders what this form is holding, always. */}
              <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#0D0D0D] border-gray-700 rounded-lg text-white text-sm">
                <span>{TARGET_AUDIENCES.find((a) => a.value === effectiveAudience)?.label}</span>
              </SelectTrigger>
              <SelectContent variant="dark">
                {TARGET_AUDIENCES.map((a) => (
                  <SelectItem variant="dark" key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max Sends — a staff alert isn't addressed to a customer, so a per-customer cap is
              meaningless for it (and the submitted value is forced to "uncapped"). */}
          <div className={actionActsOnShop ? "hidden" : ""}>
            <label className="block text-sm text-gray-400 mb-1">Max sends per customer</label>
            <input
              type="number"
              value={maxSendsPerCustomer}
              onChange={(e) => setMaxSendsPerCustomer(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
              className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isWorkflow
                ? "How many times this workflow can run for the same customer"
                : "How many times this rule can message the same customer"}
            </p>
          </div>

          {/* Advanced-mode toggles: a rule is a single message, OR a drip sequence, OR an A/B test.
              All three are message concepts, so none of them apply to a reward rule. */}
          <div className={`flex flex-col gap-1.5 ${composesMessage ? "" : "hidden"}`}>
            {/* Multi-step sequence toggle (event triggers only — enrollment is event-driven) */}
            {triggerType === "event" && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSequence}
                  onChange={(e) => {
                    setUseSequence(e.target.checked);
                    if (e.target.checked) {
                      setUseAbTest(false); // sequence + A/B are mutually exclusive
                      if (steps.length === 0) setSteps([{ messageTemplate: messageTemplate || "", delayHours: 0 }]);
                    }
                  }}
                  className="accent-[#FFCC00]"
                />
                Multi-step sequence (drip) — send several messages over time
              </label>
            )}
            {/* A/B test toggle (any single-message rule) */}
            {!sequenceMode && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAbTest}
                  onChange={(e) => {
                    setUseAbTest(e.target.checked);
                    if (e.target.checked) setUseSequence(false);
                  }}
                  className="accent-[#FFCC00]"
                />
                A/B test — send two versions and compare which books more
              </label>
            )}
          </div>

          {/* A reward rule has no message at all — skip the whole composer. */}
          {!composesMessage ? null : sequenceMode ? (
            /* Sequence steps editor */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">Sequence steps</label>
                <span className="text-xs text-gray-500">Sent in order, each after its wait</span>
              </div>
              {steps.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-700 bg-[#0D0D0D] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FFCC00]">Step {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {/* A1: each step chooses its own action — this is what makes a sequence a
                          workflow rather than a drip. Campaigns stay message-only. */}
                      {isWorkflow && (
                        <select
                          value={s.actionType || "send_message"}
                          onChange={(e) => updateStep(i, { actionType: e.target.value })}
                          className="px-2 py-1 text-xs bg-[#1A1A1A] border border-gray-700 rounded text-gray-200 focus:border-[#FFCC00] focus:outline-none"
                        >
                          <option value="send_message">Send a message</option>
                          <option value="issue_reward">Issue RCN</option>
                          <option value="notify_staff">Notify my team</option>
                        </select>
                      )}
                      {(s.actionType || "send_message") === "send_message" && (
                        <button
                          type="button"
                          onClick={() => generateStep(i)}
                          disabled={generatingStep === i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50"
                        >
                          {generatingStep === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          AI
                        </button>
                      )}
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} className="text-gray-500 hover:text-red-400" aria-label="Remove step">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {s.actionType === "issue_reward" ? (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Amount (RCN)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Number(s.actionPayload?.amountRcn) || 25}
                        onChange={(e) =>
                          updateStep(i, { actionPayload: { amountRcn: Number(e.target.value) } })
                        }
                        className="w-32 px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFCC00] focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Debited from your RCN balance when this step runs.</p>
                    </div>
                  ) : s.actionType === "notify_staff" ? (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Alert your team (optional)</label>
                      <input
                        type="text"
                        value={String(s.actionPayload?.message ?? "")}
                        onChange={(e) => updateStep(i, { actionPayload: { message: e.target.value } })}
                        placeholder="e.g. Follow up with this customer today"
                        maxLength={500}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Goes to you, not the customer. Leave blank to use the workflow name.
                      </p>
                    </div>
                  ) : (
                  <textarea
                    value={s.messageTemplate || ""}
                    onChange={(e) => updateStep(i, { messageTemplate: e.target.value })}
                    placeholder="Hi {{customerName}}! ..."
                    rows={3}
                    maxLength={2000}
                    className="w-full px-3 py-2 bg-[#111] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
                  />
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>Wait</span>
                    <input
                      type="number"
                      min={0}
                      value={s.delayHours}
                      onChange={(e) => updateStep(i, { delayHours: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-20 px-2 py-1 bg-[#111] border border-gray-700 rounded text-white focus:border-[#FFCC00] focus:outline-none"
                    />
                    <span>hours {i === 0 ? "after the trigger" : "after the previous step"}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add step
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={stopOnBooking} onChange={(e) => setStopOnBooking(e.target.checked)} className="accent-[#FFCC00]" />
                Stop the sequence if the customer books
              </label>
              <p className="text-xs text-gray-500">
                Available placeholders: {TEMPLATE_VARIABLES.map((v) => v.key).join(", ")}
              </p>
            </div>
          ) : (
            /* Single Message Template (= Variant A when A/B is on) */
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-400">{abMode ? "Message — Variant A" : "Message Template"}</label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  title="Let AI draft this message from the trigger + audience above"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hi {{customerName}}! ..."
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">{messageTemplate.length}/2000</p>
              </div>
              {/* Variable Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="px-2 py-1 text-xs bg-[#0D0D0D] border border-gray-700 rounded text-gray-400 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* A/B Variant B editor + results (single-message A/B rules) */}
          {abMode && (
            <div className="space-y-2 rounded-lg border border-gray-700 bg-[#0D0D0D] p-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">Message — Variant B</label>
                <button
                  type="button"
                  onClick={generateB}
                  disabled={generatingB}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50"
                >
                  {generatingB ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {generatingB ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              <textarea
                value={variantB}
                onChange={(e) => setVariantB(e.target.value)}
                placeholder="A different angle from Variant A…"
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 bg-[#111] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
              />
              <p className="text-xs text-gray-500">{variantB.length}/2000 · Each send is split 50/50 between A and B.</p>
              {abResults && abResults.results.length > 0 && (
                <div className="mt-1 border-t border-gray-800 pt-2">
                  <p className="text-xs text-gray-400 mb-1">Results so far (booked within 7 days of send):</p>
                  {abResults.results.map((r) => (
                    <div key={r.variant} className="flex justify-between text-xs text-gray-300">
                      <span>Variant {r.variant}</span>
                      <span>
                        {r.sends} sent · {r.conversions} booked ({r.sends ? Math.round((r.conversions / r.sends) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-500 mt-1">An indicator, not proof — bookings may have other causes.</p>
                </div>
              )}
            </div>
          )}

          {/* Preview (single-message mode only; the sequence editor shows each step inline).
              Gated on needsRuleMessage, not just on there being text: switching a rule to a reward or a
              staff alert hides the message EDITOR but left this behind, so the form previewed a customer
              message for an action that sends none — and handleSubmit then discards that text
              (messageTemplate: null). It read as "this is what will be sent". */}
          {needsRuleMessage && !sequenceMode && messageTemplate.trim() && (
            <div className="p-3 bg-[#0D0D0D] border border-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Preview (sample data):</p>
              <p className="text-sm text-white">{resolvePreview(messageTemplate)}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[#0D0D0D] border border-gray-700 rounded-lg text-gray-300 text-sm hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            // Only a SINGLE-MESSAGE rule needs the rule-level template. This condition predates
            // actions and sequences: it disabled the button for every drip sequence (the copy lives in
            // the steps), every reward rule, every staff alert and every shop-scoped rule — six of the
            // ten templates — with no explanation of why. handleSubmit already validates per action
            // type and explains what's missing, so anything beyond "needs a name" belongs there, not
            // in a silent disable.
            disabled={saving || !name.trim() || (needsRuleMessage && !messageTemplate.trim())}
            className="flex-1 px-4 py-2.5 bg-[#FFCC00] rounded-lg text-black text-sm font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving
              ? "Saving..."
              : isWorkflow
              ? isEditing ? "Update Workflow" : "Create Workflow"
              : isEditing ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>

      {/* Rendered as a sibling of this modal, not inside the form — it is a Radix Dialog and portals
          to document.body regardless, and nesting a <form> inside another would submit the wrong one. */}
      {campaignEditor && (
        <CampaignBuilderModal
          open
          shopId={shopProfile?.shopId || ""}
          shopName={shopProfile?.name}
          campaignType={campaignEditor.campaign?.campaignType || "custom"}
          existingCampaign={campaignEditor.campaign}
          viewOnly={campaignEditor.mode === "view"}
          // Opened from a workflow: the workflow decides who and when, so the designer is content only.
          designOnly
          onClose={(saved, campaign) => {
            setCampaignEditor(null);
            if (!saved) return;
            // Select whatever was just written, so creating one from here leaves it chosen rather
            // than making the owner find it in a list they just left. The row comes back from the
            // editor: picking "the newest" instead would be a guess, and wrong if another tab saved.
            if (campaign) {
              setCampaigns((prev) => {
                const without = prev.filter((c) => c.id !== campaign.id);
                return [campaign, ...without];
              });
              setCampaignId(campaign.id);
            } else {
              // Saved without telling us which — refetch rather than show a stale summary.
              setCampaignsLoaded(false);
            }
          }}
        />
      )}
    </div>
  );
};
