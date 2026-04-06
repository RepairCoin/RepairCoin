import { View, Text, ScrollView, Switch, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useNotificationPreferences } from "../hooks/ui/useNotificationPreferences";
import { goBack } from "expo-router/build/global-state/routing";

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

function ToggleRow({ icon, title, description, value, onToggle, disabled, comingSoon }: ToggleRowProps) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1 ml-3 mr-3">
        <View className="flex-row items-center">
          <Text className="text-white text-sm font-medium">{title}</Text>
          {comingSoon && (
            <View className="ml-2 px-2 py-0.5 bg-blue-500/20 rounded-full">
              <Text className="text-blue-400 text-[10px]">Soon</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-500 text-xs mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled || comingSoon}
        trackColor={{ false: "#3f3f46", true: "#FFCC00" }}
        thumbColor="#fff"
        style={{ opacity: disabled || comingSoon ? 0.5 : 1 }}
      />
    </View>
  );
}

function SectionDivider() {
  return <View className="h-px bg-zinc-800 ml-16" />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 mb-2 mt-6">
      {title}
    </Text>
  );
}

function SaveButton({ onPress, saving, label }: { onPress: () => void; saving: boolean; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={saving}
      className={`px-4 py-2 rounded-full ${saving ? "bg-yellow-500/50" : "bg-[#FFCC00]"}`}
      activeOpacity={0.7}
    >
      <Text className="text-black text-xs font-semibold">
        {saving ? "Saving..." : label}
      </Text>
    </TouchableOpacity>
  );
}

export default function NotificationPreferencesScreen() {
  const {
    loading,
    userType,
    appointmentForm,
    savingAppointment,
    toggleAppointment,
    setQuietHoursTime,
    saveAppointmentPreferences,
    generalForm,
    savingGeneral,
    toggleGeneral,
    saveGeneralPreferences,
  } = useNotificationPreferences();

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Notification Preferences" onBackPress={goBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Notification Preferences" onBackPress={goBack} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Appointment Reminders - Customer only */}
        {userType === "customer" && (
          <>
            <View className="flex-row items-center justify-between px-4 mt-4 mb-2">
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                Appointment Reminders
              </Text>
              <SaveButton
                onPress={saveAppointmentPreferences}
                saving={savingAppointment}
                label="Save"
              />
            </View>

            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              {/* Channels */}
              <ToggleRow
                icon={<Ionicons name="mail-outline" size={18} color="#FFCC00" />}
                title="Email Notifications"
                description="Receive reminders via email"
                value={appointmentForm.emailEnabled}
                onToggle={() => toggleAppointment("emailEnabled")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="notifications-outline" size={18} color="#FFCC00" />}
                title="In-App Notifications"
                description="See reminders in the app"
                value={appointmentForm.inAppEnabled}
                onToggle={() => toggleAppointment("inAppEnabled")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="phone-portrait-outline" size={18} color="#FFCC00" />}
                title="SMS Notifications"
                description="Receive text message reminders"
                value={appointmentForm.smsEnabled}
                onToggle={() => toggleAppointment("smsEnabled")}
                comingSoon
              />
            </View>

            {/* Reminder Timing */}
            <SectionHeader title="Reminder Timing" />
            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              <ToggleRow
                icon={<Ionicons name="time-outline" size={18} color="#FFCC00" />}
                title="24-Hour Reminder"
                description="One day before your appointment"
                value={appointmentForm.reminder24hEnabled}
                onToggle={() => toggleAppointment("reminder24hEnabled")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="time-outline" size={18} color="#FFCC00" />}
                title="2-Hour Reminder"
                description="Two hours before your appointment"
                value={appointmentForm.reminder2hEnabled}
                onToggle={() => toggleAppointment("reminder2hEnabled")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="time-outline" size={18} color="#FFCC00" />}
                title="30-Minute Reminder"
                description="Final reminder before appointment"
                value={appointmentForm.reminder30mEnabled}
                onToggle={() => toggleAppointment("reminder30mEnabled")}
                comingSoon
              />
            </View>

            {/* Quiet Hours */}
            <SectionHeader title="Quiet Hours" />
            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              <ToggleRow
                icon={<Ionicons name="moon-outline" size={18} color="#FFCC00" />}
                title="Enable Quiet Hours"
                description="Pause notifications during specific times"
                value={appointmentForm.quietHoursEnabled}
                onToggle={() => toggleAppointment("quietHoursEnabled")}
              />
              {appointmentForm.quietHoursEnabled && (
                <View className="flex-row px-4 pb-4 pt-1 gap-4">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs mb-1.5">From</Text>
                    <View className="bg-zinc-800 rounded-lg px-3 py-2.5">
                      <Text className="text-white text-sm">
                        {appointmentForm.quietHoursStart}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs mb-1.5">To</Text>
                    <View className="bg-zinc-800 rounded-lg px-3 py-2.5">
                      <Text className="text-white text-sm">
                        {appointmentForm.quietHoursEnd}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* General Notification Preferences */}
        <View className="flex-row items-center justify-between px-4 mt-6 mb-2">
          <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
            General Preferences
          </Text>
          <SaveButton
            onPress={saveGeneralPreferences}
            saving={savingGeneral}
            label="Save"
          />
        </View>

        {/* Platform Updates */}
        <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
          <ToggleRow
            icon={<Ionicons name="megaphone-outline" size={18} color="#FFCC00" />}
            title="Platform Updates"
            description="Important updates about FixFlow"
            value={generalForm.platformUpdates}
            onToggle={() => toggleGeneral("platformUpdates")}
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="warning-outline" size={18} color="#FFCC00" />}
            title="Maintenance Alerts"
            description="Scheduled maintenance and downtime"
            value={generalForm.maintenanceAlerts}
            onToggle={() => toggleGeneral("maintenanceAlerts")}
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="sparkles-outline" size={18} color="#FFCC00" />}
            title="New Features"
            description="Get notified about new features"
            value={generalForm.newFeatures}
            onToggle={() => toggleGeneral("newFeatures")}
          />
        </View>

        {/* Account & Security */}
        <SectionHeader title="Account & Security" />
        <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
          <ToggleRow
            icon={<Ionicons name="shield-checkmark-outline" size={18} color="#FFCC00" />}
            title="Security Alerts"
            description="Critical security notifications"
            value={generalForm.securityAlerts}
            onToggle={() => toggleGeneral("securityAlerts")}
            disabled
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="log-in-outline" size={18} color="#FFCC00" />}
            title="Login Notifications"
            description="When someone logs into your account"
            value={generalForm.loginNotifications}
            onToggle={() => toggleGeneral("loginNotifications")}
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="key-outline" size={18} color="#FFCC00" />}
            title="Password Changes"
            description="Alerts when your password changes"
            value={generalForm.passwordChanges}
            onToggle={() => toggleGeneral("passwordChanges")}
          />
        </View>

        {/* Customer-specific: Tokens & Rewards */}
        {userType === "customer" && (
          <>
            <SectionHeader title="Tokens & Rewards" />
            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              <ToggleRow
                icon={<Ionicons name="wallet-outline" size={18} color="#FFCC00" />}
                title="Tokens Received"
                description="When you earn RCN tokens"
                value={generalForm.tokenReceived}
                onToggle={() => toggleGeneral("tokenReceived")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="card-outline" size={18} color="#FFCC00" />}
                title="Tokens Redeemed"
                description="When you redeem tokens at shops"
                value={generalForm.tokenRedeemed}
                onToggle={() => toggleGeneral("tokenRedeemed")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="gift-outline" size={18} color="#FFCC00" />}
                title="Rewards & Bonuses"
                description="Special rewards and bonus opportunities"
                value={generalForm.rewardsEarned}
                onToggle={() => toggleGeneral("rewardsEarned")}
              />
            </View>

            <SectionHeader title="Orders & Services" />
            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              <ToggleRow
                icon={<Ionicons name="receipt-outline" size={18} color="#FFCC00" />}
                title="Order Updates"
                description="Status changes on your bookings"
                value={generalForm.orderUpdates}
                onToggle={() => toggleGeneral("orderUpdates")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFCC00" />}
                title="Service Approved"
                description="When shops approve your requests"
                value={generalForm.serviceApproved}
                onToggle={() => toggleGeneral("serviceApproved")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="chatbubble-outline" size={18} color="#FFCC00" />}
                title="Review Requests"
                description="Reminders to review completed services"
                value={generalForm.reviewRequests}
                onToggle={() => toggleGeneral("reviewRequests")}
              />
            </View>
          </>
        )}

        {/* Shop-specific: Operations */}
        {userType === "shop" && (
          <>
            <SectionHeader title="Shop Operations" />
            <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
              <ToggleRow
                icon={<Ionicons name="bag-handle-outline" size={18} color="#FFCC00" />}
                title="New Orders"
                description="When customers book your services"
                value={generalForm.newOrders}
                onToggle={() => toggleGeneral("newOrders")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="chatbubbles-outline" size={18} color="#FFCC00" />}
                title="Customer Messages"
                description="Direct messages from customers"
                value={generalForm.customerMessages}
                onToggle={() => toggleGeneral("customerMessages")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="wallet-outline" size={18} color="#FFCC00" />}
                title="Low Token Balance"
                description="Alert when RCN balance is running low"
                value={generalForm.lowTokenBalance}
                onToggle={() => toggleGeneral("lowTokenBalance")}
              />
              <SectionDivider />
              <ToggleRow
                icon={<Ionicons name="card-outline" size={18} color="#FFCC00" />}
                title="Subscription Reminders"
                description="Upcoming renewals and payments"
                value={generalForm.subscriptionReminders}
                onToggle={() => toggleGeneral("subscriptionReminders")}
              />
            </View>
          </>
        )}

        {/* Marketing - All users */}
        <SectionHeader title="Marketing & Promotions" />
        <View className="bg-zinc-900 rounded-2xl overflow-hidden mx-4">
          <ToggleRow
            icon={<Ionicons name="pricetag-outline" size={18} color="#FFCC00" />}
            title="Promotions & Offers"
            description="Special deals and limited-time offers"
            value={generalForm.promotions}
            onToggle={() => toggleGeneral("promotions")}
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="newspaper-outline" size={18} color="#FFCC00" />}
            title="Newsletter"
            description="Monthly newsletter with updates"
            value={generalForm.newsletter}
            onToggle={() => toggleGeneral("newsletter")}
          />
          <SectionDivider />
          <ToggleRow
            icon={<Ionicons name="clipboard-outline" size={18} color="#FFCC00" />}
            title="Surveys & Feedback"
            description="Help us improve with your feedback"
            value={generalForm.surveys}
            onToggle={() => toggleGeneral("surveys")}
          />
        </View>

        {/* Notification Channels Info */}
        <SectionHeader title="Notification Channels" />
        <View className="mx-4 flex-row gap-2">
          <View className="flex-1 bg-zinc-900 rounded-xl p-3 flex-row items-center gap-2">
            <Ionicons name="mail" size={16} color="#FFCC00" />
            <View>
              <Text className="text-white text-xs font-medium">Email</Text>
              <Text className="text-gray-500 text-[10px]">Primary</Text>
            </View>
          </View>
          <View className="flex-1 bg-zinc-900 rounded-xl p-3 flex-row items-center gap-2">
            <Ionicons name="notifications" size={16} color="#FFCC00" />
            <View>
              <Text className="text-white text-xs font-medium">In-App</Text>
              <Text className="text-gray-500 text-[10px]">Real-time</Text>
            </View>
          </View>
          <View className="flex-1 bg-zinc-900 rounded-xl p-3 flex-row items-center gap-2 opacity-50">
            <Ionicons name="phone-portrait" size={16} color="#666" />
            <View>
              <Text className="text-gray-400 text-xs font-medium">SMS</Text>
              <Text className="text-gray-600 text-[10px]">Soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
