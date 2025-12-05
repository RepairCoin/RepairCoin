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
                    <Ionicons name="cloud-upload-outline" size={32} color="#FFCC00" />
                  </View>
                  <Text className="text-white font-medium mb-1">
                    Uploading Image...
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Please wait
                  </Text>
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

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`bg-[#FFCC00] rounded-lg py-4 items-center ${
              isSubmitting ? "opacity-50" : ""
            }`}
          >
            <Text className="text-black font-semibold text-base">
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
      </ScrollView>

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
    </ThemedView>
  );
}
