import React, { useState } from "react";
import { View, Text, Pressable, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Components
import { ThemedView } from "@/shared/components/ui/ThemedView";
import {
  ServiceActionModal,
  ShopServiceDetailsModal,
  AddServiceFab,
} from "../components";
import { ManualBookingModal } from "@/feature/booking/components";

// Store
import { useAuthStore } from "@/shared/store/auth.store";

// Hooks
import {
  useServiceTabUI,
  useServiceStatusUI,
  useServiceNavigation,
} from "../hooks/ui";

// Feature
import ServicesTab from "@/feature/service/components/ServicesTab";
import { BookingShopTab } from "@/feature/booking/components";

// Constants
import { SERVICE_TABS } from "../constants";

export default function ShopServiceScreen() {
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  const {
    activeTab,
    setActiveTab,
    actionModalVisible,
    selectedService,
    closeActionModal,
    setActionModalVisible,
    setSelectedService,
    updateSelectedService,
  } = useServiceTabUI();

  const { isUpdating, handleToggleStatus } = useServiceStatusUI();
  const { handleEdit, handleAddService } = useServiceNavigation();

  const handleViewDetails = () => {
    closeActionModal();
    setShowDetailsModal(true);
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 flex-1">
        {/* Tab Selector */}
        <View className="flex-row w-full h-10 bg-[#121212] rounded-lg">
          {SERVICE_TABS.map((tab, i) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 items-center justify-center ${
                activeTab === tab ? "bg-[#FFCC00]" : "bg-[#121212]"
              } ${i === 0 ? "rounded-l-lg" : "rounded-r-lg"}`}
            >
              <Text
                className={`text-base font-bold ${
                  activeTab === tab ? "text-black" : "text-gray-400"
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "Services" && (
          <ServicesTab
            setActionModalVisible={setActionModalVisible}
            setSelectedService={setSelectedService}
          />
        )}
        {activeTab === "Booking" && <BookingShopTab />}
      </View>

      {/* Add Service FAB - show when Services tab */}
      {activeTab === "Services" && <AddServiceFab onPress={handleAddService} />}

      {/* Manual Booking FAB - show when Booking tab */}
      {activeTab === "Booking" && (
        <TouchableOpacity
          onPress={() => setShowManualBookingModal(true)}
          className="absolute bottom-6 right-4 w-14 h-14 rounded-full bg-[#FFCC00] items-center justify-center"
          style={{
            shadowColor: "#FFCC00",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      )}

      {/* Manual Booking Modal */}
      {shopId && (
        <ManualBookingModal
          visible={showManualBookingModal}
          onClose={() => setShowManualBookingModal(false)}
          shopId={shopId}
        />
      )}

      {/* Service Action Modal */}
      <ServiceActionModal
        visible={actionModalVisible}
        service={selectedService}
        isUpdating={isUpdating}
        onClose={closeActionModal}
        onEdit={() => handleEdit(selectedService, closeActionModal)}
        onToggleStatus={(value) =>
          handleToggleStatus(selectedService, value, updateSelectedService)
        }
        onViewDetails={handleViewDetails}
      />

      {/* Service Details Modal */}
      <ShopServiceDetailsModal
        visible={showDetailsModal}
        service={selectedService}
        onClose={() => setShowDetailsModal(false)}
      />
    </ThemedView>
  );
}
