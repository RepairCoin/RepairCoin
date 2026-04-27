import { View } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useCustomerServiceTab } from "../hooks";
import { CustomerTabBar } from "../components";
import ServicesTabContent from "./ServicesTabContent";
import FavoritesTabContent from "./FavoritesTabContent";
import BookingsTabContent from "./BookingsTabContent";

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
