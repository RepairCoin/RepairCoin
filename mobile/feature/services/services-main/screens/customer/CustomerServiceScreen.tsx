import { View } from "react-native";
import GradientHeader from "@/shared/components/ui/GradientHeader";
import { useCustomerServiceTab } from "../../feature-tab/hooks";
import { CustomerTabBar } from "../../feature-tab/components";
import ServicesTabContent from "../../services-tab/components/ServicesTabContent";
import FavoritesTabContent from "../../feature-tab/components/FavoritesTabContent";
import BookingsTabContent from "../../booking-tab/components/BookingsTabContent";

export default function CustomerServiceScreen() {
  const { activeTab, setActiveTab } = useCustomerServiceTab();

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Reuse the home page's gold→black gradient theme header. */}
      <GradientHeader title="Services" />

      <View className="flex-1 px-4 pt-4 gap-4">
        <CustomerTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "Services" && <ServicesTabContent />}
        {activeTab === "Favorites" && <FavoritesTabContent />}
        {activeTab === "Bookings" && <BookingsTabContent />}
      </View>
    </View>
  );
}
