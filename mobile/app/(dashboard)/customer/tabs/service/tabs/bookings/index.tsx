import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import React from "react";
import { useBooking } from "@/hooks/booking/useBooking";
import { BookingData, BookingStatus } from "@/interfaces/booking.interfaces";
import { Ionicons } from "@expo/vector-icons";
import ServiceCard from "@/components/shared/ServiceCard";

const getStatusStyle = (status: BookingStatus) => {
  switch (status) {
    case "pending":
      return { bgColor: "bg-yellow-900/30", textColor: "text-yellow-500" };
    case "paid":
      return { bgColor: "bg-blue-900/30", textColor: "text-blue-500" };
    case "completed":
      return { bgColor: "bg-green-900/30", textColor: "text-green-500" };
    case "cancelled":
      return { bgColor: "bg-red-900/30", textColor: "text-red-500" };
    case "refunded":
      return { bgColor: "bg-gray-900/30", textColor: "text-gray-500" };
    default:
      return { bgColor: "bg-gray-900/30", textColor: "text-gray-500" };
  }
};

export default function BookingsTab() {
  const { useCustomerBookingQuery } = useBooking();
  const { data: bookingsData, isLoading, error, refetch } = useCustomerBookingQuery();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleBookingPress = (item: BookingData) => {
    // TODO: Navigate to booking detail
    console.log("Booking pressed:", item.orderId);
  };

  const renderBookingItem = ({ item }: { item: BookingData }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <ServiceCard
        imageUrl={null}
        category={item.serviceCategory}
        title={item.serviceName}
        description={item.serviceDescription}
        price={item.totalAmount}
        date={item.bookingDate}
        status={{
          label: item.status,
          bgColor: statusStyle.bgColor,
          textColor: statusStyle.textColor,
        }}
        onPress={() => handleBookingPress(item)}
      />
    );
  };

  return (
    <React.Fragment>
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500">Failed to load bookings</Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-2">
            <Text className="text-[#FFCC00]">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookingsData || []}
          keyExtractor={(item, index) => `${item.orderId}-${index}`}
          renderItem={renderBookingItem}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20">
              <Ionicons name="calendar-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                No bookings yet
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                Your bookings will appear here
              </Text>
            </View>
          }
        />
      )}
    </React.Fragment>
  );
}
