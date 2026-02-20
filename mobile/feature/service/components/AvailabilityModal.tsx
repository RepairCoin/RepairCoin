import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Switch,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { TimeSlotConfig, DateOverride } from "@/shared/interfaces/appointment.interface";
import { PendingAvailabilityChanges } from "../types";
import { useAvailabilityModal } from "../hooks";
import { AVAILABILITY_TABS, FULL_DAYS, TIME_OPTIONS } from "../constants";

interface AvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (changes: PendingAvailabilityChanges) => void;
  shopId: string;
}

type TimeField = "openTime" | "closeTime" | "breakStartTime" | "breakEndTime";

export function AvailabilityModal({
  visible,
  onClose,
  onSave,
  shopId,
}: AvailabilityModalProps) {
  const {
    activeTab,
    setActiveTab,
    loading,
    availability,
    timeSlotConfig,
    dateOverrides,
    showTimePicker,
    editingField,
    openTimePicker,
    closeTimePicker,
    handleTimeSelect,
    handleToggleDay,
    handleUpdateConfig,
    handleAddOverride,
    handleDeleteOverride,
    handleDone,
    formatTime,
    getTimePickerInitialIndex,
    isTimeSelected,
  } = useAvailabilityModal({ visible, shopId, onSave, onClose });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-[#121212] rounded-t-3xl pt-4 pb-8 px-4 h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">
              Availability Settings
            </Text>
            <View className="w-10" />
          </View>

          {/* Tabs */}
          <View className="flex-row bg-[#1a1a1a] rounded-lg p-1 mb-4">
            {AVAILABILITY_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                className={`flex-1 py-2 rounded-md ${
                  activeTab === tab.value ? "bg-[#FFCC00]" : ""
                }`}
              >
                <Text
                  className={`text-center text-sm font-medium ${
                    activeTab === tab.value ? "text-black" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#FFCC00" />
            </View>
          ) : (
            <>
              {activeTab === "hours" && (
                <HoursTab
                  availability={availability}
                  timeSlotConfig={timeSlotConfig}
                  onToggleDay={handleToggleDay}
                  onOpenTimePicker={openTimePicker}
                  formatTime={formatTime}
                />
              )}
              {activeTab === "settings" && (
                <SettingsTab
                  timeSlotConfig={timeSlotConfig}
                  onUpdateConfig={handleUpdateConfig}
                />
              )}
              {activeTab === "overrides" && (
                <OverridesTab
                  overrides={dateOverrides}
                  onAddOverride={handleAddOverride}
                  onDeleteOverride={handleDeleteOverride}
                />
              )}
            </>
          )}

          {/* Done Button */}
          <TouchableOpacity
            onPress={handleDone}
            className="bg-[#FFCC00] rounded-xl py-4 mt-4"
          >
            <Text className="text-black text-center font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={showTimePicker}
        editingField={editingField}
        onClose={closeTimePicker}
        onSelectTime={handleTimeSelect}
        isTimeSelected={isTimeSelected}
        initialScrollIndex={getTimePickerInitialIndex()}
      />
    </Modal>
  );
}

// Hours Tab Component
interface HoursTabProps {
  availability: any[];
  timeSlotConfig: TimeSlotConfig | null;
  onToggleDay: (dayOfWeek: number, isOpen: boolean) => void;
  onOpenTimePicker: (dayOfWeek: number, field: TimeField) => void;
  formatTime: (time: string | null) => string;
}

function HoursTab({
  availability,
  timeSlotConfig,
  onToggleDay,
  onOpenTimePicker,
  formatTime,
}: HoursTabProps) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-gray-400 text-sm mb-4">
        Set your shop's operating hours for each day of the week. You can also set break times.
      </Text>
      {availability.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-gray-500">No availability data found</Text>
        </View>
      ) : (
        availability.map((day) => {
          const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
          const weekendBlocked = isWeekend && !timeSlotConfig?.allowWeekendBooking;

          return (
            <View
              key={day.dayOfWeek}
              className={`bg-[#1a1a1a] rounded-xl p-4 mb-3 ${weekendBlocked ? "opacity-60" : ""}`}
            >
              {/* Weekend Warning */}
              {weekendBlocked && day.isOpen && (
                <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-3 flex-row items-center">
                  <Ionicons name="warning" size={14} color="#EAB308" />
                  <Text className="text-yellow-400 text-xs ml-2 flex-1">
                    Weekend bookings disabled in Settings tab.
                  </Text>
                </View>
              )}

              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-semibold">
                  {FULL_DAYS[day.dayOfWeek]}
                </Text>
                <Switch
                  value={day.isOpen}
                  onValueChange={(value) => onToggleDay(day.dayOfWeek, value)}
                  trackColor={{ false: "#374151", true: "#FFCC00" }}
                  thumbColor="#fff"
                />
              </View>
              {day.isOpen && (
                <View>
                  {/* Open/Close Times */}
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs mb-1">Open</Text>
                      <TouchableOpacity
                        className="bg-[#252525] rounded-lg px-3 py-2 flex-row items-center justify-between"
                        onPress={() => onOpenTimePicker(day.dayOfWeek, "openTime")}
                      >
                        <Text className="text-white flex-1 text-center">
                          {formatTime(day.openTime)}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-gray-500 mt-4">to</Text>
                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs mb-1">Close</Text>
                      <TouchableOpacity
                        className="bg-[#252525] rounded-lg px-3 py-2 flex-row items-center justify-between"
                        onPress={() => onOpenTimePicker(day.dayOfWeek, "closeTime")}
                      >
                        <Text className="text-white flex-1 text-center">
                          {formatTime(day.closeTime)}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Break Times */}
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs mb-1">Break Start</Text>
                      <TouchableOpacity
                        className="bg-[#252525] rounded-lg px-3 py-2 flex-row items-center justify-between"
                        onPress={() => onOpenTimePicker(day.dayOfWeek, "breakStartTime")}
                      >
                        <Text className="text-white flex-1 text-center">
                          {formatTime(day.breakStartTime)}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-gray-500 mt-4">to</Text>
                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs mb-1">Break End</Text>
                      <TouchableOpacity
                        className="bg-[#252525] rounded-lg px-3 py-2 flex-row items-center justify-between"
                        onPress={() => onOpenTimePicker(day.dayOfWeek, "breakEndTime")}
                      >
                        <Text className="text-white flex-1 text-center">
                          {formatTime(day.breakEndTime)}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// Settings Tab Component
interface SettingsTabProps {
  timeSlotConfig: TimeSlotConfig | null;
  onUpdateConfig: (updates: Partial<TimeSlotConfig>) => void;
}

function SettingsTab({ timeSlotConfig, onUpdateConfig }: SettingsTabProps) {
  if (!timeSlotConfig) {
    return (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="text-gray-400 text-sm mb-4">
          Configure your booking slot settings.
        </Text>
        <View className="items-center py-8">
          <Text className="text-gray-500">No settings found</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-gray-400 text-sm mb-4">
        Configure your booking slot settings.
      </Text>

      {/* Slot Duration */}
      <SettingCard
        title="Slot Duration"
        description="How long each appointment slot should be"
        options={[15, 30, 45, 60, 90, 120]}
        selectedValue={timeSlotConfig.slotDurationMinutes}
        onSelect={(value) => onUpdateConfig({ slotDurationMinutes: value })}
        suffix="m"
      />

      {/* Buffer Time */}
      <SettingCard
        title="Buffer Time"
        description="Time between appointments"
        options={[0, 5, 10, 15, 30]}
        selectedValue={timeSlotConfig.bufferTimeMinutes}
        onSelect={(value) => onUpdateConfig({ bufferTimeMinutes: value })}
        suffix="m"
      />

      {/* Max Concurrent Bookings */}
      <SettingCard
        title="Max Concurrent Bookings"
        description="Maximum bookings allowed at the same time"
        options={[1, 2, 3, 4, 5]}
        selectedValue={timeSlotConfig.maxConcurrentBookings}
        onSelect={(value) => onUpdateConfig({ maxConcurrentBookings: value })}
      />

      {/* Advance Booking */}
      <SettingCard
        title="Advance Booking"
        description="How far in advance customers can book"
        options={[7, 14, 30, 60, 90]}
        selectedValue={timeSlotConfig.bookingAdvanceDays}
        onSelect={(value) => onUpdateConfig({ bookingAdvanceDays: value })}
        suffix="d"
      />

      {/* Min Booking Notice */}
      <SettingCard
        title="Min Booking Notice"
        description="Minimum hours notice required for booking"
        options={[0, 1, 2, 4, 12, 24]}
        selectedValue={timeSlotConfig.minBookingHours}
        onSelect={(value) => onUpdateConfig({ minBookingHours: value })}
        suffix="h"
      />

      {/* Weekend Bookings Toggle */}
      <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white font-semibold mb-1">Weekend Bookings</Text>
            <Text className="text-gray-500 text-xs">Allow Saturday and Sunday bookings</Text>
          </View>
          <Switch
            value={timeSlotConfig.allowWeekendBooking}
            onValueChange={(value) => onUpdateConfig({ allowWeekendBooking: value })}
            trackColor={{ false: "#374151", true: "#FFCC00" }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </ScrollView>
  );
}

// Setting Card Component
interface SettingCardProps {
  title: string;
  description: string;
  options: number[];
  selectedValue: number;
  onSelect: (value: number) => void;
  suffix?: string;
}

function SettingCard({
  title,
  description,
  options,
  selectedValue,
  onSelect,
  suffix = "",
}: SettingCardProps) {
  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
      <Text className="text-white font-semibold mb-2">{title}</Text>
      <Text className="text-gray-500 text-xs mb-3">{description}</Text>
      <View className="flex-row gap-2">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            className={`flex-1 py-2 rounded-lg ${
              selectedValue === option ? "bg-[#FFCC00]" : "bg-[#252525]"
            }`}
          >
            <Text
              className={`text-center text-xs font-medium ${
                selectedValue === option ? "text-black" : "text-white"
              }`}
            >
              {option}{suffix}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Overrides Tab Component
interface OverridesTabProps {
  overrides: DateOverride[];
  onAddOverride: (override: Omit<DateOverride, 'overrideId' | 'shopId' | 'createdAt'>) => void;
  onDeleteOverride: (overrideDate: string) => void;
}

function OverridesTab({ overrides, onAddOverride, onDeleteOverride }: OverridesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newOverride, setNewOverride] = useState({
    overrideDate: new Date(),
    isClosed: true,
    customOpenTime: "09:00",
    customCloseTime: "17:00",
    reason: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDateForDisplay = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateForApi = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setNewOverride((prev) => ({ ...prev, overrideDate: selectedDate }));
    }
  };

  const handleAdd = () => {
    onAddOverride({
      overrideDate: formatDateForApi(newOverride.overrideDate),
      isClosed: newOverride.isClosed,
      customOpenTime: newOverride.isClosed ? null : newOverride.customOpenTime,
      customCloseTime: newOverride.isClosed ? null : newOverride.customCloseTime,
      reason: newOverride.reason || null,
    });
    setNewOverride({
      overrideDate: new Date(),
      isClosed: true,
      customOpenTime: "09:00",
      customCloseTime: "17:00",
      reason: "",
    });
    setShowAddForm(false);
  };

  const handleDelete = (date: string) => {
    Alert.alert(
      "Delete Override",
      "Are you sure you want to remove this date override?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteOverride(date),
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-gray-400 text-sm mb-4">
        Set special hours or closures for holidays and events.
      </Text>

      {/* Add Override Button */}
      {!showAddForm && (
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          className="bg-[#1a1a1a] rounded-xl p-4 mb-3 flex-row items-center justify-center"
        >
          <Ionicons name="add-circle" size={20} color="#FFCC00" />
          <Text className="text-[#FFCC00] font-semibold ml-2">Add Date Override</Text>
        </TouchableOpacity>
      )}

      {/* Add Form */}
      {showAddForm && (
        <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
          <Text className="text-white font-semibold mb-3">Add Date Override</Text>

          {/* Date Picker */}
          <View className="mb-3">
            <Text className="text-gray-500 text-xs mb-1">Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-[#252525] rounded-lg px-3 py-3 flex-row items-center justify-between"
            >
              <Text className="text-white">{formatDateForDisplay(newOverride.overrideDate)}</Text>
              <Ionicons name="calendar" size={18} color="#FFCC00" />
            </TouchableOpacity>
          </View>

          {/* Reason */}
          <View className="mb-3">
            <Text className="text-gray-500 text-xs mb-1">Reason (optional)</Text>
            <TextInput
              value={newOverride.reason}
              onChangeText={(text) => setNewOverride((prev) => ({ ...prev, reason: text }))}
              placeholder="e.g., Christmas Holiday"
              placeholderTextColor="#666"
              className="bg-[#252525] rounded-lg px-3 py-3 text-white"
            />
          </View>

          {/* Closed Toggle */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white">Closed all day</Text>
            <Switch
              value={newOverride.isClosed}
              onValueChange={(value) => setNewOverride((prev) => ({ ...prev, isClosed: value }))}
              trackColor={{ false: "#374151", true: "#FFCC00" }}
              thumbColor="#fff"
            />
          </View>

          {/* Custom Hours (if not closed) */}
          {!newOverride.isClosed && (
            <View className="flex-row items-center gap-2 mb-3">
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Open</Text>
                <TextInput
                  value={newOverride.customOpenTime}
                  onChangeText={(text) => setNewOverride((prev) => ({ ...prev, customOpenTime: text }))}
                  placeholder="09:00"
                  placeholderTextColor="#666"
                  className="bg-[#252525] rounded-lg px-3 py-2 text-white text-center"
                />
              </View>
              <Text className="text-gray-500 mt-4">to</Text>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Close</Text>
                <TextInput
                  value={newOverride.customCloseTime}
                  onChangeText={(text) => setNewOverride((prev) => ({ ...prev, customCloseTime: text }))}
                  placeholder="17:00"
                  placeholderTextColor="#666"
                  className="bg-[#252525] rounded-lg px-3 py-2 text-white text-center"
                />
              </View>
            </View>
          )}

          {/* Buttons */}
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              onPress={() => setShowAddForm(false)}
              className="flex-1 bg-[#252525] rounded-lg py-3"
            >
              <Text className="text-gray-400 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              className="flex-1 bg-[#FFCC00] rounded-lg py-3"
            >
              <Text className="text-black text-center font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker for iOS */}
          {Platform.OS === "ios" && showDatePicker && (
            <Modal visible={showDatePicker} transparent animationType="slide">
              <View className="flex-1 justify-end bg-black/50">
                <View className="bg-[#1a1a1a] rounded-t-3xl">
                  <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-800">
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text className="text-gray-400">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-white font-semibold">Select Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text className="text-[#FFCC00] font-semibold">Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={newOverride.overrideDate}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                    textColor="#fff"
                    style={{ backgroundColor: "#1a1a1a" }}
                  />
                </View>
              </View>
            </Modal>
          )}

          {/* Date Picker for Android */}
          {Platform.OS === "android" && showDatePicker && (
            <DateTimePicker
              value={newOverride.overrideDate}
              mode="date"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
        </View>
      )}

      {/* Existing Overrides */}
      {overrides.length === 0 ? (
        <View className="items-center py-8">
          <Ionicons name="calendar-outline" size={40} color="#666" />
          <Text className="text-gray-500 mt-2">No date overrides</Text>
        </View>
      ) : (
        overrides.map((override) => (
          <View
            key={override.overrideId || override.overrideDate}
            className="bg-[#1a1a1a] rounded-xl p-4 mb-3 flex-row items-center"
          >
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-white font-semibold">
                  {formatDateForDisplay(override.overrideDate)}
                </Text>
                {override.isClosed ? (
                  <View className="bg-red-500/20 px-2 py-0.5 rounded">
                    <Text className="text-red-400 text-xs font-semibold">CLOSED</Text>
                  </View>
                ) : (
                  <View className="bg-blue-500/20 px-2 py-0.5 rounded">
                    <Text className="text-blue-400 text-xs font-semibold">CUSTOM</Text>
                  </View>
                )}
              </View>
              {override.reason && (
                <Text className="text-gray-400 text-sm">{override.reason}</Text>
              )}
              {!override.isClosed && (
                <Text className="text-gray-500 text-xs mt-1">
                  {override.customOpenTime} - {override.customCloseTime}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(override.overrideDate)}
              className="p-2"
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// Time Picker Modal Component
interface TimePickerModalProps {
  visible: boolean;
  editingField: string | null;
  onClose: () => void;
  onSelectTime: (time: string) => void;
  isTimeSelected: (time: string) => boolean;
  initialScrollIndex: number;
}

function TimePickerModal({
  visible,
  editingField,
  onClose,
  onSelectTime,
  isTimeSelected,
  initialScrollIndex,
}: TimePickerModalProps) {
  const getFieldLabel = () => {
    switch (editingField) {
      case "openTime": return "Opening";
      case "closeTime": return "Closing";
      case "breakStartTime": return "Break Start";
      case "breakEndTime": return "Break End";
      default: return "";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-center items-center"
        onPress={onClose}
      >
        <Pressable
          className="bg-[#1a1a1a] rounded-2xl w-[80%] max-h-[60%]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800">
            <Text className="text-white text-lg font-semibold">
              Select {getFieldLabel()} Time
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={TIME_OPTIONS}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => {
              const selected = isTimeSelected(item.value);
              return (
                <TouchableOpacity
                  onPress={() => onSelectTime(item.value)}
                  className={`px-4 py-3 mx-2 rounded-lg mb-1 ${
                    selected ? "bg-[#FFCC00]" : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-center text-base ${
                      selected ? "text-black font-semibold" : "text-white"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
            getItemLayout={(_, index) => ({
              length: 49,
              offset: 49 * index,
              index,
            })}
            initialScrollIndex={initialScrollIndex}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
