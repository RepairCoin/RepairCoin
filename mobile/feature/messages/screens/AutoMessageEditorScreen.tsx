import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { messageApi } from "../services/message.services";
import {
  AutoMessageTriggerType,
  AutoMessageScheduleType,
  AutoMessageEventType,
  AutoMessageTargetAudience,
  CreateAutoMessageRequest,
} from "@/shared/interfaces/message.interface";

const TRIGGER_OPTIONS: { value: AutoMessageTriggerType; label: string; icon: string }[] = [
  { value: "schedule", label: "Scheduled", icon: "calendar" },
  { value: "event", label: "Event-based", icon: "flash" },
];

const SCHEDULE_OPTIONS: { value: AutoMessageScheduleType; label: string }[] = [
  { value: "daily", label: "Every Day" },
  { value: "weekly", label: "Every Week" },
  { value: "monthly", label: "Every Month" },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const EVENT_OPTIONS: { value: AutoMessageEventType; label: string; description: string }[] = [
  { value: "booking_completed", label: "Booking Completed", description: "When a service is marked complete" },
  { value: "booking_cancelled", label: "Booking Cancelled", description: "When a booking is cancelled" },
  { value: "first_visit", label: "First Visit", description: "Customer's first transaction" },
  { value: "inactive_30_days", label: "Inactive 30 Days", description: "No activity for 30 days" },
];

const TARGET_OPTIONS: { value: AutoMessageTargetAudience; label: string }[] = [
  { value: "all", label: "All Customers" },
  { value: "active", label: "Active Customers" },
  { value: "inactive_30d", label: "Inactive 30+ Days" },
  { value: "has_balance", label: "Has RCN Balance" },
  { value: "completed_booking", label: "Completed a Booking" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i % 12 || 12}:00 ${i >= 12 ? "PM" : "AM"}`,
}));

const TEMPLATE_VARIABLES = [
  "{{customer_name}}",
  "{{shop_name}}",
  "{{balance}}",
];

export default function AutoMessageEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<AutoMessageTriggerType>("schedule");
  const [scheduleType, setScheduleType] = useState<AutoMessageScheduleType>("weekly");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1); // Monday
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleHour, setScheduleHour] = useState(10); // 10 AM
  const [eventType, setEventType] = useState<AutoMessageEventType>("booking_completed");
  const [delayHours, setDelayHours] = useState(0);
  const [targetAudience, setTargetAudience] = useState<AutoMessageTargetAudience>("all");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [maxSendsPerCustomer, setMaxSendsPerCustomer] = useState(1);

  // Fetch existing auto-message if editing
  const { data: existingData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["auto-message", id],
    queryFn: async () => {
      const response = await messageApi.getAutoMessages();
      return response.data.find((m) => m.id === id);
    },
    enabled: isEditing,
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingData) {
      setName(existingData.name);
      setTriggerType(existingData.triggerType);
      setScheduleType(existingData.scheduleType || "weekly");
      setScheduleDayOfWeek(existingData.scheduleDayOfWeek ?? 1);
      setScheduleDayOfMonth(existingData.scheduleDayOfMonth ?? 1);
      setScheduleHour(existingData.scheduleHour ?? 10);
      setEventType(existingData.eventType || "booking_completed");
      setDelayHours(existingData.delayHours ?? 0);
      setTargetAudience(existingData.targetAudience);
      setMessageTemplate(existingData.messageTemplate);
      setMaxSendsPerCustomer(existingData.maxSendsPerCustomer ?? 1);
    }
  }, [existingData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateAutoMessageRequest) => messageApi.createAutoMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-messages"] });
      router.back();
    },
    onError: () => {
      Alert.alert("Error", "Failed to create auto-message");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateAutoMessageRequest) =>
      messageApi.updateAutoMessage(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-messages"] });
      router.back();
    },
    onError: () => {
      Alert.alert("Error", "Failed to update auto-message");
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const canSave = name.trim() && messageTemplate.trim() && !isLoading;

  const handleSave = () => {
    if (!canSave) return;

    const data: CreateAutoMessageRequest = {
      name: name.trim(),
      triggerType,
      messageTemplate: messageTemplate.trim(),
      targetAudience,
      maxSendsPerCustomer,
    };

    if (triggerType === "schedule") {
      data.scheduleType = scheduleType;
      data.scheduleHour = scheduleHour;
      if (scheduleType === "weekly") {
        data.scheduleDayOfWeek = scheduleDayOfWeek;
      } else if (scheduleType === "monthly") {
        data.scheduleDayOfMonth = scheduleDayOfMonth;
      }
    } else {
      data.eventType = eventType;
      data.delayHours = delayHours;
    }

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => prev + variable);
  };

  if (isEditing && isLoadingExisting) {
    return (
      <ThemedView className="flex-1">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <AppHeader title={isEditing ? "Edit Auto-Message" : "New Auto-Message"} />

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Rule Name */}
        <View className="mt-4 mb-6">
          <Text className="text-gray-400 text-sm mb-2">Rule Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="E.g., Weekly Promo"
            placeholderTextColor="#6B7280"
            className="bg-zinc-800 rounded-xl px-4 py-3 text-white border border-zinc-700"
            editable={!isLoading}
          />
        </View>

        {/* Trigger Type */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-2">Trigger Type</Text>
          <View className="flex-row gap-3">
            {TRIGGER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setTriggerType(option.value)}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border ${
                  triggerType === option.value
                    ? "bg-[#FFCC00]/10 border-[#FFCC00]"
                    : "bg-zinc-800 border-zinc-700"
                }`}
              >
                <Ionicons
                  name={option.icon as any}
                  size={18}
                  color={triggerType === option.value ? "#FFCC00" : "#9CA3AF"}
                />
                <Text
                  className={`ml-2 font-medium ${
                    triggerType === option.value ? "text-[#FFCC00]" : "text-gray-400"
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Schedule Options */}
        {triggerType === "schedule" && (
          <>
            {/* Schedule Type */}
            <View className="mb-4">
              <Text className="text-gray-400 text-sm mb-2">Frequency</Text>
              <View className="flex-row gap-2">
                {SCHEDULE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setScheduleType(option.value)}
                    className={`flex-1 py-2.5 rounded-lg items-center ${
                      scheduleType === option.value
                        ? "bg-[#FFCC00]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <Text
                      className={`font-medium ${
                        scheduleType === option.value ? "text-black" : "text-gray-400"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Day of Week (for weekly) */}
            {scheduleType === "weekly" && (
              <View className="mb-4">
                <Text className="text-gray-400 text-sm mb-2">Day of Week</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <TouchableOpacity
                        key={day.value}
                        onPress={() => setScheduleDayOfWeek(day.value)}
                        className={`px-4 py-2 rounded-lg ${
                          scheduleDayOfWeek === day.value
                            ? "bg-[#FFCC00]"
                            : "bg-zinc-800"
                        }`}
                      >
                        <Text
                          className={`${
                            scheduleDayOfWeek === day.value
                              ? "text-black font-medium"
                              : "text-gray-400"
                          }`}
                        >
                          {day.label.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Day of Month (for monthly) */}
            {scheduleType === "monthly" && (
              <View className="mb-4">
                <Text className="text-gray-400 text-sm mb-2">Day of Month</Text>
                <View className="bg-zinc-800 rounded-xl px-4 py-3 flex-row items-center justify-between">
                  <Text className="text-white">Day {scheduleDayOfMonth}</Text>
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => setScheduleDayOfMonth(Math.max(1, scheduleDayOfMonth - 1))}
                      className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2"
                    >
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setScheduleDayOfMonth(Math.min(28, scheduleDayOfMonth + 1))}
                      className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center"
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Time */}
            <View className="mb-6">
              <Text className="text-gray-400 text-sm mb-2">Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {HOUR_OPTIONS.filter((_, i) => i % 2 === 0).map((hour) => (
                    <TouchableOpacity
                      key={hour.value}
                      onPress={() => setScheduleHour(hour.value)}
                      className={`px-3 py-2 rounded-lg ${
                        scheduleHour === hour.value
                          ? "bg-[#FFCC00]"
                          : "bg-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          scheduleHour === hour.value
                            ? "text-black font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        {hour.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </>
        )}

        {/* Event Options */}
        {triggerType === "event" && (
          <>
            {/* Event Type */}
            <View className="mb-4">
              <Text className="text-gray-400 text-sm mb-2">Event Type</Text>
              {EVENT_OPTIONS.map((event) => (
                <TouchableOpacity
                  key={event.value}
                  onPress={() => setEventType(event.value)}
                  className={`p-4 rounded-xl mb-2 border ${
                    eventType === event.value
                      ? "bg-[#FFCC00]/10 border-[#FFCC00]"
                      : "bg-zinc-800 border-zinc-700"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      eventType === event.value ? "text-[#FFCC00]" : "text-white"
                    }`}
                  >
                    {event.label}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-1">
                    {event.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Delay */}
            <View className="mb-6">
              <Text className="text-gray-400 text-sm mb-2">
                Delay After Event (hours)
              </Text>
              <View className="bg-zinc-800 rounded-xl px-4 py-3 flex-row items-center justify-between">
                <Text className="text-white">
                  {delayHours === 0 ? "Send immediately" : `${delayHours} hour${delayHours !== 1 ? "s" : ""} delay`}
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => setDelayHours(Math.max(0, delayHours - 1))}
                    className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2"
                  >
                    <Ionicons name="remove" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDelayHours(Math.min(72, delayHours + 1))}
                    className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center"
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Target Audience */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-2">Target Audience</Text>
          <View className="flex-row flex-wrap gap-2">
            {TARGET_OPTIONS.map((target) => (
              <TouchableOpacity
                key={target.value}
                onPress={() => setTargetAudience(target.value)}
                className={`px-3 py-2 rounded-lg ${
                  targetAudience === target.value
                    ? "bg-[#FFCC00]"
                    : "bg-zinc-800"
                }`}
              >
                <Text
                  className={`${
                    targetAudience === target.value
                      ? "text-black font-medium"
                      : "text-gray-400"
                  }`}
                >
                  {target.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message Template */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-400 text-sm">Message</Text>
            <Text className="text-gray-500 text-xs">
              {messageTemplate.length}/500
            </Text>
          </View>
          <TextInput
            value={messageTemplate}
            onChangeText={setMessageTemplate}
            placeholder="Hi {{customer_name}}! Check out our latest..."
            placeholderTextColor="#6B7280"
            className="bg-zinc-800 rounded-xl px-4 py-3 text-white border border-zinc-700 min-h-[120px]"
            multiline
            textAlignVertical="top"
            maxLength={500}
            editable={!isLoading}
          />
        </View>

        {/* Template Variables */}
        <View className="mb-6">
          <Text className="text-gray-500 text-xs mb-2">Insert variable:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <TouchableOpacity
                  key={variable}
                  onPress={() => insertVariable(variable)}
                  className="bg-zinc-700 px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-[#FFCC00] text-sm">{variable}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Max Sends */}
        <View className="mb-8">
          <Text className="text-gray-400 text-sm mb-2">
            Max Sends Per Customer
          </Text>
          <View className="bg-zinc-800 rounded-xl px-4 py-3 flex-row items-center justify-between">
            <Text className="text-white">
              {maxSendsPerCustomer === 0 ? "Unlimited" : `${maxSendsPerCustomer} time${maxSendsPerCustomer !== 1 ? "s" : ""}`}
            </Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setMaxSendsPerCustomer(Math.max(0, maxSendsPerCustomer - 1))}
                className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2"
              >
                <Ionicons name="remove" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMaxSendsPerCustomer(Math.min(10, maxSendsPerCustomer + 1))}
                className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center"
              >
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <Text className="text-gray-600 text-xs mt-2">
            Set to 0 for unlimited sends
          </Text>
        </View>

        {/* Bottom Padding for button */}
        <View className="h-32" />
      </ScrollView>

      {/* Save Button */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-zinc-950">
        <PrimaryButton
          title={isEditing ? "Save Changes" : "Create Auto-Message"}
          onPress={handleSave}
          disabled={!canSave}
          loading={isLoading}
        />
      </View>
    </ThemedView>
  );
}
