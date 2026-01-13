import React from "react";
import { View, Text, Pressable } from "react-native";

// Components
import { ThemedView } from "@/components/ui/ThemedView";
import {
  ServiceActionModal,
  AddServiceFab,
} from "../components";

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

      {/* Add Service FAB */}
      <AddServiceFab onPress={handleAddService} />

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
      />
    </ThemedView>
  );
}
