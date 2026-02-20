import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { UpdateServiceData } from "@/shared/interfaces/service.interface";
import { useAuthStore } from "@/shared/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";
import {
  PendingAvailabilityChanges,
  ServiceFormData,
  SubmitFormParams,
} from "../../types";
import { useCreateServiceMutation, useUpdateServiceMutation } from "../mutations/useServiceMutations";
import { INITIAL_FORM_DATA } from "../../constants/INITIAL_FORM_DATA";

export function useServiceFormUI(
  isEditMode: boolean,
  serviceDataString: string | undefined,
  shopId: string | undefined
) {
  const queryClient = useQueryClient();
  const createServiceMutation = useCreateServiceMutation();
  const updateServiceMutation = useUpdateServiceMutation();

  // Form state
  const [formData, setFormData] = useState<ServiceFormData>(INITIAL_FORM_DATA);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);
  const [pendingAvailabilityChanges, setPendingAvailabilityChanges] =
    useState<PendingAvailabilityChanges | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Filter categories by search
  const filteredCategories = SERVICE_CATEGORIES.filter((cat) =>
    cat.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected category
  const selectedCategory = SERVICE_CATEGORIES.find(
    (cat) => cat.value === formData.category
  );

  // Update form field
  const updateFormField = useCallback(
    <K extends keyof ServiceFormData>(field: K, value: ServiceFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle category selection
  const handleCategorySelect = useCallback((categoryValue: string) => {
    setFormData((prev) => ({ ...prev, category: categoryValue }));
    setCategoryModalVisible(false);
    setSearchQuery("");
  }, []);

  // Upload image to server
  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      const filename = uri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

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
  }, []);

  // Handle image pick
  const handleImagePick = useCallback(async () => {
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
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setSelectedImage(localUri);

      const uploadedUrl = await uploadImage(localUri);

      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, imageUrl: uploadedUrl }));
      } else {
        setSelectedImage(null);
      }
    }
  }, [uploadImage]);

  // Remove selected image
  const removeImage = useCallback(() => {
    setSelectedImage(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    if (!formData.serviceName.trim()) {
      Alert.alert("Error", "Please enter a service name");
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return false;
    }
    if (!formData.priceUsd || parseFloat(formData.priceUsd) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return false;
    }
    return true;
  }, [formData]);

  // Save availability changes to the API
  const saveAvailabilityChanges = useCallback(
    async (pendingChanges: PendingAvailabilityChanges | null) => {
      if (!pendingChanges || !pendingChanges.hasChanges) {
        return;
      }

      const { availability, timeSlotConfig, dateOverrides } = pendingChanges;

      // Save availability for each day
      for (const day of availability) {
        try {
          await appointmentApi.updateShopAvailability({
            dayOfWeek: day.dayOfWeek,
            isOpen: day.isOpen,
            openTime: day.openTime || "09:00",
            closeTime: day.closeTime || "17:00",
            breakStartTime: day.breakStartTime || undefined,
            breakEndTime: day.breakEndTime || undefined,
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
            minBookingHours: timeSlotConfig.minBookingHours,
            allowWeekendBooking: timeSlotConfig.allowWeekendBooking,
          });
        } catch (error) {
          console.error("Failed to update time slot config:", error);
        }
      }

      // Save date overrides if provided
      if (dateOverrides && dateOverrides.length > 0) {
        for (const override of dateOverrides) {
          try {
            await appointmentApi.createDateOverride({
              overrideDate: override.overrideDate,
              isClosed: override.isClosed,
              customOpenTime: override.customOpenTime || undefined,
              customCloseTime: override.customCloseTime || undefined,
              reason: override.reason || undefined,
            });
          } catch (error) {
            console.error(
              `Failed to create date override for ${override.overrideDate}:`,
              error
            );
          }
        }
      }
    },
    []
  );

  // Create new service
  const createService = useCallback(
    async (onSuccess: () => void) => {
      setIsSubmitting(true);

      try {
        const tags = formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

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

        await createServiceMutation.mutateAsync({ serviceData: createData });
        await saveAvailabilityChanges(pendingAvailabilityChanges);

        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(shopId!),
        });

        Alert.alert("Success", "Service created successfully", [
          { text: "OK", onPress: onSuccess },
        ]);
      } catch (error) {
        console.error("Failed to create service:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, pendingAvailabilityChanges, shopId, createServiceMutation, saveAvailabilityChanges, queryClient]
  );

  // Update existing service
  const updateService = useCallback(
    async (serviceId: string, onSuccess: () => void) => {
      setIsSubmitting(true);

      try {
        const tags = formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);

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

        await updateServiceMutation.mutateAsync({ serviceId, serviceData: updateData });
        await saveAvailabilityChanges(pendingAvailabilityChanges);

        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(shopId!),
        });

        Alert.alert("Success", "Service updated successfully", [
          { text: "OK", onPress: onSuccess },
        ]);
      } catch (error) {
        console.error("Failed to update service:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, pendingAvailabilityChanges, shopId, updateServiceMutation, saveAvailabilityChanges, queryClient]
  );

  // Submit form handler - orchestrates the full submission flow
  const submitForm = useCallback(
    async ({
      isQualified,
      isEditMode: editMode,
      serviceId,
      onNotQualified,
      onSuccess,
    }: SubmitFormParams) => {
      if (!isQualified) {
        onNotQualified();
        return;
      }

      if (!validateForm()) {
        return;
      }

      if (editMode && serviceId) {
        await updateService(serviceId, onSuccess);
      } else {
        await createService(onSuccess);
      }
    },
    [validateForm, createService, updateService]
  );

  // Modal handlers
  const openCategoryModal = useCallback(() => setCategoryModalVisible(true), []);
  const closeCategoryModal = useCallback(() => {
    setCategoryModalVisible(false);
    setSearchQuery("");
  }, []);
  const openAvailabilityModal = useCallback(() => setShowAvailability(true), []);
  const closeAvailabilityModal = useCallback(() => setShowAvailability(false), []);
  const openSubscriptionModal = useCallback(() => setShowSubscriptionModal(true), []);
  const closeSubscriptionModal = useCallback(() => setShowSubscriptionModal(false), []);

  return {
    // Form data
    formData,
    updateFormField,
    selectedImage,
    setSelectedImage,
    // Category
    filteredCategories,
    selectedCategory,
    handleCategorySelect,
    categoryModalVisible,
    openCategoryModal,
    closeCategoryModal,
    searchQuery,
    setSearchQuery,
    // Image
    handleImagePick,
    removeImage,
    isUploading,
    // Availability
    showAvailability,
    openAvailabilityModal,
    closeAvailabilityModal,
    pendingAvailabilityChanges,
    setPendingAvailabilityChanges,
    // Subscription
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    // Validation & Submission
    validateForm,
    isSubmitting,
    submitForm,
  };
}
