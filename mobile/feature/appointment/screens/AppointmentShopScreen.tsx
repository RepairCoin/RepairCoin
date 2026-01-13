import { View, Text, FlatList, ActivityIndicator } from "react-native";
import {
  AntDesign,
  Feather,
  Fontisto,
  MaterialCommunityIcons,
  Octicons,
} from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import HorizontalCard from "@/components/ui/HorizontalCard";
import { useShopBookingQuery } from "../hooks/queries";
import { BookingData } from "@/interfaces/booking.interfaces";
import { AppointmentCard } from "../components";

export default function AppointmentShopScreen() {
  const { data: bookingsData, isLoading, error } = useShopBookingQuery();

  const pending = bookingsData?.filter(
    (booking: BookingData) => booking.status === "pending"
  );
  const paid = bookingsData?.filter(
    (booking: BookingData) => booking.status === "paid"
  );
  const completed = bookingsData?.filter(
    (booking: BookingData) => booking.status === "completed"
  );
  const totalRevenue = bookingsData
    ?.filter(
      (booking: BookingData) =>
        booking.status === "paid" || booking.status === "completed"
    )
    .reduce((sum: number, booking: BookingData) => sum + booking.totalAmount, 0)
    .toFixed(2);

  const horizontalCardList: {
    label: string;
    Icon: any;
    number: number | string;
  }[] = [
    {
      label: "Pending",
      Icon: <Octicons name="people" color="#ffcc00" size={22} />,
      number: pending?.length || 0,
    },
    {
      label: "Paid",
      Icon: (
        <MaterialCommunityIcons
          name="hand-coin-outline"
          color="#ffcc00"
          size={22}
        />
      ),
      number: paid?.length || 0,
    },
    {
      label: "Completed",
      Icon: <Fontisto name="clock" color="#ffcc00" size={22} />,
      number: completed?.length || 0,
    },
    {
      label: "Total Revenue",
      Icon: <Feather name="user-check" color="#ffcc00" size={22} />,
      number: `$${totalRevenue || "0.00"}`,
    },
  ];

  const renderAppointmentCard = ({ item }: { item: BookingData }) => (
    <AppointmentCard
      serviceName={item.serviceName}
      customerAddress={item.customerAddress}
      customerName={item.customerName}
      status={item.status}
      totalAmount={item.totalAmount}
      createdAt={item.createdAt}
      onPress={() => {
        // TODO: Navigate to appointment details
      }}
    />
  );

  const renderEmptyList = () => (
    <View className="flex-1 items-center justify-center py-10">
      <Feather name="calendar" size={48} color="#666" />
      <Text className="text-[#666] text-lg mt-4">No appointments yet</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">Appointments</Text>
          <View className="w-[25px]" />
        </View>
      </View>

      <View className="flex-row flex-wrap my-4">
        {horizontalCardList.map((props, i) => (
          <View key={i} style={{ width: "50%" }}>
            <HorizontalCard {...props} />
          </View>
        ))}
      </View>

      <Text className="text-white text-lg font-semibold px-4 mb-3">
        Recent Appointments
      </Text>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ffcc00" />
        </View>
      ) : (
        <FlatList
          data={bookingsData}
          renderItem={renderAppointmentCard}
          keyExtractor={(item) => item.orderId}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
