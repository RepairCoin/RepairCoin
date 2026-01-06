import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import {
  ShopAvailability,
  TimeSlotConfig,
} from "@/interfaces/appointment.interface";
import { appointmentApi } from "@/services/appointment.services";
import { PendingAvailabilityChanges, AvailabilityTab } from "../../types";
import { TIME_OPTIONS } from "../../constants/TIME_OPTIONS";

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

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"openTime" | "closeTime" | null>(null);

  // Load data when modal becomes visible
  useEffect(() => {
    if (visible && shopId) {
      loadData();
    }
  }, [visible, shopId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [availRes, configRes] = await Promise.all([
        appointmentApi.getShopAvailability(shopId),
        appointmentApi.getTimeSlotConfig(),
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
    } catch (error) {
      console.error("Failed to load availability data:", error);
      Alert.alert("Error", "Failed to load availability settings");
    } finally {
      setLoading(false);
    }
  };

  // Time picker handlers
  const openTimePicker = useCallback(
    (dayOfWeek: number, field: "openTime" | "closeTime") => {
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

  // Check if there are changes
  const hasChanges = useCallback(() => {
    const availChanged =
      JSON.stringify(availability) !== JSON.stringify(originalAvailability);
    const configChanged =
      JSON.stringify(timeSlotConfig) !== JSON.stringify(originalTimeSlotConfig);
    return availChanged || configChanged;
  }, [availability, originalAvailability, timeSlotConfig, originalTimeSlotConfig]);

  // Handle done button
  const handleDone = useCallback(() => {
    onSave({
      availability,
      timeSlotConfig,
      hasChanges: hasChanges(),
    });
    onClose();
  }, [availability, timeSlotConfig, hasChanges, onSave, onClose]);

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
    const currentTime =
      editingField === "openTime" ? currentDay?.openTime : currentDay?.closeTime;

    const index = TIME_OPTIONS.findIndex((t) => t.value === currentTime);
    return Math.max(0, index - 3);
  }, [editingDay, editingField, availability]);

  // Check if a time is selected
  const isTimeSelected = useCallback(
    (timeValue: string) => {
      const currentDay = availability.find((d) => d.dayOfWeek === editingDay);
      return editingField === "openTime"
        ? currentDay?.openTime === timeValue
        : currentDay?.closeTime === timeValue;
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
    // Time picker state
    showTimePicker,
    editingField,
    // Handlers
    openTimePicker,
    closeTimePicker,
    handleTimeSelect,
    handleToggleDay,
    handleUpdateConfig,
    handleDone,
    // Utils
    formatTime,
    getTimePickerInitialIndex,
    isTimeSelected,
  };
}
