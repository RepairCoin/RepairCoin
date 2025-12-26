import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
  Modal,
  Alert,
} from "react-native";
import React, { useMemo, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAppointment } from "@/hooks/appointment/useAppointment";
import { MyAppointment } from "@/interfaces/appointment.interface";
import { router } from "expo-router";

type FilterTab = "upcoming" | "past" | "all";
type StatusFilter = "all" | "pending" | "paid" | "completed" | "cancelled";

// Calculate date range: 30 days ago to 90 days in the future
const getDateRange = () => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
};

const getStatusConfig = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending":
      return {
        bgColor: "bg-yellow-500/20",
        textColor: "text-yellow-500",
        icon: "time-outline" as const,
      };
    case "paid":
    case "confirmed":
      return {
        bgColor: "bg-blue-500/20",
        textColor: "text-blue-500",
        icon: "checkmark-circle-outline" as const,
      };
    case "completed":
      return {
        bgColor: "bg-green-500/20",
        textColor: "text-green-500",
        icon: "checkmark-done-outline" as const,
      };
    case "cancelled":
      return {
        bgColor: "bg-red-500/20",
        textColor: "text-red-500",
        icon: "close-circle-outline" as const,
      };
    default:
      return {
        bgColor: "bg-gray-500/20",
        textColor: "text-gray-500",
        icon: "ellipse-outline" as const,
      };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    date: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }),
    year: date.getFullYear(),
  };
};

const formatTime = (timeString: string | null) => {
  if (!timeString) return "TBD";
  // Handle both "HH:mm" and "HH:mm:ss" formats
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

interface AppointmentCardProps {
  appointment: MyAppointment;
  onPress: () => void;
  onCancel: () => void;
}

// Check if appointment can be cancelled (24+ hours before + not already cancelled/completed)
const canCancelAppointment = (appointment: MyAppointment) => {
  const now = new Date();
  const bookingDateTime = new Date(appointment.bookingDate);

  // If there's a time slot, include it in the calculation
  if (appointment.bookingTimeSlot) {
    const [hours, minutes] = appointment.bookingTimeSlot.split(":");
    bookingDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }

  // Calculate hours until appointment
  const hoursUntilAppointment = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const status = appointment.status.toLowerCase();
  const isCancellable = status === "pending" || status === "confirmed" || status === "paid";
  const isMoreThan24Hours = hoursUntilAppointment >= 24;

  return isCancellable && isMoreThan24Hours;
};

function AppointmentCard({ appointment, onPress, onCancel }: AppointmentCardProps) {
  const statusConfig = getStatusConfig(appointment.status);
  const dateInfo = formatDate(appointment.bookingDate);
  const isUpcoming = new Date(appointment.bookingDate) >= new Date();
  const showCancelButton = canCancelAppointment(appointment);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-zinc-900 rounded-2xl mb-3 overflow-hidden"
    >
      <View className="flex-row">
        {/* Date Column */}
        <View
          className={`w-20 items-center justify-center py-4 ${isUpcoming ? "bg-[#FFCC00]" : "bg-zinc-800"}`}
        >
          <Text
            className={`text-xs font-medium ${isUpcoming ? "text-black/60" : "text-gray-400"}`}
          >
            {dateInfo.day}
          </Text>
          <Text
            className={`text-2xl font-bold ${isUpcoming ? "text-black" : "text-white"}`}
          >
            {dateInfo.date}
          </Text>
          <Text
            className={`text-xs font-medium ${isUpcoming ? "text-black/60" : "text-gray-400"}`}
          >
            {dateInfo.month}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 p-4">
          {/* Status Badge */}
          <View className="flex-row items-center justify-between mb-2">
            <View
              className={`flex-row items-center px-2 py-1 rounded-full ${statusConfig.bgColor}`}
            >
              <Ionicons
                name={statusConfig.icon}
                size={12}
                color={
                  statusConfig.textColor === "text-yellow-500"
                    ? "#EAB308"
                    : statusConfig.textColor === "text-blue-500"
                      ? "#3B82F6"
                      : statusConfig.textColor === "text-green-500"
                        ? "#22C55E"
                        : statusConfig.textColor === "text-red-500"
                          ? "#EF4444"
                          : "#6B7280"
                }
              />
              <Text
                className={`text-xs font-medium ml-1 capitalize ${statusConfig.textColor}`}
              >
                {appointment.status}
              </Text>
            </View>
            <Text className="text-[#FFCC00] font-bold">
              ${appointment.totalAmount}
            </Text>
          </View>

          {/* Service Name */}
          <Text className="text-white text-base font-semibold mb-1" numberOfLines={1}>
            {appointment.serviceName}
          </Text>

          {/* Time */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#FFCC00" />
            <Text className="text-white text-sm ml-1">
              {formatTime(appointment.bookingTimeSlot)}
              {appointment.bookingEndTime &&
                ` - ${formatTime(appointment.bookingEndTime)}`}
            </Text>
          </View>

          {/* Cancel Button */}
          {showCancelButton && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="mt-3 flex-row items-center justify-center py-2 rounded-lg bg-red-500/20"
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text className="text-red-500 text-sm font-medium ml-1">
                Cancel Appointment
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Service Image */}
        {appointment.serviceImage && (
          <View className="w-24 h-full">
            <Image
              source={{ uri: appointment.serviceImage }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const TIME_FILTERS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All Status", color: "#FFCC00" },
  { key: "pending", label: "Pending", color: "#EAB308" },
  { key: "paid", label: "Paid", color: "#3B82F6" },
  { key: "completed", label: "Completed", color: "#22C55E" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
];

function FilterModal({
  title,
  icon,
  options,
  selectedKey,
  onSelect,
  visible,
  onClose,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  options: { key: string; label: string; color?: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/60 justify-end"
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <View className="flex-row items-center">
                <Ionicons name={icon} size={20} color="#FFCC00" />
                <Text className="text-white text-lg font-semibold ml-2">{title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="px-4 py-3">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  className={`flex-row items-center justify-between px-4 py-4 rounded-xl mb-2 ${
                    selectedKey === option.key ? "bg-zinc-800" : ""
                  }`}
                >
                  <View className="flex-row items-center">
                    {option.color && (
                      <View
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <Text
                      className={`text-base ${
                        selectedKey === option.key ? "text-[#FFCC00] font-semibold" : "text-gray-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {selectedKey === option.key && (
                    <Ionicons name="checkmark-circle" size={22} color="#FFCC00" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Bottom safe area */}
            <View className="h-8" />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function BookingsTab() {
  const { useMyAppointmentsQuery, useCancelAppointmentMutation } = useAppointment();
  const { startDate, endDate } = getDateRange();

  const {
    data: appointmentData,
    isLoading,
    error,
    refetch,
  } = useMyAppointmentsQuery(startDate, endDate);

  const cancelMutation = useCancelAppointmentMutation();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<MyAppointment | null>(null);

  // Filter and sort appointments
  const filteredAppointments = useMemo(() => {
    if (!appointmentData) {
      return [];
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = appointmentData.filter(
      (apt) => new Date(apt.bookingDate) >= now
    );
    const past = appointmentData.filter(
      (apt) => new Date(apt.bookingDate) < now
    );

    // Sort upcoming by date ascending, past by date descending
    upcoming.sort(
      (a, b) =>
        new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );

    let filtered: MyAppointment[];
    switch (activeTab) {
      case "upcoming":
        filtered = upcoming;
        break;
      case "past":
        filtered = past;
        break;
      default:
        filtered = [...upcoming, ...past];
    }

    // Apply status filter
    if (activeStatus !== "all") {
      filtered = filtered.filter(
        (apt) => apt.status.toLowerCase() === activeStatus
      );
    }

    return filtered;
  }, [appointmentData, activeTab, activeStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAppointmentPress = (appointment: MyAppointment) => {
    router.push(`/customer/service/${appointment.serviceId}`);
  };

  const handleCancelPress = (appointment: MyAppointment) => {
    setSelectedAppointment(appointment);
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedAppointment) return;

    cancelMutation.mutate(selectedAppointment.orderId, {
      onSuccess: () => {
        setCancelModalVisible(false);
        setSelectedAppointment(null);
        Alert.alert("Success", "Your appointment has been cancelled.");
      },
      onError: (error: any) => {
        Alert.alert(
          "Error",
          error?.message || "Failed to cancel appointment. Please try again."
        );
      },
    });
  };

  const renderAppointment = ({ item }: { item: MyAppointment }) => (
    <AppointmentCard
      appointment={item}
      onPress={() => handleAppointmentPress(item)}
      onCancel={() => handleCancelPress(item)}
    />
  );

  const EmptyComponent = () => (
    <View className="flex-1 justify-center items-center pt-20">
      <View className="bg-zinc-900 rounded-full p-6 mb-4">
        <Ionicons name="calendar-outline" size={48} color="#FFCC00" />
      </View>
      <Text className="text-white text-lg font-semibold mt-2">
        {activeTab === "upcoming"
          ? "No upcoming appointments"
          : activeTab === "past"
            ? "No past appointments"
            : "No appointments yet"}
      </Text>
      <Text className="text-gray-500 text-sm text-center mt-2 px-8">
        {activeTab === "upcoming"
          ? "Book a service to see your appointments here"
          : "Your appointment history will appear here"}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading appointments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center px-4">
        <View className="bg-red-500/20 rounded-full p-4 mb-4">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        </View>
        <Text className="text-white text-lg font-semibold">
          Failed to load appointments
        </Text>
        <Text className="text-gray-500 text-sm text-center mt-2">
          Please check your connection and try again
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 bg-[#FFCC00] px-6 py-3 rounded-xl"
        >
          <Text className="text-black font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get current filter labels
  const currentTimeLabel = TIME_FILTERS.find(f => f.key === activeTab)?.label || "Upcoming";
  const currentStatusLabel = STATUS_FILTERS.find(f => f.key === activeStatus)?.label || "All Status";

  return (
    <View className="flex-1">
      {/* Filter Buttons */}
      <View className="flex-row gap-3 mb-4">
        <TouchableOpacity
          onPress={() => setShowTimeFilter(true)}
          className="flex-1 flex-row items-center justify-between bg-zinc-900 rounded-xl px-3 py-3"
        >
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={18} color="#FFCC00" />
            <Text className="text-white text-sm font-medium ml-2">{currentTimeLabel}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowStatusFilter(true)}
          className="flex-1 flex-row items-center justify-between bg-zinc-900 rounded-xl px-3 py-3"
        >
          <View className="flex-row items-center">
            <Ionicons name="filter-outline" size={18} color="#FFCC00" />
            <Text className="text-white text-sm font-medium ml-2">{currentStatusLabel}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Filter Modals */}
      <FilterModal
        title="Time Period"
        icon="calendar-outline"
        options={TIME_FILTERS}
        selectedKey={activeTab}
        onSelect={(key) => setActiveTab(key as FilterTab)}
        visible={showTimeFilter}
        onClose={() => setShowTimeFilter(false)}
      />

      <FilterModal
        title="Status"
        icon="filter-outline"
        options={STATUS_FILTERS}
        selectedKey={activeStatus}
        onSelect={(key) => setActiveStatus(key as StatusFilter)}
        visible={showStatusFilter}
        onClose={() => setShowStatusFilter(false)}
      />

      {/* Appointments List */}
      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.orderId}
        renderItem={renderAppointment}
        contentContainerStyle={{
          paddingBottom: 100,
          flexGrow: filteredAppointments.length === 0 ? 1 : undefined,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        ListEmptyComponent={EmptyComponent}
        showsVerticalScrollIndicator={false}
      />

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-6">
          <View className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm">
            {/* Icon */}
            <View className="items-center mb-4">
              <View className="bg-red-500/20 rounded-full p-4">
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              </View>
            </View>

            {/* Title */}
            <Text className="text-white text-xl font-bold text-center mb-2">
              Cancel Appointment?
            </Text>

            {/* Description */}
            <Text className="text-gray-400 text-center mb-2">
              Are you sure you want to cancel your appointment for{" "}
              <Text className="text-white font-semibold">
                {selectedAppointment?.serviceName}
              </Text>
              ?
            </Text>

            {/* Policy Note */}
            <View className="flex-row items-center justify-center mb-4">
              <Ionicons name="information-circle-outline" size={14} color="#FFCC00" />
              <Text className="text-yellow-500 text-xs ml-1">
                Cancellation is only available 24+ hours before the appointment
              </Text>
            </View>

            {/* Appointment Details */}
            {selectedAppointment && (
              <View className="bg-zinc-800 rounded-xl p-3 mb-6">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  <Text className="text-gray-300 text-sm ml-2">
                    {formatDate(selectedAppointment.bookingDate).month}{" "}
                    {formatDate(selectedAppointment.bookingDate).date},{" "}
                    {formatDate(selectedAppointment.bookingDate).year}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                  <Text className="text-gray-300 text-sm ml-2">
                    {formatTime(selectedAppointment.bookingTimeSlot)}
                    {selectedAppointment.bookingEndTime &&
                      ` - ${formatTime(selectedAppointment.bookingEndTime)}`}
                  </Text>
                </View>
              </View>
            )}

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setSelectedAppointment(null);
                }}
                className="flex-1 py-3 rounded-xl bg-zinc-800"
                disabled={cancelMutation.isPending}
              >
                <Text className="text-white text-center font-semibold">
                  Keep It
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500"
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold">
                    Yes, Cancel
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
