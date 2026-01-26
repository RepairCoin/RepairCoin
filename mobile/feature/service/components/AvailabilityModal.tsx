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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TimeSlotConfig } from "@/shared/interfaces/appointment.interface";
import { PendingAvailabilityChanges } from "../types";
import {
  useAvailabilityModal,
} from "../hooks";
import { AVAILABILITY_TABS, FULL_DAYS, TIME_OPTIONS } from "../constants";

interface AvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (changes: PendingAvailabilityChanges) => void;
  shopId: string;
}

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
    showTimePicker,
    editingField,
    openTimePicker,
    closeTimePicker,
    handleTimeSelect,
    handleToggleDay,
    handleUpdateConfig,
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
  onToggleDay: (dayOfWeek: number, isOpen: boolean) => void;
  onOpenTimePicker: (dayOfWeek: number, field: "openTime" | "closeTime") => void;
  formatTime: (time: string | null) => string;
}

function HoursTab({
  availability,
  onToggleDay,
  onOpenTimePicker,
  formatTime,
}: HoursTabProps) {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-gray-400 text-sm mb-4">
        Set your shop's operating hours for each day of the week.
      </Text>
      {availability.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-gray-500">No availability data found</Text>
        </View>
      ) : (
        availability.map((day) => (
          <View
            key={day.dayOfWeek}
            className="bg-[#1a1a1a] rounded-xl p-4 mb-3"
          >
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
              <View className="flex-row items-center gap-2">
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
            )}
          </View>
        ))
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

// Time Picker Modal Component
interface TimePickerModalProps {
  visible: boolean;
  editingField: "openTime" | "closeTime" | null;
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
              Select {editingField === "openTime" ? "Opening" : "Closing"} Time
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
