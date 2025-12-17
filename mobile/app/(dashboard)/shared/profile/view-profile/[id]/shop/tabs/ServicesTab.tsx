import { Ionicons } from "@expo/vector-icons";
import { Text, View, ActivityIndicator } from "react-native";
import { useService } from "@/hooks/service/useService";
import ServiceCard from "@/components/shared/ServiceCard";
import { ServiceData } from "@/interfaces/service.interface";
import { useRouter } from "expo-router";

interface ServicesTabProps {
  shopId: string;
}

export default function ServicesTab({ shopId }: ServicesTabProps) {
  const router = useRouter();
  const { useShopServicesQuery } = useService();
  const { data: services, isLoading } = useShopServicesQuery({ shopId, page: 1, limit: 20 });

  const handleServicePress = (serviceId: string) => {
    router.push(`/customer/service/${serviceId}`);
  };

  if (isLoading) {
    return (
      <View className="items-center justify-center py-12">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading services...</Text>
      </View>
    );
  }

  if (!services || services.length === 0) {
    return (
      <View className="px-4">
        <View className="items-center justify-center py-12">
          <Ionicons name="construct-outline" size={48} color="#666" />
          <Text className="text-gray-400 text-lg mt-4">No services yet</Text>
          <Text className="text-gray-500 text-sm mt-1">
            This shop hasn't added any services
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="px-2">
      <View className="flex-row flex-wrap">
        {services.map((service: ServiceData) => (
          <View key={service.serviceId} className="w-1/2">
            <ServiceCard
              imageUrl={service.imageUrl}
              category={service.category}
              title={service.serviceName}
              description={service.description}
              price={service.priceUsd}
              duration={service.durationMinutes}
              onPress={() => handleServicePress(service.serviceId)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
