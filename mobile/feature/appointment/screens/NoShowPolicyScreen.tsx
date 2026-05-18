import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import {
  NoShowPolicy,
  noShowPolicyApi,
} from "../services/noShowPolicy.services";

const DEFAULT_POLICY: Omit<NoShowPolicy, "shopId"> = {
  enabled: true,
  cautionThreshold: 2,
  cautionAdvanceBookingHours: 24,
  depositThreshold: 4,
  depositAmount: 20,
  depositAdvanceBookingHours: 48,
  depositResetAfterSuccessful: 3,
  maxRcnRedemptionPercent: 50,
  suspensionThreshold: 6,
  suspensionDurationDays: 30,
  gracePeriodMinutes: 15,
  autoDetectionEnabled: true,
  autoDetectionDelayHours: 2,
  minimumCancellationHours: 24,
  sendEmailTier1: true,
  sendEmailTier2: true,
  sendEmailTier3: true,
  sendEmailTier4: true,
  sendSmsTier2: false,
  sendSmsTier3: false,
  sendSmsTier4: false,
  sendPushNotifications: true,
  allowDisputes: true,
  disputeWindowDays: 7,
  autoApproveFirstOffense: true,
  requireShopReview: false,
};

export default function NoShowPolicyScreen() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";
  const { showSuccess, showError } = useAppToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [policy, setPolicy] = useState<NoShowPolicy | null>(null);
  const [originalPolicy, setOriginalPolicy] = useState<string>("");

  const loadPolicy = useCallback(async () => {
    if (!shopId) return;
    try {
      const fetched = await noShowPolicyApi.getShopPolicy(shopId);
      setPolicy(fetched);
      setOriginalPolicy(JSON.stringify(fetched));
    } catch {
      // Use defaults on error
      const defaults = { ...DEFAULT_POLICY, shopId } as NoShowPolicy;
      setPolicy(defaults);
      setOriginalPolicy(JSON.stringify(defaults));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  // Track changes
  useEffect(() => {
    if (!policy) return;
    setHasChanges(JSON.stringify(policy) !== originalPolicy);
  }, [policy, originalPolicy]);

  const update = <K extends keyof NoShowPolicy>(
    field: K,
    value: NoShowPolicy[K]
  ) => {
    if (!policy) return;
    setPolicy({ ...policy, [field]: value });
  };

  const handleSave = async () => {
    if (!policy || !shopId) return;
    setSaving(true);
    try {
      const updated = await noShowPolicyApi.updateShopPolicy(shopId, policy);
      setPolicy(updated);
      setOriginalPolicy(JSON.stringify(updated));
      setHasChanges(false);
      showSuccess("Policy saved");
    } catch {
      showError("Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalPolicy) return;
    setPolicy(JSON.parse(originalPolicy));
    setHasChanges(false);
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPolicy();
  }, [loadPolicy]);

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (!policy) return null;

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 px-4 pb-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">No-Show Policy</Text>
        <View className="w-9" />
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        {/* Enable/Disable */}
        <Section>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <Ionicons name="shield-checkmark" size={22} color="#FFCC00" />
              <View className="ml-3">
                <Text className="text-white font-semibold text-base">
                  Enable No-Show Tracking
                </Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  Turn on/off the no-show penalty system
                </Text>
              </View>
            </View>
            <Switch
              value={policy.enabled}
              onValueChange={(v) => update("enabled", v)}
              trackColor={{ false: "#333", true: "#FFCC00" }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        {/* Penalty Tiers */}
        <SectionHeader icon="layers-outline" title="Penalty Tiers" />
        <Section>
          <NumberField
            label="Tier 2 (Caution) Threshold"
            value={policy.cautionThreshold}
            onChange={(v) => update("cautionThreshold", v)}
            suffix="no-shows"
            helper="No-shows before reaching Caution tier"
          />
          <NumberField
            label="Tier 2 Advance Booking"
            value={policy.cautionAdvanceBookingHours}
            onChange={(v) => update("cautionAdvanceBookingHours", v)}
            suffix="hours"
            helper="Min hours in advance to book at Tier 2"
          />
          <NumberField
            label="Tier 3 (Deposit) Threshold"
            value={policy.depositThreshold}
            onChange={(v) => update("depositThreshold", v)}
            suffix="no-shows"
            helper="No-shows before deposit is required"
          />
          <NumberField
            label="Deposit Amount"
            value={policy.depositAmount}
            onChange={(v) => update("depositAmount", v)}
            prefix="$"
            suffix="USD"
            helper="Refundable deposit for Tier 3 customers"
          />
          <NumberField
            label="Tier 3 Advance Booking"
            value={policy.depositAdvanceBookingHours}
            onChange={(v) => update("depositAdvanceBookingHours", v)}
            suffix="hours"
            helper="Min hours in advance to book at Tier 3"
          />
          <NumberField
            label="Recovery Appointments"
            value={policy.depositResetAfterSuccessful}
            onChange={(v) => update("depositResetAfterSuccessful", v)}
            suffix="appts"
            helper="Successful appointments to downgrade from Tier 3"
          />
          <NumberField
            label="Max RCN Redemption"
            value={policy.maxRcnRedemptionPercent}
            onChange={(v) => update("maxRcnRedemptionPercent", v)}
            suffix="%"
            helper="Max % redeemable with RCN at Tiers 2-3"
          />
          <NumberField
            label="Tier 4 (Suspension) Threshold"
            value={policy.suspensionThreshold}
            onChange={(v) => update("suspensionThreshold", v)}
            suffix="no-shows"
            helper="No-shows before customer is suspended"
          />
          <NumberField
            label="Suspension Duration"
            value={policy.suspensionDurationDays}
            onChange={(v) => update("suspensionDurationDays", v)}
            suffix="days"
            helper="How long suspension lasts"
            last
          />
        </Section>

        {/* Timing & Detection */}
        <SectionHeader icon="time-outline" title="Timing & Detection" />
        <Section>
          <NumberField
            label="Grace Period"
            value={policy.gracePeriodMinutes}
            onChange={(v) => update("gracePeriodMinutes", v)}
            suffix="min"
            helper="Minutes late before it's a no-show"
          />
          <NumberField
            label="Min Cancellation Notice"
            value={policy.minimumCancellationHours}
            onChange={(v) => update("minimumCancellationHours", v)}
            suffix="hours"
            helper="Min hours before appointment to cancel"
          />
          <ToggleField
            label="Auto-Detection"
            value={policy.autoDetectionEnabled}
            onChange={(v) => update("autoDetectionEnabled", v)}
            helper="Automatically mark no-shows"
          />
          {policy.autoDetectionEnabled && (
            <NumberField
              label="Auto-Detection Delay"
              value={policy.autoDetectionDelayHours}
              onChange={(v) => update("autoDetectionDelayHours", v)}
              suffix="hours"
              helper="Wait time after appointment before auto-marking"
              last
            />
          )}
        </Section>

        {/* Notifications */}
        <SectionHeader icon="notifications-outline" title="Notifications" />
        <Section>
          <Text className="text-gray-400 text-xs mb-3">
            Email Notifications
          </Text>
          <ToggleField
            label="Tier 1 (Warning)"
            value={policy.sendEmailTier1}
            onChange={(v) => update("sendEmailTier1", v)}
          />
          <ToggleField
            label="Tier 2 (Caution)"
            value={policy.sendEmailTier2}
            onChange={(v) => update("sendEmailTier2", v)}
          />
          <ToggleField
            label="Tier 3 (Deposit)"
            value={policy.sendEmailTier3}
            onChange={(v) => update("sendEmailTier3", v)}
          />
          <ToggleField
            label="Tier 4 (Suspended)"
            value={policy.sendEmailTier4}
            onChange={(v) => update("sendEmailTier4", v)}
          />
          <View className="h-3" />
          <ToggleField
            label="Push Notifications"
            value={policy.sendPushNotifications}
            onChange={(v) => update("sendPushNotifications", v)}
            helper="Real-time in-app notifications"
            last
          />
        </Section>

        {/* Disputes */}
        <SectionHeader icon="chatbubbles-outline" title="Dispute Settings" />
        <Section>
          <ToggleField
            label="Allow Disputes"
            value={policy.allowDisputes}
            onChange={(v) => update("allowDisputes", v)}
            helper="Let customers dispute no-show marks"
          />
          {policy.allowDisputes && (
            <>
              <NumberField
                label="Dispute Window"
                value={policy.disputeWindowDays}
                onChange={(v) => update("disputeWindowDays", v)}
                suffix="days"
                helper="Days after no-show to submit dispute"
              />
              <ToggleField
                label="Auto-Approve First Offense"
                value={policy.autoApproveFirstOffense}
                onChange={(v) => update("autoApproveFirstOffense", v)}
                helper="Auto-approve disputes for 1st no-show"
              />
              <ToggleField
                label="Require Shop Review"
                value={policy.requireShopReview}
                onChange={(v) => update("requireShopReview", v)}
                helper="All disputes need manual approval"
                last
              />
            </>
          )}
        </Section>
      </ScrollView>

      {/* Floating Save Bar */}
      {hasChanges && (
        <View className="absolute bottom-0 left-0 right-0 bg-[#121212] border-t border-zinc-800 px-4 py-4 pb-8">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleReset}
              className="flex-1 border border-zinc-700 rounded-xl py-3.5 items-center"
            >
              <Text className="text-gray-400 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-[#FFCC00] rounded-xl py-3.5 items-center"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text className="text-black font-bold">Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ==================== Sub-Components ====================

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">{children}</View>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View className="flex-row items-center mb-2 mt-2">
      <Ionicons name={icon} size={18} color="#FFCC00" />
      <Text className="text-white font-semibold text-base ml-2">{title}</Text>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  prefix,
  helper,
  last = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  helper?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`py-3 ${!last ? "border-b border-zinc-800/50" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-white text-sm">{label}</Text>
          {helper && (
            <Text className="text-gray-600 text-xs mt-0.5">{helper}</Text>
          )}
        </View>
        <View className="flex-row items-center bg-[#2a2a2c] rounded-lg px-2">
          {prefix && (
            <Text className="text-gray-400 text-sm mr-1">{prefix}</Text>
          )}
          <TextInput
            className="h-10 text-white text-sm w-12 text-center"
            value={String(value)}
            onChangeText={(t) => {
              const num = parseInt(t) || 0;
              onChange(num);
            }}
            keyboardType="number-pad"
          />
          {suffix && (
            <Text className="text-gray-500 text-xs ml-1">{suffix}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  helper,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  helper?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${
        !last ? "border-b border-zinc-800/50" : ""
      }`}
    >
      <View className="flex-1 mr-3">
        <Text className="text-white text-sm">{label}</Text>
        {helper && (
          <Text className="text-gray-600 text-xs mt-0.5">{helper}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#333", true: "#FFCC00" }}
        thumbColor="#fff"
      />
    </View>
  );
}
