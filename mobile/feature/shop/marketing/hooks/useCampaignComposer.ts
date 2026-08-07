import { useMemo, useState } from "react";
import { useAppToast } from "@/shared/hooks";
import { useSubmitGuard } from "@/shared/hooks/useSubmitGuard";
import {
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useSendCampaignMutation,
  useScheduleCampaignMutation,
} from "./useCampaignMutations";
import { useAudienceCountQuery } from "./useMarketingQueries";
import {
  blankDesignContent,
  fromTemplate,
  toEditableFields,
  applyEdits,
  DesignContent,
  EditableField,
} from "../utils/designContent";
import { SEND_NOW_MAX_RECIPIENTS } from "../constants/marketingConstants";
import {
  CampaignAudienceType,
  CampaignDeliveryMethod,
  CampaignType,
  MarketingCampaign,
  MarketingTemplate,
} from "../services/marketing.interface";

export type ComposerStep = 1 | 2 | 3 | 4 | 5;

interface UseCampaignComposerOptions {
  /** Present when editing a draft/scheduled campaign (`?campaignId=` on the composer route). */
  existingCampaign?: MarketingCampaign | null;
}

/**
 * 5-step wizard state machine: template → content → audience → delivery → review. Manual
 * useState + validateStep() → showError, per useCreatePromoCode.ts — the shop-feature convention.
 * RHF+zod is auth-only and fits this state (block-edit map, a Set of addresses, a Date) poorly.
 */
export function useCampaignComposer(options: UseCampaignComposerOptions = {}) {
  const existingCampaign = options.existingCampaign ?? null;
  const { showError, showWarning } = useAppToast();
  const { guard, reset: resetGuard } = useSubmitGuard();

  const [step, setStep] = useState<ComposerStep>(1);
  const [campaignType, setCampaignType] = useState<CampaignType>(existingCampaign?.campaignType ?? "custom");
  const [templateId, setTemplateId] = useState<string | undefined>(existingCampaign?.templateId ?? undefined);
  const [name, setName] = useState(existingCampaign?.name ?? "");
  const [subject, setSubject] = useState(existingCampaign?.subject ?? "");
  const [previewText, setPreviewText] = useState(existingCampaign?.previewText ?? "");
  const [design, setDesign] = useState<DesignContent>(
    (existingCampaign?.designContent as DesignContent | undefined) ?? blankDesignContent()
  );
  // Index-keyed — see utils/designContent.ts. Cleared whenever a new template/blank is applied.
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [audienceType, setAudienceType] = useState<CampaignAudienceType>(
    existingCampaign?.audienceType ?? "all_customers"
  );
  const [audienceFilters, setAudienceFilters] = useState<Record<string, any>>(
    existingCampaign?.audienceFilters ?? {}
  );
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
    () =>
      new Set<string>(
        Array.isArray(existingCampaign?.audienceFilters?.selectedAddresses)
          ? existingCampaign!.audienceFilters.selectedAddresses.map((a: string) => a.toLowerCase())
          : []
      )
  );
  const [deliveryMethod, setDeliveryMethod] = useState<CampaignDeliveryMethod>(
    existingCampaign?.deliveryMethod ?? "email"
  );
  // Explicit "schedule for later" pick (ScheduleSheet). Distinct from the send-now/threshold
  // routing below, which auto-schedules at now+60s purely because the audience is large.
  const [scheduleDate, setScheduleDate] = useState<Date | null>(
    existingCampaign?.scheduledAt ? new Date(existingCampaign.scheduledAt) : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useCreateCampaignMutation();
  const updateMutation = useUpdateCampaignMutation();
  const sendMutation = useSendCampaignMutation();
  const scheduleMutation = useScheduleCampaignMutation();

  const editableFields: EditableField[] = useMemo(() => toEditableFields(design), [design]);

  function applyTemplate(template: MarketingTemplate) {
    setTemplateId(template.id);
    setDesign(fromTemplate(template));
    setEdits({});
  }

  function useBlankDesign() {
    setTemplateId(undefined);
    setDesign(blankDesignContent());
    setEdits({});
  }

  function setFieldEdit(index: number, value: string) {
    setEdits((prev) => ({ ...prev, [index]: value }));
  }

  function toggleSelectedAddress(address: string) {
    const key = address.toLowerCase();
    setSelectedAddresses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildAudienceFilters(): Record<string, any> {
    const filters = { ...audienceFilters };
    if (audienceType === "select_customers") {
      filters.selectedAddresses = Array.from(selectedAddresses);
    } else {
      delete filters.selectedAddresses;
    }
    return filters;
  }

  // Live count for the threshold decision at submit — not needed for 'select_customers', where
  // selectedAddresses.size is already known with no round trip.
  const resolvedAudienceFilters = useMemo(buildAudienceFilters, [audienceType, audienceFilters, selectedAddresses]);
  const audienceCountQuery = useAudienceCountQuery(
    audienceType,
    resolvedAudienceFilters,
    deliveryMethod,
    audienceType !== "select_customers"
  );

  function validateStep(target: ComposerStep): boolean {
    // Bug fix (Stage 2): each block must gate LEAVING the step that owns these fields, not
    // arriving at it — name/subject are entered ON step 2, so gating at target>=2 fired while
    // step 2's own UI hadn't been shown yet, permanently deadlocking goToStep(2) from step 1
    // (nextStep() -> goToStep(2) -> validateStep(2) -> "Campaign name is required" -> no-op).
    // Same for audience fields, entered on step 3. Final-submit validation (validateStep(5))
    // still covers every field regardless of this shift.
    if (target >= 3) {
      if (!name.trim()) {
        showError("Campaign name is required");
        return false;
      }
      if (deliveryMethod !== "in_app" && !subject.trim()) {
        showError("Subject is required for email campaigns");
        return false;
      }
    }
    if (target >= 4) {
      if (audienceType === "select_customers" && selectedAddresses.size === 0) {
        showError("Select at least one customer");
        return false;
      }
      if (audienceType === "custom" && !audienceFilters.lapsedDays) {
        showError("Choose how long since their last visit");
        return false;
      }
      if (scheduleDate && scheduleDate.getTime() <= Date.now()) {
        showError("Scheduled time must be in the future");
        return false;
      }
    }
    return true;
  }

  function goToStep(target: ComposerStep) {
    if (target > step && !validateStep(target)) return;
    setStep(target);
  }

  function nextStep() {
    goToStep((Math.min(step + 1, 5) as ComposerStep));
  }

  function prevStep() {
    setStep((Math.max(step - 1, 1) as ComposerStep));
  }

  function buildPayload() {
    return {
      name: name.trim(),
      campaignType,
      subject: subject.trim() || undefined,
      previewText: previewText.trim() || undefined,
      designContent: applyEdits(design, edits),
      templateId,
      audienceType,
      audienceFilters: buildAudienceFilters(),
      deliveryMethod,
    };
  }

  /**
   * Create (or update) then chain send/schedule on the returned id. If create/update itself fails,
   * the mutation's own onError already toasted it and this returns undefined. If create/update
   * SUCCEEDS but the send/schedule step fails, that is NOT reported as total failure — the send
   * error is toasted and the created/updated campaign is returned so the caller can still navigate
   * to its detail screen.
   */
  async function doSubmit(): Promise<MarketingCampaign | undefined> {
    if (!validateStep(5)) {
      resetGuard();
      return undefined;
    }

    setIsSubmitting(true);

    let campaign: MarketingCampaign;
    try {
      const payload = buildPayload();
      if (existingCampaign) {
        const res = await updateMutation.mutateAsync({ campaignId: existingCampaign.id, data: payload });
        campaign = res.data;
      } else {
        const res = await createMutation.mutateAsync(payload);
        campaign = res.data;
      }
    } catch {
      // The mutation's own onError already toasted the create/update failure.
      setIsSubmitting(false);
      resetGuard();
      return undefined;
    }

    // Bug fix (Stage 2): rewards can debit real RCN and are read-only on mobile (see plan's
    // "Rewards — read-only, and fenced off"), but this chain unconditionally sent/scheduled
    // after every save — editing a reward-bearing draft would have silently sent it from
    // mobile, bypassing the web-only reward fence enforced everywhere else in this feature.
    if (existingCampaign && existingCampaign.rewardType !== "none") {
      setIsSubmitting(false);
      resetGuard();
      return campaign;
    }

    try {
      if (scheduleDate) {
        await scheduleMutation.mutateAsync({ campaignId: campaign.id, scheduledAt: scheduleDate.toISOString() });
      } else {
        const recipientCount =
          audienceType === "select_customers" ? selectedAddresses.size : audienceCountQuery.data ?? 0;

        if (recipientCount > SEND_NOW_MAX_RECIPIENTS) {
          // Threshold-routed: > SEND_NOW_MAX_RECIPIENTS goes through the scheduler at now+60s so
          // the existing every-minute cron sends it server-side — immune to the phone sleeping.
          await scheduleMutation.mutateAsync({
            campaignId: campaign.id,
            scheduledAt: new Date(Date.now() + 60 * 1000).toISOString(),
          });
        } else {
          await sendMutation.mutateAsync(campaign.id);
        }
      }
    } catch (err: any) {
      // useSendCampaignMutation's own onError already shows the "still sending" toast for
      // ECONNABORTED — don't double-toast here.
      if (err?.code !== "ECONNABORTED") {
        showWarning("Saved, but sending failed. You can send it from the campaign's detail screen.");
      }
    } finally {
      setIsSubmitting(false);
      resetGuard();
    }

    return campaign;
  }

  function submit(): Promise<MarketingCampaign | undefined> | undefined {
    return guard(() => doSubmit());
  }

  return {
    step,
    goToStep,
    nextStep,
    prevStep,
    validateStep,

    campaignType,
    setCampaignType,
    templateId,
    applyTemplate,
    useBlankDesign,

    name,
    setName,
    subject,
    setSubject,
    previewText,
    setPreviewText,

    design,
    editableFields,
    edits,
    setFieldEdit,

    audienceType,
    setAudienceType,
    audienceFilters,
    setAudienceFilters,
    selectedAddresses,
    toggleSelectedAddress,
    audienceCount: audienceType === "select_customers" ? selectedAddresses.size : audienceCountQuery.data,
    isAudienceCountLoading: audienceType !== "select_customers" && audienceCountQuery.isLoading,

    deliveryMethod,
    setDeliveryMethod,
    scheduleDate,
    setScheduleDate,

    isSubmitting,
    submit,
  };
}
