import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import {
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
} from "@/shared/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";
import { PendingAvailabilityChanges, AvailabilityTab } from "../../types";
import { TIME_OPTIONS } from "../../constants/TIME_OPTIONS";

type TimeField = "openTime" | "closeTime" | "breakStartTime" | "breakEndTime";

interface UseAvailabilityModalProps {
  visible: boolean;
  shopId: string;
  onSave: (changes: PendingAvailabilityChanges) => void;
  onClose: () => void;
}

export function useAvailabilityModal({
  visible,
  shopId,
  onSave,
  onClose,
}: UseAvailabilityModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<AvailabilityTab>("hours");
  const [loading, setLoading] = useState(true);

  // Availability state
  const [availability, setAvailability] = useState<ShopAvailability[]>([]);
  const [originalAvailability, setOriginalAvailability] = useState<ShopAvailability[]>([]);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);
  const [originalTimeSlotConfig, setOriginalTimeSlotConfig] = useState<TimeSlotConfig | null>(null);

  // Date overrides state
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [originalDateOverrides, setOriginalDateOverrides] = useState<DateOverride[]>([]);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<TimeField | null>(null);

  // Load data when modal becomes visible
  useEffect(() => {
    if (visible && shopId) {
      loadData();
    }
  }, [visible, shopId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [availRes, configRes, overridesRes] = await Promise.all([
        appointmentApi.getShopAvailability(shopId),
        appointmentApi.getTimeSlotConfig(),
        appointmentApi.getDateOverrides(),
      ]);

      if (availRes.data) {
        const sorted = [...availRes.data].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek
        );
        setAvailability(sorted);
        setOriginalAvailability(sorted);
      }
      if (configRes.data) {
        setTimeSlotConfig(configRes.data);
        setOriginalTimeSlotConfig(configRes.data);
      }
      if (overridesRes.data) {
        setDateOverrides(overridesRes.data);
        setOriginalDateOverrides(overridesRes.data);
      }
    } catch (error) {
      console.error("Failed to load availability data:", error);
      Alert.alert("Error", "Failed to load availability settings");
    } finally {
      setLoading(false);
    }
  };

  // Time picker handlers
  const openTimePicker = useCallback(
    (dayOfWeek: number, field: TimeField) => {
      setEditingDay(dayOfWeek);
      setEditingField(field);
      setShowTimePicker(true);
    },
    []
  );

  const closeTimePicker = useCallback(() => {
    setShowTimePicker(false);
    setEditingDay(null);
    setEditingField(null);
  }, []);

  const handleTimeSelect = useCallback(
    (time: string) => {
      if (editingDay !== null && editingField) {
        setAvailability((prev) =>
          prev.map((a) =>
            a.dayOfWeek === editingDay ? { ...a, [editingField]: time } : a
          )
        );
      }
      closeTimePicker();
    },
    [editingDay, editingField, closeTimePicker]
  );

  // Availability handlers
  const handleToggleDay = useCallback((dayOfWeek: number, isOpen: boolean) => {
    setAvailability((prev) =>
      prev.map((a) => (a.dayOfWeek === dayOfWeek ? { ...a, isOpen } : a))
    );
  }, []);

  const handleUpdateConfig = useCallback(
    (updates: Partial<TimeSlotConfig>) => {
      if (!timeSlotConfig) return;
      setTimeSlotConfig({ ...timeSlotConfig, ...updates });
    },
    [timeSlotConfig]
  );

  // Date override handlers
  const handleAddOverride = useCallback((override: Omit<DateOverride, 'overrideId' | 'shopId' | 'createdAt'>) => {
    const newOverride: DateOverride = {
      overrideId: `temp-${Date.now()}`,
      shopId: shopId,
      overrideDate: override.overrideDate,
      isClosed: override.isClosed,
      customOpenTime: override.customOpenTime || null,
      customCloseTime: override.customCloseTime || null,
      reason: override.reason || null,
      createdAt: new Date().toISOString(),
    };
    setDateOverrides((prev) => [...prev, newOverride]);
  }, [shopId]);

  const handleDeleteOverride = useCallback((overrideDate: string) => {
    setDateOverrides((prev) => prev.filter((o) => o.overrideDate !== overrideDate));
  }, []);

  // Check if there are changes
  const hasChanges = useCallback(() => {
    const availChanged =
      JSON.stringify(availability) !== JSON.stringify(originalAvailability);
    const configChanged =
      JSON.stringify(timeSlotConfig) !== JSON.stringify(originalTimeSlotConfig);
    const overridesChanged =
      JSON.stringify(dateOverrides) !== JSON.stringify(originalDateOverrides);
    return availChanged || configChanged || overridesChanged;
  }, [availability, originalAvailability, timeSlotConfig, originalTimeSlotConfig, dateOverrides, originalDateOverrides]);

  // Handle done button
  const handleDone = useCallback(() => {
    onSave({
      availability: availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        isOpen: a.isOpen,
        openTime: a.openTime,
        closeTime: a.closeTime,
        breakStartTime: a.breakStartTime,
        breakEndTime: a.breakEndTime,
      })),
      timeSlotConfig: timeSlotConfig ? {
        slotDurationMinutes: timeSlotConfig.slotDurationMinutes,
        bufferTimeMinutes: timeSlotConfig.bufferTimeMinutes,
        maxConcurrentBookings: timeSlotConfig.maxConcurrentBookings,
        bookingAdvanceDays: timeSlotConfig.bookingAdvanceDays,
        minBookingHours: timeSlotConfig.minBookingHours,
        allowWeekendBooking: timeSlotConfig.allowWeekendBooking,
      } : null,
      dateOverrides: dateOverrides.map((o) => ({
        overrideDate: o.overrideDate,
        isClosed: o.isClosed,
        customOpenTime: o.customOpenTime,
        customCloseTime: o.customCloseTime,
        reason: o.reason,
      })),
      hasChanges: hasChanges(),
    });
    onClose();
  }, [availability, timeSlotConfig, dateOverrides, hasChanges, onSave, onClose]);

  // Format time for display
  const formatTime = useCallback((time: string | null) => {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const period = h < 12 ? "AM" : "PM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${period}`;
  }, []);

  // Get initial scroll index for time picker
  const getTimePickerInitialIndex = useCallback(() => {
    if (editingDay === null || !editingField) return 0;

    const currentDay = availability.find((d) => d.dayOfWeek === editingDay);
    if (!currentDay) return 0;

    const currentTime = currentDay[editingField as keyof ShopAvailability] as string | null;
    const index = TIME_OPTIONS.findIndex((t) => t.value === currentTime);
    return Math.max(0, index - 3);
  }, [editingDay, editingField, availability]);

  // Check if a time is selected
  const isTimeSelected = useCallback(
    (timeValue: string) => {
      const currentDay = availability.find((d) => d.dayOfWeek === editingDay);
      if (!currentDay || !editingField) return false;
      return currentDay[editingField as keyof ShopAvailability] === timeValue;
    },
    [availability, editingDay, editingField]
  );

  return {
    // Tab state
    activeTab,
    setActiveTab,
    loading,
    // Availability data
    availability,
    timeSlotConfig,
    dateOverrides,
    // Time picker state
    showTimePicker,
    editingField,
    // Handlers
    openTimePicker,
    closeTimePicker,
    handleTimeSelect,
    handleToggleDay,
    handleUpdateConfig,
    handleAddOverride,
    handleDeleteOverride,
    handleDone,
    // Utils
    formatTime,
    getTimePickerInitialIndex,
    isTimeSelected,
  };
}
