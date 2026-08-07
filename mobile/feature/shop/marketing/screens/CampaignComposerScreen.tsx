import { useLayoutEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import FormInput from "@/shared/components/ui/FormInput";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import CalloutCard from "@/shared/components/ui/CalloutCard";
import {
  TemplatePickerSheet,
  BlockEditorList,
  AudiencePicker,
  DeliveryMethodPicker,
  ScheduleSheet,
} from "../components";
import { useCampaignComposer, ComposerStep } from "../hooks/useCampaignComposer";
import { useCampaignQuery } from "../hooks";
import {
  AUDIENCE_OPTIONS,
  DELIVERY_METHOD_OPTIONS,
  SEND_NOW_MAX_RECIPIENTS,
} from "../constants/marketingConstants";
import { MarketingCampaign } from "../services/marketing.interface";

const STEP_TITLES: Record<ComposerStep, string> = {
  1: "Start your campaign",
  2: "Write your message",
  3: "Choose your audience",
  4: "Delivery method",
  5: "Review & send",
};

export function CampaignComposerScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();

  if (!campaignId) {
    return <CampaignComposerForm />;
  }

  return <EditCampaignLoader campaignId={campaignId} />;
}

function EditCampaignLoader({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading, isError, refetch } = useCampaignQuery(campaignId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#FFCC00" />
      </View>
    );
  }

  if (isError || !campaign) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-white text-base mt-3 text-center">{"Couldn't load this campaign."}</Text>
        <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-[#FFCC00] rounded-xl px-6 py-3">
          <Text className="text-black font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Keyed by id so the composer's internal useState initializers (seeded from existingCampaign
  // at mount time) never carry over if the user somehow navigates between two edit sessions.
  return <CampaignComposerForm key={campaign.id} existingCampaign={campaign} />;
}

function CampaignComposerForm({ existingCampaign }: { existingCampaign?: MarketingCampaign }) {
  const isEdit = !!existingCampaign;
  const composer = useCampaignComposer({ existingCampaign });
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);

  // Step 1 (template-or-blank) is skipped in edit mode — jump straight to content.
  useLayoutEffect(() => {
    if (isEdit) composer.goToStep(2);
  }, []);

  if (isEdit && composer.step === 1) return null;

  // Rewards can debit real RCN and are configured on web only — see useCampaignComposer's
  // reward fence. Saving is still allowed; the send/schedule chain is skipped for these.
  const hasReward = isEdit && existingCampaign!.rewardType !== "none";

  function handleBack() {
    if (composer.step <= (isEdit ? 2 : 1)) {
      const isDirty = composer.name.trim().length > 0 || composer.subject.trim().length > 0;
      if (isDirty) {
        Alert.alert("Discard campaign?", "Your changes will be lost.", [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]);
        return;
      }
      router.back();
      return;
    }
    composer.prevStep();
  }

  async function handleSubmit() {
    const campaign = await composer.submit();
    if (!campaign) return;

    const willAutoSend = !hasReward && !composer.scheduleDate;
    const largeAudience = (composer.audienceCount ?? 0) > SEND_NOW_MAX_RECIPIENTS;
    router.replace(
      `/shop/marketing/campaign/${campaign.id}${willAutoSend && largeAudience ? "?poll=1" : ""}` as never
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-zinc-950">
      <View className="pt-14 px-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={handleBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-base font-bold">{STEP_TITLES[composer.step]}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <View className="h-1 bg-[#FFCC00] rounded-full" style={{ width: `${(composer.step / 5) * 100}%` }} />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {composer.step === 1 && (
          <View>
            <TouchableOpacity
              onPress={() => setShowTemplateSheet(true)}
              className="bg-[#1A1A1A] border border-[#222] rounded-2xl p-5 mb-3 flex-row items-center"
            >
              <Ionicons name="albums-outline" size={22} color="#FFCC00" />
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">Start from a template</Text>
                <Text className="text-gray-400 text-xs mt-0.5">Coupons, announcements, and more</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                composer.useBlankDesign();
                composer.nextStep();
              }}
              className="bg-[#1A1A1A] border border-[#222] rounded-2xl p-5 flex-row items-center"
            >
              <Ionicons name="document-outline" size={22} color="#FFCC00" />
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">Start from blank</Text>
                <Text className="text-gray-400 text-xs mt-0.5">A simple headline and message</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            <TemplatePickerSheet
              visible={showTemplateSheet}
              onClose={() => setShowTemplateSheet(false)}
              onSelectTemplate={(template) => {
                composer.applyTemplate(template);
                setShowTemplateSheet(false);
                composer.nextStep();
              }}
              onSelectBlank={() => {
                composer.useBlankDesign();
                setShowTemplateSheet(false);
                composer.nextStep();
              }}
            />
          </View>
        )}

        {composer.step === 2 && (
          <View>
            <FormInput
              label="Campaign name"
              value={composer.name}
              onChangeText={composer.setName}
              placeholder="e.g. Spring Offer"
            />
            {composer.deliveryMethod !== "in_app" && (
              <FormInput
                label="Subject"
                value={composer.subject}
                onChangeText={composer.setSubject}
                placeholder="Email subject line"
              />
            )}
            <FormInput
              label="Preview text (optional)"
              value={composer.previewText}
              onChangeText={composer.setPreviewText}
              placeholder="Shown next to the subject in the inbox"
            />
            <BlockEditorList
              design={composer.design}
              editableFields={composer.editableFields}
              edits={composer.edits}
              onChangeField={composer.setFieldEdit}
            />
          </View>
        )}

        {composer.step === 3 && (
          <AudiencePicker
            audienceType={composer.audienceType}
            onChangeAudienceType={composer.setAudienceType}
            audienceFilters={composer.audienceFilters}
            onChangeAudienceFilters={composer.setAudienceFilters}
            selectedAddresses={composer.selectedAddresses}
            onToggleSelectedAddress={composer.toggleSelectedAddress}
            audienceCount={composer.audienceCount}
            isAudienceCountLoading={composer.isAudienceCountLoading}
          />
        )}

        {composer.step === 4 && (
          <DeliveryMethodPicker value={composer.deliveryMethod} onChange={composer.setDeliveryMethod} />
        )}

        {composer.step === 5 && (
          <View>
            <View className="bg-[#1A1A1A] rounded-2xl border border-[#222] p-4 mb-4">
              <ReviewRow label="Name" value={composer.name} />
              <ReviewRow
                label="Audience"
                value={AUDIENCE_OPTIONS.find((o) => o.value === composer.audienceType)?.label ?? ""}
              />
              <ReviewRow
                label="Delivery"
                value={DELIVERY_METHOD_OPTIONS.find((o) => o.value === composer.deliveryMethod)?.label ?? ""}
              />
              <ReviewRow
                label="When"
                value={composer.scheduleDate ? composer.scheduleDate.toLocaleString() : "Right away"}
                last
              />
            </View>

            {hasReward ? (
              <CalloutCard
                tone="warning"
                icon="gift-outline"
                title="Reward configured"
                description="This campaign issues a reward. Save your changes here, then send it from the web dashboard."
                className="mb-4"
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowScheduleSheet(true)}
                className="flex-row items-center justify-between bg-zinc-900 rounded-xl px-4 py-3.5 mb-4"
              >
                <Text className="text-white text-sm">
                  {composer.scheduleDate
                    ? `Scheduled for ${composer.scheduleDate.toLocaleString()}`
                    : "Send right away"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#FFCC00" />
              </TouchableOpacity>
            )}

            {!hasReward && !composer.scheduleDate && (composer.audienceCount ?? 0) > SEND_NOW_MAX_RECIPIENTS && (
              <CalloutCard
                tone="info"
                icon="information-circle-outline"
                title="Large audience"
                description="This will be queued and sent within a minute, so it keeps sending even if you close the app."
                className="mb-4"
              />
            )}

            <PrimaryButton
              title={
                hasReward
                  ? "Save changes"
                  : composer.scheduleDate
                  ? "Save & Schedule"
                  : (composer.audienceCount ?? 0) > SEND_NOW_MAX_RECIPIENTS
                  ? "Save & Send (starts within a minute)"
                  : "Save & Send"
              }
              onPress={handleSubmit}
              loading={composer.isSubmitting}
            />

            {!hasReward && (
              <ScheduleSheet
                visible={showScheduleSheet}
                onClose={() => setShowScheduleSheet(false)}
                value={composer.scheduleDate}
                onChange={composer.setScheduleDate}
              />
            )}
          </View>
        )}
      </ScrollView>

      {composer.step < 5 && (
        <View className="px-4 pb-6 pt-2 border-t border-[#222]">
          <PrimaryButton title="Continue" onPress={composer.nextStep} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between py-2.5 ${last ? "" : "border-b border-[#222]"}`}>
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium flex-1 text-right ml-4" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
