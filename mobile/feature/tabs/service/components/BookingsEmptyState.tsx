import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BookingFilterTab } from "../types";

interface BookingsEmptyStateProps {
  filterTab: BookingFilterTab;
}

export function BookingsEmptyState({ filterTab }: BookingsEmptyStateProps) {
  const getEmptyStateText = () => {
    switch (filterTab) {
      case "upcoming":
        return {
          title: "No upcoming appointments",
          description: "Book a service to see your appointments here",
        };
      case "past":
        return {
          title: "No past appointments",
          description: "Your appointment history will appear here",
        };
      default:
        return {
          title: "No appointments yet",
          description: "Book a service to see your appointments here",
        };
    }
  };

  const { title, description } = getEmptyStateText();

  return (
    <View className="flex-1 justify-center items-center pt-20">
      <View className="bg-zinc-900 rounded-full p-6 mb-4">
        <Ionicons name="calendar-outline" size={48} color="#FFCC00" />
      </View>
      <Text className="text-white text-lg font-semibold mt-2">
        {title}
      </Text>
      <Text className="text-gray-500 text-sm text-center mt-2 px-8">
        {description}
      </Text>
    </View>
  );
}
