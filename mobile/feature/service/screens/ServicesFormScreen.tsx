import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Modal,
  FlatList,
  Switch,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Components
import { ThemedView } from "@/components/ui/ThemedView";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SubscriptionModal from "@/components/shop/SubscriptionModal";
import { AvailabilityModal } from "../components/AvailabilityModal";

// Feature imports
import {
  useServiceFormData,
  useServiceFormUI,
  useServiceNavigation,
} from "../hooks";

export default function ServicesFormScreen() {
  const params = useLocalSearchParams();
  const isEditMode = params.mode === "edit";
  const serviceId = params.serviceId as string;
  const serviceDataString = params.data as string;

  // Hooks
  const { navigateBack, navigateToSubscription } = useServiceNavigation();
  const { shopId, isQualified } = useServiceFormData();
  const {
    formData,
    updateFormField,
    selectedImage,
    filteredCategories,
    selectedCategory,
    handleCategorySelect,
    categoryModalVisible,
    openCategoryModal,
    closeCategoryModal,
    handleImagePick,
    removeImage,
    isUploading,
    showAvailability,
    openAvailabilityModal,
    closeAvailabilityModal,
    setPendingAvailabilityChanges,
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
    isSubmitting,
    submitForm,
  } = useServiceFormUI(isEditMode, serviceDataString, shopId);

  const handleSubmit = () => {
    submitForm({
      isQualified,
      isEditMode,
      serviceId,
      onNotQualified: openSubscriptionModal,
      onSuccess: navigateBack,
    });
  };

  return (
    <ThemedView className="h-full w-full">
      {/* Header */}
      <LinearGradient
        colors={["#2A2A2C", "#1A1A1C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingTop: Platform.OS === "ios" ? 60 : 50,
          paddingBottom: 20,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row justify-between items-center">
          <TouchableOpacity
            onPress={navigateBack}
            className="w-10 h-10 rounded-full bg-[#333] items-center justify-center"
          >
            <AntDesign name="left" color="white" size={18} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            {isEditMode ? "Edit Service" : "Add New Service"}
          </Text>
          <View className="w-10" />
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Service Details Section */}
        <SectionHeader
          icon={<Feather name="info" size={16} color="#000" />}
          title="Service Details"
        />

        {/* Service Name */}
        <FormInput
          label="Service Name *"
          placeholder="e.g., Oil Change Service"
          value={formData.serviceName}
          onChangeText={(text) => updateFormField("serviceName", text)}
          icon={<Ionicons name="create-outline" size={20} color="#FFCC00" />}
        />

        {/* Category */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Category *
          </Text>
          <TouchableOpacity onPress={openCategoryModal} activeOpacity={0.7}>
            <View className="flex-row items-center rounded-xl px-4 py-3 bg-[#2A2A2C]">
              <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
                <Ionicons name="grid-outline" size={20} color="#000" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-base">
                  {selectedCategory?.label || "Select a category"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Description */}
        <FormInput
          label="Short Description *"
          placeholder="Brief description of your service"
          value={formData.description}
          onChangeText={(text) => updateFormField("description", text)}
          icon={
            <Ionicons name="document-text-outline" size={20} color="#FFCC00" />
          }
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ height: 80, paddingTop: 12 }}
        />

        {/* Pricing Section */}
        <SectionHeader
          icon={<Feather name="dollar-sign" size={16} color="#000" />}
          title="Pricing"
        />

        {/* Price */}
        <FormInput
          label="Price (USD) *"
          placeholder="0.00"
          value={formData.priceUsd}
          onChangeText={(text) => updateFormField("priceUsd", text)}
          keyboardType="decimal-pad"
          icon={<Ionicons name="cash-outline" size={20} color="#FFCC00" />}
        />

        {/* Media Section */}
        <SectionHeader
          icon={<Feather name="image" size={16} color="#000" />}
          title="Media"
        />

        {/* Image Upload */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Service Image
          </Text>
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
                        removeImage();
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

        {/* Settings Section */}
        <SectionHeader
          icon={<Feather name="settings" size={16} color="#000" />}
          title="Settings"
        />

        {/* Tags */}
        <FormInput
          label="Tags (Optional)"
          placeholder="e.g., maintenance, quick-service (comma separated)"
          value={formData.tags}
          onChangeText={(text) => updateFormField("tags", text)}
          icon={<Ionicons name="pricetags-outline" size={20} color="#FFCC00" />}
          helperText="Separate tags with commas"
        />

        {/* Service Status */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Service Status
          </Text>
          <View className="flex-row items-center rounded-xl px-4 py-3 bg-[#2A2A2C]">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                formData.active ? "bg-green-500/20" : "bg-red-500/20"
              }`}
            >
              <Ionicons
                name={formData.active ? "checkmark-circle" : "close-circle"}
                size={20}
                color={formData.active ? "#22c55e" : "#ef4444"}
              />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">
                {formData.active ? "Active" : "Inactive"}
              </Text>
              <Text className="text-gray-500 text-xs">
                {formData.active
                  ? "Service is visible to customers"
                  : "Service is hidden from customers"}
              </Text>
            </View>
            <Switch
              value={formData.active}
              onValueChange={(value) => updateFormField("active", value)}
              trackColor={{ false: "#374151", true: "#22c55e" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Availability Settings */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Availability
          </Text>
          <TouchableOpacity
            onPress={openAvailabilityModal}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center rounded-xl px-4 py-3 bg-[#2A2A2C]">
              <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
                <Ionicons name="time-outline" size={20} color="#000" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">
                  Availability Settings
                </Text>
                <Text className="text-gray-500 text-xs">
                  Set operating hours, booking slots & holidays
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Fixed Bottom Button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
        style={{
          backgroundColor: "#121212",
          borderTopWidth: 1,
          borderTopColor: "#2A2A2C",
        }}
      >
        <PrimaryButton
          title={isEditMode ? "Update Service" : "Create Service"}
          onPress={handleSubmit}
          loading={isSubmitting}
        />
      </View>

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={closeCategoryModal}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-gray-900 rounded-t-3xl max-h-[60%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
              <Text className="text-white text-lg font-semibold">
                Select Category
              </Text>
              <TouchableOpacity onPress={closeCategoryModal}>
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
          onClose={closeAvailabilityModal}
          onSave={(changes) => setPendingAvailabilityChanges(changes)}
          shopId={shopId}
        />
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={closeSubscriptionModal}
        onSubscribe={() => {
          closeSubscriptionModal();
          navigateToSubscription();
        }}
      />
    </ThemedView>
  );
}
