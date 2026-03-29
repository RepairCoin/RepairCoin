import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { BookingStatus } from "@/shared/interfaces/booking.interfaces";

const TIMELINE_STEPS = [
  { key: "pending", label: "Booking Created", desc: "Waiting for payment", icon: "clock" as keyof typeof Feather.glyphMap, color: "#FFCC00" },
  { key: "paid", label: "Payment Received", desc: "Awaiting shop approval", icon: "credit-card" as keyof typeof Feather.glyphMap, color: "#FFCC00" },
  { key: "in_progress", label: "Shop Approved", desc: "Service confirmed", icon: "check" as keyof typeof Feather.glyphMap, color: "#22c55e" },
  { key: "scheduled", label: "Scheduled", desc: "Appointment time set", icon: "calendar" as keyof typeof Feather.glyphMap, color: "#3b82f6" },
  { key: "completed", label: "Completed", desc: "Service done, RCN issued", icon: "check-circle" as keyof typeof Feather.glyphMap, color: "#22c55e" },
];

function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface BookingTimelineProps {
  currentStatus: BookingStatus;
  shopApproved?: boolean;
  bookingDate?: string | null;
  completedAt?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}

export default function BookingTimeline({
  currentStatus,
  shopApproved,
  bookingDate,
  completedAt,
  approvedAt,
  createdAt,
}: BookingTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const isCancelled = currentStatus === "cancelled" || currentStatus === "refunded";
  const isCompleted = currentStatus === "completed";
  const isApprovedOrScheduled = currentStatus === "paid" && shopApproved;

  const getStepState = (index: number): "done" | "active" | "upcoming" => {
    if (isCancelled) return index === 0 ? "done" : "upcoming";
    if (isCompleted) return "done";
    if (isApprovedOrScheduled) return index <= 3 ? "done" : "upcoming";
    if (currentStatus === "paid" && !shopApproved) {
      if (index < 1) return "done";
      if (index === 1) return "active";
      return "upcoming";
    }
    if (index === 0) return "active";
    return "upcoming";
  };

  const getCurrentStepIndex = (): number => {
    if (isCancelled) return -1;
    if (isCompleted) return 4;
    if (isApprovedOrScheduled) return 3;
    if (currentStatus === "paid") return 1;
    return 0;
  };
  const currentStepIndex = getCurrentStepIndex();

  const getTimestamp = (stepKey: string): string | null => {
    if (stepKey === "pending" && createdAt)
      return formatTime(createdAt) + " · " + formatDate(createdAt);
    if (stepKey === "paid" && createdAt && currentStepIndex >= 1)
      return formatDate(createdAt);
    if (stepKey === "in_progress" && approvedAt)
      return formatDate(approvedAt);
    if (stepKey === "scheduled" && bookingDate)
      return formatDate(bookingDate) + " at " + formatTime(bookingDate);
    if (stepKey === "completed" && completedAt)
      return formatDate(completedAt);
    return null;
  };

  const currentStep = isCancelled
    ? {
        label: currentStatus === "cancelled" ? "Cancelled" : "Refunded",
        color: "#ef4444",
        icon: "x-circle" as keyof typeof Feather.glyphMap,
      }
    : TIMELINE_STEPS[currentStepIndex] || TIMELINE_STEPS[0];

  const completedCount = TIMELINE_STEPS.filter(
    (_, i) => getStepState(i) === "done"
  ).length;

  const getSubtitle = (): string => {
    if (isCancelled) return "This booking has been cancelled";
    if (isCompleted) return "Service completed successfully";
    if (isApprovedOrScheduled) return "Ready for service";
    if (currentStatus === "paid") return "Waiting for shop to approve";
    return "Waiting for customer payment";
  };

  return (
    <View className="bg-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Accordion Header */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        className="p-4 flex-row items-center"
      >
        <View
          className="items-center justify-center mr-3"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: currentStep.color + "20",
          }}
        >
          <Feather name={currentStep.icon} size={18} color={currentStep.color} />
        </View>

        <View className="flex-1">
          <Text className="text-white text-sm font-semibold">
            {currentStep.label}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            {getSubtitle()}
          </Text>
          <View className="flex-row items-center mt-2">
            <View className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${(completedCount / TIMELINE_STEPS.length) * 100}%`,
                  backgroundColor: isCancelled ? "#ef4444" : currentStep.color,
                }}
              />
            </View>
          </View>
        </View>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#666"
        />
      </TouchableOpacity>

      {/* Expanded Timeline */}
      {expanded && (
        <View className="px-4 pb-4">
          <View className="h-px bg-gray-800 mb-4" />

          {isCancelled && (
            <View className="flex-row items-center bg-red-500/10 rounded-lg p-3 mb-4">
              <Feather name="x-circle" size={16} color="#ef4444" />
              <Text className="text-red-400 text-sm font-medium ml-2">
                {currentStatus === "cancelled"
                  ? "Booking was cancelled"
                  : "Payment was refunded"}
              </Text>
            </View>
          )}

          {TIMELINE_STEPS.map((step, index) => {
            const state = getStepState(index);
            const isLast = index === TIMELINE_STEPS.length - 1;
            const timestamp = getTimestamp(step.key);

            return (
              <View key={step.key} className="flex-row">
                <View className="items-center mr-3" style={{ width: 32 }}>
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor:
                        state !== "upcoming" ? step.color : "#262626",
                      borderWidth: state === "active" ? 2.5 : 0,
                      borderColor:
                        state === "active"
                          ? step.color + "40"
                          : "transparent",
                    }}
                  >
                    {state === "done" ? (
                      <Feather name="check" size={14} color="#000" />
                    ) : (
                      <Feather
                        name={step.icon}
                        size={14}
                        color={state === "active" ? "#000" : "#555"}
                      />
                    )}
                  </View>

                  {!isLast && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 20,
                        backgroundColor:
                          getStepState(index + 1) !== "upcoming"
                            ? TIMELINE_STEPS[index + 1].color + "50"
                            : "#262626",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>

                <View
                  className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}
                  style={{ paddingTop: 4 }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      state === "upcoming" ? "text-gray-600" : "text-white"
                    }`}
                  >
                    {step.label}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 ${
                      state === "upcoming" ? "text-gray-700" : "text-gray-500"
                    }`}
                  >
                    {step.desc}
                  </Text>
                  {timestamp && state !== "upcoming" && (
                    <Text className="text-[10px] text-gray-600 mt-1">
                      {timestamp}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
