import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native";
import React from "react";
import { useBooking } from "@/hooks/booking/useBooking";
import { BookingData, BookingStatus } from "@/interfaces/booking.interfaces";
import { Ionicons } from "@expo/vector-icons";
import ServiceCard from "@/components/shared/ServiceCard";

type ViewMode = "grid" | "list";

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

function ListHeader({
  viewMode,
  onToggle,
  searchQuery,
  onSearchChange,
}: {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <View className="mb-2">
      <View className="flex-row items-center gap-2">
        {/* Search Input */}
        <View className="flex-1 flex-row items-center bg-zinc-800 rounded-full px-3 py-3.5">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white ml-2"
            placeholder="Search bookings..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* View Toggle */}
        <View className="flex-row bg-zinc-800 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => onToggle("grid")}
            className={`px-3 py-2.5 rounded-md ${viewMode === "grid" ? "bg-[#FFCC00]" : ""}`}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={viewMode === "grid" ? "#000" : "#9CA3AF"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onToggle("list")}
            className={`px-3 py-2.5 rounded-md ${viewMode === "list" ? "bg-[#FFCC00]" : ""}`}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={viewMode === "list" ? "#000" : "#9CA3AF"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function BookingsTab() {
  const { useCustomerBookingQuery } = useBooking();
  const { data: bookingsData, isLoading, error, refetch } = useCustomerBookingQuery();

  const [refreshing, setRefreshing] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter bookings based on search query
  const filteredBookings = React.useMemo(() => {
    if (!bookingsData || !searchQuery.trim()) return bookingsData || [];

    const query = searchQuery.toLowerCase();
    return bookingsData.filter(
      (booking) =>
        booking.serviceName.toLowerCase().includes(query) ||
        booking.serviceCategory.toLowerCase().includes(query) ||
        booking.status.toLowerCase().includes(query)
    );
  }, [bookingsData, searchQuery]);

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
        imageUrl={item.serviceImageUrl}
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
        statusPosition="image"
        onPress={() => handleBookingPress(item)}
        variant={viewMode}
      />
    );
  };

  const EmptyComponent = (
    <View className="flex-1 justify-center items-center pt-20">
      <Ionicons name="calendar-outline" size={64} color="#666" />
      <Text className="text-gray-400 text-center mt-4">No bookings yet</Text>
      <Text className="text-gray-500 text-sm text-center mt-2">
        Your bookings will appear here
      </Text>
    </View>
  );

  return (
    <View className="flex-1">
      {/* Sticky Header */}
      <ListHeader
        viewMode={viewMode}
        onToggle={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

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
      ) : viewMode === "grid" ? (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item, index) => `${item.orderId}-${index}`}
          renderItem={renderBookingItem}
          numColumns={2}
          key="grid"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
            />
          }
          ListEmptyComponent={EmptyComponent}
        />
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item, index) => `${item.orderId}-${index}`}
          renderItem={renderBookingItem}
          key="list"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
            />
          }
          ListEmptyComponent={EmptyComponent}
        />
      )}
    </View>
  );
}
