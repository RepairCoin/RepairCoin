import { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Platform,
  Modal,
  FlatList,
  Switch,
  ActivityIndicator,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ui/ThemedView";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useAuthStore } from "@/store/auth.store";
import { useService } from "@/hooks/service/useService";
import { UpdateServiceData } from "@/interfaces/service.interface";
import { queryKeys } from "@/config/queryClient";
import { appointmentApi } from "@/services/appointment.services";
import {
  ShopAvailability,
  TimeSlotConfig,
} from "@/interfaces/appointment.interface";

type AvailabilityTab = "hours" | "settings";

const FULL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const AVAILABILITY_TABS: { label: string; value: AvailabilityTab }[] = [
  { label: "Hours", value: "hours" },
  { label: "Settings", value: "settings" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${displayHour}:${minute} ${period}`,
  };
});

interface PendingAvailabilityChanges {
  availability: ShopAvailability[];
  timeSlotConfig: TimeSlotConfig | null;
  hasChanges: boolean;
}

interface AvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (changes: PendingAvailabilityChanges) => void;
  shopId: string;
}

function AvailabilityModal({
  visible,
  onClose,
  onSave,
  shopId,
}: AvailabilityModalProps) {
  const [activeTab, setActiveTab] = useState<AvailabilityTab>("hours");
  const [loading, setLoading] = useState(true);

  const [availability, setAvailability] = useState<ShopAvailability[]>([]);
  const [originalAvailability, setOriginalAvailability] = useState<
    ShopAvailability[]
  >([]);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(
    null
  );
  const [originalTimeSlotConfig, setOriginalTimeSlotConfig] =
    useState<TimeSlotConfig | null>(null);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<
    "openTime" | "closeTime" | null
  >(null);

  const openTimePicker = (
    dayOfWeek: number,
    field: "openTime" | "closeTime"
  ) => {
    setEditingDay(dayOfWeek);
    setEditingField(field);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time: string) => {
    if (editingDay !== null && editingField) {
      handleUpdateHours(editingDay, editingField, time);
    }
    setShowTimePicker(false);
    setEditingDay(null);
    setEditingField(null);
  };

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

  const handleToggleDay = (dayOfWeek: number, isOpen: boolean) => {
    setAvailability((prev) =>
      prev.map((a) => (a.dayOfWeek === dayOfWeek ? { ...a, isOpen } : a))
    );
  };

  const handleUpdateHours = (
    dayOfWeek: number,
    field: "openTime" | "closeTime",
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((a) =>
        a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a
      )
    );
  };

  const handleUpdateConfig = (updates: Partial<TimeSlotConfig>) => {
    if (!timeSlotConfig) return;
    setTimeSlotConfig({ ...timeSlotConfig, ...updates });
  };

  const hasChanges = () => {
    const availChanged =
      JSON.stringify(availability) !== JSON.stringify(originalAvailability);
    const configChanged =
      JSON.stringify(timeSlotConfig) !== JSON.stringify(originalTimeSlotConfig);
    return availChanged || configChanged;
  };

  const handleDone = () => {
    onSave({
      availability,
      timeSlotConfig,
      hasChanges: hasChanges(),
    });
    onClose();
  };

  const formatTime = (time: string | null) => {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const period = h < 12 ? "AM" : "PM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${period}`;
  };

  const renderHoursTab = () => (
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
                onValueChange={(value) => handleToggleDay(day.dayOfWeek, value)}
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
                    onPress={() => openTimePicker(day.dayOfWeek, "openTime")}
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
                    onPress={() => openTimePicker(day.dayOfWeek, "closeTime")}
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

  const renderSettingsTab = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-gray-400 text-sm mb-4">
        Configure your booking slot settings.
      </Text>
      {!timeSlotConfig ? (
        <View className="items-center py-8">
          <Text className="text-gray-500">No settings found</Text>
        </View>
      ) : (
        <>
          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
            <Text className="text-white font-semibold mb-2">Slot Duration</Text>
            <Text className="text-gray-500 text-xs mb-3">
              How long each appointment slot should be
            </Text>
            <View className="flex-row gap-2">
              {[15, 30, 45, 60, 90, 120].map((duration) => (
                <TouchableOpacity
                  key={duration}
                  onPress={() =>
                    handleUpdateConfig({ slotDurationMinutes: duration })
                  }
                  className={`flex-1 py-2 rounded-lg ${
                    timeSlotConfig.slotDurationMinutes === duration
                      ? "bg-[#FFCC00]"
                      : "bg-[#252525]"
                  }`}
                >
                  <Text
                    className={`text-center text-xs font-medium ${
                      timeSlotConfig.slotDurationMinutes === duration
                        ? "text-black"
                        : "text-white"
                    }`}
                  >
                    {duration}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
            <Text className="text-white font-semibold mb-2">Buffer Time</Text>
            <Text className="text-gray-500 text-xs mb-3">
              Time between appointments
            </Text>
            <View className="flex-row gap-2">
              {[0, 5, 10, 15, 30].map((buffer) => (
                <TouchableOpacity
                  key={buffer}
                  onPress={() =>
                    handleUpdateConfig({ bufferTimeMinutes: buffer })
                  }
                  className={`flex-1 py-2 rounded-lg ${
                    timeSlotConfig.bufferTimeMinutes === buffer
                      ? "bg-[#FFCC00]"
                      : "bg-[#252525]"
                  }`}
                >
                  <Text
                    className={`text-center text-xs font-medium ${
                      timeSlotConfig.bufferTimeMinutes === buffer
                        ? "text-black"
                        : "text-white"
                    }`}
                  >
                    {buffer}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
            <Text className="text-white font-semibold mb-2">
              Max Concurrent Bookings
            </Text>
            <Text className="text-gray-500 text-xs mb-3">
              Maximum bookings allowed at the same time
            </Text>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map((max) => (
                <TouchableOpacity
                  key={max}
                  onPress={() =>
                    handleUpdateConfig({ maxConcurrentBookings: max })
                  }
                  className={`flex-1 py-2 rounded-lg ${
                    timeSlotConfig.maxConcurrentBookings === max
                      ? "bg-[#FFCC00]"
                      : "bg-[#252525]"
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-medium ${
                      timeSlotConfig.maxConcurrentBookings === max
                        ? "text-black"
                        : "text-white"
                    }`}
                  >
                    {max}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
            <Text className="text-white font-semibold mb-2">
              Advance Booking
            </Text>
            <Text className="text-gray-500 text-xs mb-3">
              How far in advance customers can book
            </Text>
            <View className="flex-row gap-2">
              {[7, 14, 30, 60, 90].map((days) => (
                <TouchableOpacity
                  key={days}
                  onPress={() =>
                    handleUpdateConfig({ bookingAdvanceDays: days })
                  }
                  className={`flex-1 py-2 rounded-lg ${
                    timeSlotConfig.bookingAdvanceDays === days
                      ? "bg-[#FFCC00]"
                      : "bg-[#252525]"
                  }`}
                >
                  <Text
                    className={`text-center text-xs font-medium ${
                      timeSlotConfig.bookingAdvanceDays === days
                        ? "text-black"
                        : "text-white"
                    }`}
                  >
                    {days}d
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-[#121212] rounded-t-3xl pt-4 pb-8 px-4 h-[85%]">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">
              Availability Settings
            </Text>
            <View className="w-10" />
          </View>

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

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#FFCC00" />
            </View>
          ) : (
            <>
              {activeTab === "hours" && renderHoursTab()}
              {activeTab === "settings" && renderSettingsTab()}
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
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setShowTimePicker(false)}
        >
          <Pressable
            className="bg-[#1a1a1a] rounded-2xl w-[80%] max-h-[60%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800">
              <Text className="text-white text-lg font-semibold">
                Select {editingField === "openTime" ? "Opening" : "Closing"}{" "}
                Time
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const currentDay = availability.find(
                  (d) => d.dayOfWeek === editingDay
                );
                const isSelected =
                  editingField === "openTime"
                    ? currentDay?.openTime === item.value
                    : currentDay?.closeTime === item.value;

                return (
                  <TouchableOpacity
                    onPress={() => handleTimeSelect(item.value)}
                    className={`px-4 py-3 mx-2 rounded-lg mb-1 ${
                      isSelected ? "bg-[#FFCC00]" : "bg-transparent"
                    }`}
                  >
                    <Text
                      className={`text-center text-base ${
                        isSelected ? "text-black font-semibold" : "text-white"
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
              initialScrollIndex={
                editingDay !== null && editingField
                  ? Math.max(
                      0,
                      TIME_OPTIONS.findIndex(
                        (t) =>
                          t.value ===
                          (editingField === "openTime"
                            ? availability.find(
                                (d) => d.dayOfWeek === editingDay
                              )?.openTime
                            : availability.find(
                                (d) => d.dayOfWeek === editingDay
                              )?.closeTime)
                      ) - 3
                    )
                  : 0
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

export default function ServiceForm() {
  const params = useLocalSearchParams();
  const { useCreateService, useUpdateService } = useService();
  const isEditMode = params.mode === "edit";
  const serviceId = params.serviceId as string;
  const serviceDataString = params.data as string;

  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  const { mutateAsync: createServiceMutation } = useCreateService();
  const { mutateAsync: updateServiceMutation } = useUpdateService();

  const [formData, setFormData] = useState({
    serviceName: "",
    category: "repairs",
    description: "",
    priceUsd: "",
    imageUrl: "",
    tags: "",
    active: true,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);
  const [pendingAvailabilityChanges, setPendingAvailabilityChanges] =
    useState<PendingAvailabilityChanges | null>(null);

  // Load service data for edit mode
  useEffect(() => {
    if (isEditMode && serviceDataString) {
      try {
        const serviceData: UpdateServiceData = JSON.parse(serviceDataString);
        setFormData({
          serviceName: serviceData.serviceName || "",
          category: serviceData.category || "repairs",
          description: serviceData.description || "",
          priceUsd: serviceData.priceUsd?.toString() || "",
          imageUrl: serviceData.imageUrl || "",
          tags: serviceData.tags?.join(", ") || "",
          active: serviceData.active ?? true,
        });
        if (serviceData.imageUrl) {
          setSelectedImage(serviceData.imageUrl);
        }
      } catch (error) {
        console.error("Failed to parse service data:", error);
      }
    }
  }, [isEditMode, serviceDataString]);

  const filteredCategories = SERVICE_CATEGORIES.filter((cat) =>
    cat.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCategory = SERVICE_CATEGORIES.find(
    (cat) => cat.value === formData.category
  );

  const handleCategorySelect = (categoryValue: string) => {
    setFormData({ ...formData, category: categoryValue });
    setCategoryModalVisible(false);
    setSearchQuery("");
  };

  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Get auth token from store
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      // Get file info from URI
      const filename = uri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      // Create FormData for React Native
      const uploadFormData = new FormData();
      uploadFormData.append("image", {
        uri: uri,
        name: filename,
        type: type,
      } as any);

      const baseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
      const url = `${baseUrl}/upload/service-image`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Upload failed");
      }

      console.log("Upload success - url:", result.url, "key:", result.key);
      return result.url;
    } catch (error) {
      console.log("Upload error:", error);
      Alert.alert("Upload Failed", "Failed to upload image. Please try again.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImagePick = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setSelectedImage(localUri);

      // Upload image to server
      const uploadedUrl = await uploadImage(localUri);

      if (uploadedUrl) {
        // Use the server URL for the form data
        setFormData({ ...formData, imageUrl: uploadedUrl });
      } else {
        // If upload failed, clear the selection
        setSelectedImage(null);
      }
    }
  };

  // Save availability changes to the API
  const saveAvailabilityChanges = async () => {
    if (!pendingAvailabilityChanges || !pendingAvailabilityChanges.hasChanges) {
      return;
    }

    const { availability, timeSlotConfig } = pendingAvailabilityChanges;

    // Save availability for each day that changed
    for (const day of availability) {
      try {
        await appointmentApi.updateShopAvailability({
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openTime: day.openTime || "09:00",
          closeTime: day.closeTime || "17:00",
        });
      } catch (error) {
        console.error(
          `Failed to update availability for day ${day.dayOfWeek}:`,
          error
        );
      }
    }

    // Save time slot config if changed
    if (timeSlotConfig) {
      try {
        await appointmentApi.updateTimeSlotConfig({
          slotDurationMinutes: timeSlotConfig.slotDurationMinutes,
          bufferTimeMinutes: timeSlotConfig.bufferTimeMinutes,
          maxConcurrentBookings: timeSlotConfig.maxConcurrentBookings,
          bookingAdvanceDays: timeSlotConfig.bookingAdvanceDays,
        });
      } catch (error) {
        console.error("Failed to update time slot config:", error);
      }
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.serviceName.trim()) {
      Alert.alert("Error", "Please enter a service name");
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }
    if (!formData.priceUsd || parseFloat(formData.priceUsd) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      if (isEditMode && serviceId) {
        // Update existing service
        const updateData: UpdateServiceData = {
          serviceName: formData.serviceName,
          description: formData.description || undefined,
          category: formData.category as any,
          priceUsd: parseFloat(formData.priceUsd),
          durationMinutes: 30,
          imageUrl: formData.imageUrl || undefined,
          tags: tags.length > 0 ? tags : undefined,
          active: formData.active,
        };

        await updateServiceMutation({
          serviceId,
          serviceData: updateData,
        });

        // Save availability changes if any
        await saveAvailabilityChanges();

        // Invalidate and refetch services list (use servicesBase for partial match)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(shopId!),
        });

        Alert.alert("Success", "Service updated successfully", [
          { text: "OK", onPress: () => goBack() },
        ]);
      } else {
        // Create new service
        const createData = {
          serviceName: formData.serviceName,
          description: formData.description || undefined,
          category: formData.category,
          priceUsd: parseFloat(formData.priceUsd),
          durationMinutes: 30,
          imageUrl: formData.imageUrl || undefined,
          tags: tags.length > 0 ? tags : undefined,
          active: formData.active,
        };

        await createServiceMutation({
          serviceData: createData,
        });

        // Save availability changes if any
        await saveAvailabilityChanges();

        // Invalidate and refetch services list (use servicesBase for partial match)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(shopId!),
        });

        Alert.alert("Success", "Service created successfully", [
          { text: "OK", onPress: () => goBack() },
        ]);
      }
    } catch (error) {
      console.error(
        `Failed to ${isEditMode ? "update" : "create"} service:`,
        error
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView className="h-full w-full">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className={`px-4 ${Platform.OS === "ios" ? "pt-14" : "pt-20"}`}>
          <View className="flex-row justify-between items-center mb-6">
            <TouchableOpacity onPress={goBack}>
              <AntDesign name="left" color="white" size={24} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-semibold">
              {isEditMode ? "Edit Service" : "Add New Service"}
            </Text>
            <View className="w-[24px]" />
          </View>

          {/* Service Name */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Service Name *</Text>
            <TextInput
              className="bg-gray-800 text-white px-4 py-3 rounded-lg"
              placeholder="e.g., Oil Change Service"
              placeholderTextColor="#6B7280"
              value={formData.serviceName}
              onChangeText={(text) =>
                setFormData({ ...formData, serviceName: text })
              }
            />
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Category *</Text>
            <TouchableOpacity
              onPress={() => setCategoryModalVisible(true)}
              className="bg-gray-800 px-4 py-3 rounded-lg flex-row items-center justify-between"
            >
              <Text className="text-white">
                {selectedCategory?.label || "Select a category"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">
              Short Description *
            </Text>
            <TextInput
              className="bg-gray-800 text-white px-4 py-3 rounded-lg"
              placeholder="Brief description of your service"
              placeholderTextColor="#6B7280"
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Price */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Price (USD) *</Text>
            <TextInput
              className="bg-gray-800 text-white px-4 py-3 rounded-lg"
              placeholder="0.00"
              placeholderTextColor="#6B7280"
              value={formData.priceUsd}
              onChangeText={(text) =>
                setFormData({ ...formData, priceUsd: text })
              }
              keyboardType="decimal-pad"
            />
          </View>

          {/* Image Upload */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Service Image</Text>
            <TouchableOpacity
              onPress={handleImagePick}
              disabled={isUploading}
              className="relative overflow-hidden"
            >
              {isUploading ? (
                <View className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 h-40 items-center justify-center">
                  <View className="bg-gray-700/50 rounded-full p-4 mb-3">
                    <Ionicons
                      name="cloud-upload-outline"
                      size={32}
                      color="#FFCC00"
                    />
                  </View>
                  <Text className="text-white font-medium mb-1">
                    Uploading Image...
                  </Text>
                  <Text className="text-gray-500 text-xs">Please wait</Text>
                </View>
              ) : selectedImage ? (
                <View className="relative">
                  <Image
                    source={{ uri: selectedImage }}
                    className="w-full h-40 rounded-lg"
                    resizeMode="cover"
                  />
                  <View className="absolute inset-0 bg-black/20 rounded-lg" />
                  <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-lg">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Ionicons name="image" size={16} color="white" />
                        <Text className="text-white text-xs ml-2">
                          Image Selected
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedImage(null);
                          setFormData({ ...formData, imageUrl: "" });
                        }}
                        className="bg-red-500/80 rounded-full p-1"
                      >
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 h-40 items-center justify-center">
                  <View className="bg-gray-700/50 rounded-full p-4 mb-3">
                    <Ionicons name="camera-outline" size={32} color="#FFCC00" />
                  </View>
                  <Text className="text-white font-medium mb-1">
                    Add Service Image
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Tap to upload from gallery
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Tags */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Tags (Optional)</Text>
            <TextInput
              className="bg-gray-800 text-white px-4 py-3 rounded-lg"
              placeholder="e.g., maintenance, quick-service (comma separated)"
              placeholderTextColor="#6B7280"
              value={formData.tags}
              onChangeText={(text) => setFormData({ ...formData, tags: text })}
            />
          </View>

          {/* Service Status */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Service Status</Text>
            <View className="bg-gray-800 px-4 py-4 rounded-lg flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name={formData.active ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={formData.active ? "#22c55e" : "#ef4444"}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">
                    {formData.active ? "Active" : "Inactive"}
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    {formData.active
                      ? "Service is visible to customers"
                      : "Service is hidden from customers"}
                  </Text>
                </View>
              </View>
              <Switch
                value={formData.active}
                onValueChange={(value) =>
                  setFormData({ ...formData, active: value })
                }
                trackColor={{ false: "#374151", true: "#22c55e" }}
                thumbColor={formData.active ? "#fff" : "#9CA3AF"}
              />
            </View>
          </View>

          {/* Availability Settings */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Availability</Text>
            <TouchableOpacity
              onPress={() => setShowAvailability(true)}
              className="bg-gray-800 px-4 py-4 rounded-lg flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={20} color="#FFCC00" />
                <View className="ml-3">
                  <Text className="text-white font-medium">
                    Availability Settings
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Set operating hours, booking slots & holidays
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {/* Submit Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-6 pt-4 pb-8 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className={`bg-[#FFCC00] rounded-lg py-4 items-center ${
            isSubmitting ? "opacity-50" : ""
          }`}
        >
          <Text className="text-black text-lg font-bold ml-2">
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Service"
                : "Create Service"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => {
          setCategoryModalVisible(false);
          setSearchQuery("");
        }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-gray-900 rounded-t-3xl max-h-[60%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
              <Text className="text-white text-lg font-semibold">
                Select Category
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCategoryModalVisible(false);
                  setSearchQuery("");
                }}
              >
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Category List */}
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.value}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleCategorySelect(item.value)}
                  className="px-4 py-3 flex-row items-center justify-between border-b border-gray-800"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-3">
                      <Ionicons
                        name={
                          item.value === "repairs"
                            ? "hammer"
                            : item.value === "beauty_personal_care"
                              ? "cut"
                              : item.value === "health_wellness"
                                ? "heart"
                                : item.value === "fitness_gyms"
                                  ? "barbell"
                                  : item.value === "automotive_services"
                                    ? "car"
                                    : item.value === "home_cleaning_services"
                                      ? "home"
                                      : item.value === "pets_animal_care"
                                        ? "paw"
                                        : item.value === "professional_services"
                                          ? "briefcase"
                                          : item.value === "education_classes"
                                            ? "school"
                                            : item.value === "tech_it_services"
                                              ? "desktop"
                                              : item.value === "food_beverage"
                                                ? "restaurant"
                                                : "ellipsis-horizontal"
                        }
                        size={20}
                        color="#FFCC00"
                      />
                    </View>
                    <Text className="text-white text-base">{item.label}</Text>
                  </View>
                  {formData.category === item.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#FFCC00"
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <Text className="text-gray-500">No categories found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Availability Modal */}
      {shopId && (
        <AvailabilityModal
          visible={showAvailability}
          onClose={() => setShowAvailability(false)}
          onSave={(changes) => setPendingAvailabilityChanges(changes)}
          shopId={shopId}
        />
      )}
    </ThemedView>
  );
}
