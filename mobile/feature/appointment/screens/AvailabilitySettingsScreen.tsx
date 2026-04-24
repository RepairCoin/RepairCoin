import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  UpdateAvailabilityRequest,
  CreateDateOverrideRequest,
} from "@/shared/interfaces/appointment.interface";
import { appointmentApi } from "../services/appointment.services";
import { formatTimeSlot } from "../utils/timeFormat";
import { useAppToast } from "@/shared/hooks/useAppToast";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type TabType = "hours" | "booking" | "overrides";

export default function AvailabilitySettingsScreen() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";
  const { showSuccess, showError } = useAppToast();

  const [activeTab, setActiveTab] = useState<TabType>("hours");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [availability, setAvailability] = useState<ShopAvailability[]>([]);
  const [config, setConfig] = useState<TimeSlotConfig | null>(null);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);

  // Edit state
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingConfig, setEditingConfig] = useState(false);

  // Temp edit values for operating hours
  const [editValues, setEditValues] = useState<{
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    breakStartTime: string;
    breakEndTime: string;
  }>({ isOpen: false, openTime: "", closeTime: "", breakStartTime: "", breakEndTime: "" });

  // Temp edit values for config
  const [configValues, setConfigValues] = useState<{
    slotDurationMinutes: string;
    bufferTimeMinutes: string;
    maxConcurrentBookings: string;
    bookingAdvanceDays: string;
    minBookingHours: string;
    allowWeekendBooking: boolean;
  }>({
    slotDurationMinutes: "30",
    bufferTimeMinutes: "15",
    maxConcurrentBookings: "3",
    bookingAdvanceDays: "30",
    minBookingHours: "2",
    allowWeekendBooking: true,
  });

  // New override form
  const [newOverride, setNewOverride] = useState<{
    overrideDate: string;
    isClosed: boolean;
    customOpenTime: string;
    customCloseTime: string;
    reason: string;
  }>({
    overrideDate: "",
    isClosed: true,
    customOpenTime: "",
    customCloseTime: "",
    reason: "",
  });

  const loadAllData = useCallback(async () => {
    if (!shopId) return;
    try {
      const [availData, configData, overrideData] = await Promise.all([
        appointmentApi.getShopAvailability(shopId),
        appointmentApi.getTimeSlotConfig(),
        appointmentApi.getDateOverrides(),
      ]);
      setAvailability((availData as ShopAvailability[]) || []);
      setConfig((configData as TimeSlotConfig) || null);
      setOverrides((overrideData as DateOverride[]) || []);
    } catch (err) {
      console.error("Failed to load availability data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, [loadAllData]);

  // ==================== Operating Hours ====================

  const startEditingDay = (dayOfWeek: number) => {
    const dayData = availability.find((a) => a.dayOfWeek === dayOfWeek);
    setEditValues({
      isOpen: dayData?.isOpen ?? false,
      openTime: dayData?.openTime?.slice(0, 5) || "09:00",
      closeTime: dayData?.closeTime?.slice(0, 5) || "17:00",
      breakStartTime: dayData?.breakStartTime?.slice(0, 5) || "",
      breakEndTime: dayData?.breakEndTime?.slice(0, 5) || "",
    });
    setEditingDay(dayOfWeek);
  };

  const saveDayAvailability = async () => {
    if (editingDay === null) return;
    setSaving(true);
    try {
      const payload: UpdateAvailabilityRequest = {
        dayOfWeek: editingDay,
        isOpen: editValues.isOpen,
        openTime: editValues.isOpen ? editValues.openTime : undefined,
        closeTime: editValues.isOpen ? editValues.closeTime : undefined,
        breakStartTime: editValues.isOpen && editValues.breakStartTime ? editValues.breakStartTime : undefined,
        breakEndTime: editValues.isOpen && editValues.breakEndTime ? editValues.breakEndTime : undefined,
      };
      await appointmentApi.updateShopAvailability(payload);
      showSuccess("Hours updated");
      setEditingDay(null);
      await loadAllData();
    } catch (err) {
      showError("Failed to update hours");
    } finally {
      setSaving(false);
    }
  };

  // ==================== Booking Settings ====================

  const startEditingConfig = () => {
    if (config) {
      setConfigValues({
        slotDurationMinutes: String(config.slotDurationMinutes),
        bufferTimeMinutes: String(config.bufferTimeMinutes),
        maxConcurrentBookings: String(config.maxConcurrentBookings),
        bookingAdvanceDays: String(config.bookingAdvanceDays),
        minBookingHours: String(config.minBookingHours),
        allowWeekendBooking: config.allowWeekendBooking,
      });
    }
    setEditingConfig(true);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await appointmentApi.updateTimeSlotConfig({
        slotDurationMinutes: parseInt(configValues.slotDurationMinutes) || 30,
        bufferTimeMinutes: parseInt(configValues.bufferTimeMinutes) || 0,
        maxConcurrentBookings: parseInt(configValues.maxConcurrentBookings) || 1,
        bookingAdvanceDays: parseInt(configValues.bookingAdvanceDays) || 30,
        minBookingHours: parseInt(configValues.minBookingHours) || 2,
        allowWeekendBooking: configValues.allowWeekendBooking,
      });
      showSuccess("Settings saved");
      setEditingConfig(false);
      await loadAllData();
    } catch (err) {
      showError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // ==================== Date Overrides ====================

  const addOverride = async () => {
    if (!newOverride.overrideDate) {
      showError("Please enter a date (YYYY-MM-DD)");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateDateOverrideRequest = {
        overrideDate: newOverride.overrideDate,
        isClosed: newOverride.isClosed,
        customOpenTime: !newOverride.isClosed ? newOverride.customOpenTime : undefined,
        customCloseTime: !newOverride.isClosed ? newOverride.customCloseTime : undefined,
        reason: newOverride.reason || undefined,
      };
      await appointmentApi.createDateOverride(payload);
      showSuccess("Override added");
      setNewOverride({ overrideDate: "", isClosed: true, customOpenTime: "", customCloseTime: "", reason: "" });
      await loadAllData();
    } catch (err) {
      showError("Failed to add override");
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = (date: string) => {
    Alert.alert("Delete Override", `Remove override for ${date}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await appointmentApi.deleteDateOverride(date);
            showSuccess("Override removed");
            await loadAllData();
          } catch (err) {
            showError("Failed to delete override");
          }
        },
      },
    ]);
  };

  // ==================== Render ====================

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

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
        <Text className="text-white text-xl font-bold">Availability</Text>
        <View className="w-9" />
      </View>

      {/* Tabs */}
      <View className="flex-row mx-4 mb-4 bg-[#1a1a1a] rounded-xl p-1">
        {(
          [
            { key: "hours", label: "Hours" },
            { key: "booking", label: "Booking" },
            { key: "overrides", label: "Overrides" },
          ] as { key: TabType; label: string }[]
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              activeTab === tab.key ? "bg-[#FFCC00]" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                activeTab === tab.key ? "text-black" : "text-gray-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        {activeTab === "hours" && renderOperatingHours()}
        {activeTab === "booking" && renderBookingSettings()}
        {activeTab === "overrides" && renderDateOverrides()}
      </ScrollView>
    </View>
  );

  // ==================== Operating Hours Tab ====================
  function renderOperatingHours() {
    return (
      <View>
        <Text className="text-gray-400 text-sm mb-4">
          Set your shop's operating hours for each day of the week.
        </Text>
        {DAY_NAMES.map((dayName, idx) => {
          const dayData = availability.find((a) => a.dayOfWeek === idx);
          const isEditing = editingDay === idx;

          return (
            <View
              key={idx}
              className="bg-[#1a1a1a] rounded-xl mb-3 overflow-hidden"
            >
              {/* Day Header */}
              <TouchableOpacity
                onPress={() =>
                  isEditing ? setEditingDay(null) : startEditingDay(idx)
                }
                className="flex-row items-center justify-between p-4"
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-3 h-3 rounded-full mr-3 ${
                      dayData?.isOpen ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <Text className="text-white font-semibold text-base">
                    {dayName}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  {dayData?.isOpen ? (
                    <Text className="text-gray-400 text-sm mr-2">
                      {formatTimeSlot(dayData.openTime)} -{" "}
                      {formatTimeSlot(dayData.closeTime)}
                    </Text>
                  ) : (
                    <Text className="text-red-400 text-sm mr-2">Closed</Text>
                  )}
                  <Ionicons
                    name={isEditing ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Edit Panel */}
              {isEditing && (
                <View className="px-4 pb-4 border-t border-zinc-800">
                  {/* Open/Closed Toggle */}
                  <View className="flex-row items-center justify-between py-3">
                    <Text className="text-white text-sm">Open</Text>
                    <Switch
                      value={editValues.isOpen}
                      onValueChange={(val) =>
                        setEditValues((p) => ({ ...p, isOpen: val }))
                      }
                      trackColor={{ false: "#333", true: "#FFCC00" }}
                      thumbColor="#fff"
                    />
                  </View>

                  {editValues.isOpen && (
                    <>
                      {/* Operating Hours */}
                      <View className="flex-row gap-3 mb-3">
                        <TimeInput
                          label="Open"
                          value={editValues.openTime}
                          onChange={(v) =>
                            setEditValues((p) => ({ ...p, openTime: v }))
                          }
                        />
                        <TimeInput
                          label="Close"
                          value={editValues.closeTime}
                          onChange={(v) =>
                            setEditValues((p) => ({ ...p, closeTime: v }))
                          }
                        />
                      </View>

                      {/* Break Times */}
                      <Text className="text-gray-500 text-xs mb-2">
                        Break Time (optional)
                      </Text>
                      <View className="flex-row gap-3 mb-3">
                        <TimeInput
                          label="Start"
                          value={editValues.breakStartTime}
                          onChange={(v) =>
                            setEditValues((p) => ({
                              ...p,
                              breakStartTime: v,
                            }))
                          }
                          placeholder="--:--"
                        />
                        <TimeInput
                          label="End"
                          value={editValues.breakEndTime}
                          onChange={(v) =>
                            setEditValues((p) => ({
                              ...p,
                              breakEndTime: v,
                            }))
                          }
                          placeholder="--:--"
                        />
                      </View>
                    </>
                  )}

                  {/* Save Button */}
                  <TouchableOpacity
                    onPress={saveDayAvailability}
                    disabled={saving}
                    className="bg-[#FFCC00] rounded-xl py-3 items-center mt-1"
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text className="text-black font-bold text-sm">
                        Save Changes
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ==================== Booking Settings Tab ====================
  function renderBookingSettings() {
    return (
      <View>
        <Text className="text-gray-400 text-sm mb-4">
          Configure how customers book appointments at your shop.
        </Text>

        {!config && !editingConfig ? (
          <View className="bg-[#1a1a1a] rounded-xl p-6 items-center">
            <Ionicons name="settings-outline" size={40} color="#333" />
            <Text className="text-gray-500 mt-3 mb-4">
              No booking configuration set up yet.
            </Text>
            <TouchableOpacity
              onPress={startEditingConfig}
              className="bg-[#FFCC00] rounded-xl px-6 py-3"
            >
              <Text className="text-black font-bold">Set Up Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-[#1a1a1a] rounded-xl p-4">
            {!editingConfig && (
              <TouchableOpacity
                onPress={startEditingConfig}
                className="self-end mb-3 px-3 py-1.5 rounded-lg bg-[#FFCC00]/10"
              >
                <Text className="text-[#FFCC00] text-sm font-medium">
                  Edit
                </Text>
              </TouchableOpacity>
            )}

            <ConfigField
              label="Slot Duration"
              value={
                editingConfig
                  ? configValues.slotDurationMinutes
                  : String(config?.slotDurationMinutes || 30)
              }
              suffix="min"
              editable={editingConfig}
              onChange={(v) =>
                setConfigValues((p) => ({ ...p, slotDurationMinutes: v }))
              }
              helper="Duration of each appointment slot (15-480)"
            />
            <ConfigField
              label="Buffer Time"
              value={
                editingConfig
                  ? configValues.bufferTimeMinutes
                  : String(config?.bufferTimeMinutes || 0)
              }
              suffix="min"
              editable={editingConfig}
              onChange={(v) =>
                setConfigValues((p) => ({ ...p, bufferTimeMinutes: v }))
              }
              helper="Gap between consecutive appointments (0-120)"
            />
            <ConfigField
              label="Max Concurrent"
              value={
                editingConfig
                  ? configValues.maxConcurrentBookings
                  : String(config?.maxConcurrentBookings || 1)
              }
              suffix=""
              editable={editingConfig}
              onChange={(v) =>
                setConfigValues((p) => ({ ...p, maxConcurrentBookings: v }))
              }
              helper="Simultaneous bookings per time slot (1-50)"
            />
            <ConfigField
              label="Advance Booking"
              value={
                editingConfig
                  ? configValues.bookingAdvanceDays
                  : String(config?.bookingAdvanceDays || 30)
              }
              suffix="days"
              editable={editingConfig}
              onChange={(v) =>
                setConfigValues((p) => ({ ...p, bookingAdvanceDays: v }))
              }
              helper="How far ahead customers can book (1-365)"
            />
            <ConfigField
              label="Min Notice"
              value={
                editingConfig
                  ? configValues.minBookingHours
                  : String(config?.minBookingHours || 2)
              }
              suffix="hrs"
              editable={editingConfig}
              onChange={(v) =>
                setConfigValues((p) => ({ ...p, minBookingHours: v }))
              }
              helper="Minimum advance notice required (0-168)"
            />

            {/* Weekend toggle */}
            <View className="flex-row items-center justify-between py-3 border-t border-zinc-800 mt-2">
              <View>
                <Text className="text-white text-sm font-medium">
                  Weekend Bookings
                </Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  Allow Saturday & Sunday bookings
                </Text>
              </View>
              <Switch
                value={
                  editingConfig
                    ? configValues.allowWeekendBooking
                    : config?.allowWeekendBooking ?? true
                }
                disabled={!editingConfig}
                onValueChange={(val) =>
                  setConfigValues((p) => ({
                    ...p,
                    allowWeekendBooking: val,
                  }))
                }
                trackColor={{ false: "#333", true: "#FFCC00" }}
                thumbColor="#fff"
              />
            </View>

            {editingConfig && (
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={() => setEditingConfig(false)}
                  className="flex-1 border border-zinc-700 rounded-xl py-3 items-center"
                >
                  <Text className="text-gray-400 font-semibold text-sm">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveConfig}
                  disabled={saving}
                  className="flex-1 bg-[#FFCC00] rounded-xl py-3 items-center"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text className="text-black font-bold text-sm">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // ==================== Date Overrides Tab ====================
  function renderDateOverrides() {
    return (
      <View>
        <Text className="text-gray-400 text-sm mb-4">
          Add special closures or custom hours for holidays and events.
        </Text>

        {/* Add Override Form */}
        <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
          <Text className="text-white font-semibold mb-3">Add Override</Text>

          {/* Date */}
          <View className="mb-3">
            <Text className="text-gray-400 text-xs mb-1">Date</Text>
            <TextInput
              className="bg-[#2a2a2c] rounded-lg px-3 h-11 text-white text-sm"
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
              value={newOverride.overrideDate}
              onChangeText={(v) =>
                setNewOverride((p) => ({ ...p, overrideDate: v }))
              }
            />
          </View>

          {/* Reason */}
          <View className="mb-3">
            <Text className="text-gray-400 text-xs mb-1">
              Reason (optional)
            </Text>
            <TextInput
              className="bg-[#2a2a2c] rounded-lg px-3 h-11 text-white text-sm"
              placeholder="e.g., Holiday, Staff Training"
              placeholderTextColor="#666"
              value={newOverride.reason}
              onChangeText={(v) =>
                setNewOverride((p) => ({ ...p, reason: v }))
              }
            />
          </View>

          {/* Closed toggle */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-sm">Closed all day</Text>
            <Switch
              value={newOverride.isClosed}
              onValueChange={(val) =>
                setNewOverride((p) => ({ ...p, isClosed: val }))
              }
              trackColor={{ false: "#333", true: "#FFCC00" }}
              thumbColor="#fff"
            />
          </View>

          {/* Custom hours if not closed */}
          {!newOverride.isClosed && (
            <View className="flex-row gap-3 mb-3">
              <TimeInput
                label="Open"
                value={newOverride.customOpenTime}
                onChange={(v) =>
                  setNewOverride((p) => ({ ...p, customOpenTime: v }))
                }
              />
              <TimeInput
                label="Close"
                value={newOverride.customCloseTime}
                onChange={(v) =>
                  setNewOverride((p) => ({ ...p, customCloseTime: v }))
                }
              />
            </View>
          )}

          <TouchableOpacity
            onPress={addOverride}
            disabled={saving}
            className="bg-[#FFCC00] rounded-xl py-3 items-center"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-black font-bold text-sm">
                Add Override
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Overrides List */}
        {overrides.length === 0 ? (
          <View className="bg-[#1a1a1a] rounded-xl p-6 items-center">
            <Ionicons name="calendar-outline" size={40} color="#333" />
            <Text className="text-gray-500 mt-3">No date overrides set</Text>
          </View>
        ) : (
          overrides.map((ovr) => (
            <View
              key={ovr.overrideId}
              className="bg-[#1a1a1a] rounded-xl p-4 mb-3 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="text-white font-semibold">
                  {formatOverrideDate(ovr.overrideDate)}
                </Text>
                {ovr.reason && (
                  <Text className="text-gray-400 text-sm mt-0.5">
                    {ovr.reason}
                  </Text>
                )}
                <View className="flex-row items-center mt-1">
                  {ovr.isClosed ? (
                    <View className="bg-red-500/20 px-2 py-0.5 rounded">
                      <Text className="text-red-400 text-xs font-medium">
                        CLOSED
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-blue-500/20 px-2 py-0.5 rounded">
                      <Text className="text-blue-400 text-xs font-medium">
                        {formatTimeSlot(ovr.customOpenTime)} -{" "}
                        {formatTimeSlot(ovr.customCloseTime)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => deleteOverride(ovr.overrideDate)}
                className="w-9 h-9 rounded-full bg-red-500/10 items-center justify-center"
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  }
}

// ==================== Sub-Components ====================

function TimeInput({
  label,
  value,
  onChange,
  placeholder = "HH:MM",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="flex-1">
      <Text className="text-gray-400 text-xs mb-1">{label}</Text>
      <TextInput
        className="bg-[#2a2a2c] rounded-lg px-3 h-11 text-white text-sm text-center"
        placeholder={placeholder}
        placeholderTextColor="#666"
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

function ConfigField({
  label,
  value,
  suffix,
  editable,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  suffix: string;
  editable: boolean;
  onChange: (v: string) => void;
  helper: string;
}) {
  return (
    <View className="py-3 border-b border-zinc-800/50">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-white text-sm font-medium">{label}</Text>
          <Text className="text-gray-600 text-xs mt-0.5">{helper}</Text>
        </View>
        {editable ? (
          <View className="flex-row items-center bg-[#2a2a2c] rounded-lg px-3">
            <TextInput
              className="h-10 text-white text-sm w-14 text-center"
              value={value}
              onChangeText={onChange}
              keyboardType="number-pad"
            />
            {suffix ? (
              <Text className="text-gray-500 text-xs ml-1">{suffix}</Text>
            ) : null}
          </View>
        ) : (
          <Text className="text-[#FFCC00] font-semibold">
            {value}
            {suffix ? ` ${suffix}` : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

function formatOverrideDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
