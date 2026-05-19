import { View } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useCustomerServiceTab } from "../../feature-tab/hooks";
import { CustomerTabBar } from "../../feature-tab/components";
import ServicesTabContent from "../../services-tab/components/ServicesTabContent";
import FavoritesTabContent from "../../feature-tab/components/FavoritesTabContent";
import BookingsTabContent from "../../booking-tab/components/BookingsTabContent";

export default function CustomerServiceScreen() {
  const { activeTab, setActiveTab } = useCustomerServiceTab();

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 flex-1">
        <CustomerTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "Services" && <ServicesTabContent />}
        {activeTab === "Favorites" && <FavoritesTabContent />}
        {activeTab === "Bookings" && <BookingsTabContent />}
      </View>
    </ThemedView>
  );
}
