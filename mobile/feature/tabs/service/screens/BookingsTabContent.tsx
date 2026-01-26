import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { MyAppointment } from "@/shared/interfaces/appointment.interface";
import { FilterButton } from "@/components/shared/FilterButton";
import { FilterModal } from "@/components/shared/FilterModal";
import { useBookingsTab } from "../hooks";
import { TIME_FILTERS, STATUS_FILTERS } from "../constants";
import { BookingFilterTab, BookingStatusFilter } from "../types";
import { AppointmentCard, CancelModal, BookingsEmptyState } from "../components";

export default function BookingsTabContent() {
  const {
    filteredAppointments,
    isLoading,
    error,
    refreshing,
    activeTab,
    setActiveTab,
    showTimeFilter,
    setShowTimeFilter,
    currentTimeLabel,
    activeStatus,
    setActiveStatus,
    showStatusFilter,
    setShowStatusFilter,
    currentStatusLabel,
    cancelModalVisible,
    selectedAppointment,
    closeCancelModal,
    handleConfirmCancel,
    isCancelPending,
    handleRefresh,
    handleAppointmentPress,
    handleCancelPress,
    handleReviewPress,
    refetch,
  } = useBookingsTab();

  const renderAppointment = ({ item }: { item: MyAppointment }) => (
    <AppointmentCard
      appointment={item}
      onPress={() => handleAppointmentPress(item)}
      onCancel={() => handleCancelPress(item)}
      onReview={() => handleReviewPress(item)}
    />
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

  return (
    <View className="flex-1">
      {/* Filter Buttons */}
      <View className="flex-row gap-3 mb-4">
        <FilterButton
          icon="calendar-outline"
          label={currentTimeLabel}
          onPress={() => setShowTimeFilter(true)}
        />
        <FilterButton
          icon="filter-outline"
          label={currentStatusLabel}
          onPress={() => setShowStatusFilter(true)}
        />
      </View>

      {/* Filter Modals */}
      <FilterModal
        title="Time Period"
        icon="calendar-outline"
        options={TIME_FILTERS}
        selectedKey={activeTab}
        onSelect={(key) => setActiveTab(key as BookingFilterTab)}
        visible={showTimeFilter}
        onClose={() => setShowTimeFilter(false)}
      />

      <FilterModal
        title="Status"
        icon="filter-outline"
        options={STATUS_FILTERS}
        selectedKey={activeStatus}
        onSelect={(key) => setActiveStatus(key as BookingStatusFilter)}
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
        ListEmptyComponent={<BookingsEmptyState filterTab={activeTab} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Cancel Confirmation Modal */}
      <CancelModal
        visible={cancelModalVisible}
        appointment={selectedAppointment}
        isPending={isCancelPending}
        onClose={closeCancelModal}
        onConfirm={handleConfirmCancel}
      />
    </View>
  );
}
