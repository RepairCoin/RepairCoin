import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useShops } from "@/hooks";
import { ShopData } from "@/interfaces/shop.interface";
import { useState, useEffect, useMemo, useRef } from "react";
import MapView, { Marker, Region, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";

// No default - will use user's actual location

type ViewMode = "map" | "list";

interface ShopWithLocation extends ShopData {
  lat?: number;
  lng?: number;
  distance?: number;
  hasValidLocation: boolean;
}

export default function FindShop() {
  const { data: shops, isLoading } = useShops();
  const mapRef = useRef<MapView>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<ShopWithLocation | null>(
    null
  );
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [initialMapRegion, setInitialMapRegion] = useState<Region | null>(null);

  // Request location permission and get user's location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          setLocationLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        console.log("Got user location:", location.coords.latitude, location.coords.longitude);

        setUserLocation(location);
        setInitialMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch (error) {
        console.log("Error getting location:", error);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Process shops with location data and distances
  const shopsWithLocation = useMemo(() => {
    if (!shops?.shops) return [];

    return shops.shops
      .map((shop: ShopData) => {
        // Get location from shop's location object
        const shopLocation = shop.location;
        const lat = shopLocation?.lat ? parseFloat(shopLocation.lat) : undefined;
        const lng = shopLocation?.lng ? parseFloat(shopLocation.lng) : undefined;

        // Check if location is valid (has both lat and lng with actual values)
        const hasValidLocation = !!(lat && lng && !isNaN(lat) && !isNaN(lng));

        let distance: number | undefined;
        if (userLocation && hasValidLocation && lat && lng) {
          distance = calculateDistance(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            lat,
            lng
          );
        }

        return {
          ...shop,
          lat,
          lng,
          distance,
          hasValidLocation,
        } as ShopWithLocation;
      })
      .sort((a: ShopWithLocation, b: ShopWithLocation) => {
        // Shops with valid locations come first
        if (a.hasValidLocation && !b.hasValidLocation) return -1;
        if (!a.hasValidLocation && b.hasValidLocation) return 1;
        // Then sort by distance
        if (a.distance && b.distance) return a.distance - b.distance;
        return 0;
      });
  }, [shops, userLocation]);

  // Filter shops based on search query
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shopsWithLocation;

    const query = searchQuery.toLowerCase();
    return shopsWithLocation.filter(
      (shop: ShopWithLocation) =>
        shop.name?.toLowerCase().includes(query) ||
        shop.address?.toLowerCase().includes(query)
    );
  }, [shopsWithLocation, searchQuery]);

  // Center map on first shop with valid location if user location is not available
  useEffect(() => {
    if (!locationLoading && !initialMapRegion && shopsWithLocation.length > 0) {
      const firstShopWithLocation = shopsWithLocation.find(
        (shop: ShopWithLocation) => shop.hasValidLocation
      );
      if (firstShopWithLocation?.lat && firstShopWithLocation?.lng) {
        setInitialMapRegion({
          latitude: firstShopWithLocation.lat,
          longitude: firstShopWithLocation.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    }
  }, [locationLoading, initialMapRegion, shopsWithLocation]);

  // Handle marker press
  const handleMarkerPress = (shop: ShopWithLocation) => {
    setSelectedShop(shop);
    if (shop.lat && shop.lng && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: shop.lat,
          longitude: shop.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        300
      );
    }
  };

  // Center map on user location
  const centerOnUserLocation = () => {
    if (initialMapRegion && mapRef.current) {
      mapRef.current.animateToRegion(initialMapRegion, 300);
    }
  };

  // Handle shop card press
  const handleShopCardPress = (item: ShopWithLocation) => {
    if (!item.hasValidLocation) {
      Alert.alert(
        "Location Unavailable",
        `${item.name || "This shop"} doesn't have map coordinates yet.`,
        [{ text: "OK" }]
      );
      return;
    }

    setSelectedShop(item);
    setViewMode("map");
    if (item.lat && item.lng && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: item.lat,
          longitude: item.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        300
      );
    }
  };

  // Render shop card for list view
  const renderShopCard = ({ item }: { item: ShopWithLocation }) => (
    <Pressable
      onPress={() => handleShopCardPress(item)}
      className="bg-zinc-800 rounded-2xl p-4 mb-3"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-white text-lg font-semibold flex-1" numberOfLines={1}>
              {item.name || "Unknown Shop"}
            </Text>
            {!item.hasValidLocation && (
              <View className="bg-zinc-700 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-gray-400 text-xs">No location</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
            {item.address || "No address available"}
          </Text>
        </View>
        {item.distance && item.hasValidLocation && (
          <View className="bg-[#FFCC00]/20 px-3 py-1 rounded-full ml-2">
            <Text className="text-[#FFCC00] text-sm font-medium">
              {item.distance.toFixed(1)} mi
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center mt-3 gap-4">
        {item.verified && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text className="text-green-500 text-xs ml-1">Verified</Text>
          </View>
        )}
        {item.crossShopEnabled && (
          <View className="flex-row items-center">
            <Ionicons name="swap-horizontal" size={16} color="#60A5FA" />
            <Text className="text-blue-400 text-xs ml-1">Cross-shop</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  // Selected shop popup for map view
  const ShopPopup = ({ shop }: { shop: ShopWithLocation }) => (
    <View className="absolute bottom-24 left-5 right-5">
      <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700">
        <Pressable
          onPress={() => setSelectedShop(null)}
          className="absolute top-2 right-2 z-10"
        >
          <Ionicons name="close-circle" size={24} color="#9CA3AF" />
        </Pressable>

        <View className="flex-row items-start">
          <View className="bg-[#FFCC00] w-12 h-12 rounded-full items-center justify-center mr-3">
            <Feather name="tool" size={24} color="#000" />
          </View>
          <View className="flex-1">
            <Text
              className="text-white text-lg font-semibold"
              numberOfLines={1}
            >
              {shop.name || "Unknown Shop"}
            </Text>
            <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
              {shop.address || "No address available"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3 gap-4">
          {shop.distance && (
            <View className="flex-row items-center">
              <Ionicons name="location" size={16} color="#FFCC00" />
              <Text className="text-gray-300 text-sm ml-1">
                {shop.distance.toFixed(1)} mi away
              </Text>
            </View>
          )}
          {shop.verified && (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text className="text-green-500 text-sm ml-1">Verified</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-3 mt-4">
          <Pressable className="flex-1 bg-zinc-800 py-3 rounded-full flex-row items-center justify-center">
            <Ionicons name="call" size={18} color="#FFCC00" />
            <Text className="text-[#FFCC00] font-semibold ml-2">Call</Text>
          </Pressable>
          <Pressable className="flex-1 bg-[#FFCC00] py-3 rounded-full flex-row items-center justify-center">
            <Ionicons name="navigate" size={18} color="#000" />
            <Text className="text-black font-semibold ml-2">Directions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 px-4 pb-4 bg-zinc-950 z-10">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-semibold">Find Shop</Text>
          {/* View Mode Toggle */}
          <View className="flex-row bg-zinc-800 rounded-full p-1">
            <Pressable
              onPress={() => setViewMode("map")}
              className={`px-4 py-1.5 rounded-full ${
                viewMode === "map" ? "bg-[#FFCC00]" : ""
              }`}
            >
              <Ionicons
                name="map"
                size={18}
                color={viewMode === "map" ? "#000" : "#9CA3AF"}
              />
            </Pressable>
            <Pressable
              onPress={() => setViewMode("list")}
              className={`px-4 py-1.5 rounded-full ${
                viewMode === "list" ? "bg-[#FFCC00]" : ""
              }`}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === "list" ? "#000" : "#9CA3AF"}
              />
            </Pressable>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-zinc-800 rounded-full px-4 py-3">
          <Feather name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white ml-3"
            placeholder="Search shops..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Results count */}
        {searchQuery.length > 0 && (
          <Text className="text-gray-400 text-sm mt-2">
            {filteredShops.length} shop{filteredShops.length !== 1 ? "s" : ""}{" "}
            found
          </Text>
        )}
      </View>

      {/* Loading State */}
      {isLoading || locationLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">
            {locationLoading ? "Getting your location..." : "Loading shops..."}
          </Text>
        </View>
      ) : !initialMapRegion ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="location-outline" size={64} color="#666" />
          <Text className="text-gray-400 text-center mt-4">
            Location permission required
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Please enable location access to find shops near you
          </Text>
        </View>
      ) : viewMode === "map" ? (
        /* Map View */
        <View className="flex-1">
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialMapRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {filteredShops
              .filter((shop: ShopWithLocation) => shop.hasValidLocation)
              .map((shop: ShopWithLocation) => (
                <Marker
                  key={shop.shopId}
                  coordinate={{ latitude: shop.lat!, longitude: shop.lng! }}
                  title={shop.name}
                  description={shop.address}
                  onPress={() => handleMarkerPress(shop)}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      selectedShop?.shopId === shop.shopId
                        ? "bg-[#FFCC00]"
                        : "bg-zinc-800 border-2 border-[#FFCC00]"
                    }`}
                  >
                    <Feather
                      name="tool"
                      size={18}
                      color={
                        selectedShop?.shopId === shop.shopId
                          ? "#000"
                          : "#FFCC00"
                      }
                    />
                  </View>
                </Marker>
              ))}
          </MapView>

          {/* Center on user location button */}
          <Pressable
            onPress={centerOnUserLocation}
            className="absolute right-4 bottom-32 bg-zinc-900 w-12 h-12 rounded-full items-center justify-center border border-zinc-700"
          >
            <Ionicons name="locate" size={24} color="#FFCC00" />
          </Pressable>

          {/* Selected shop popup */}
          {selectedShop && <ShopPopup shop={selectedShop} />}

          {/* Shop count badge */}
          <View className="absolute top-4 left-4 bg-zinc-900/90 px-3 py-2 rounded-full">
            <Text className="text-white text-sm font-medium">
              {filteredShops.filter((s: ShopWithLocation) => s.hasValidLocation).length} shops on map
            </Text>
          </View>
        </View>
      ) : (
        /* List View */
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.shopId}
          renderItem={renderShopCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Ionicons name="storefront-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                {searchQuery.length > 0
                  ? "No shops match your search"
                  : "No shops available"}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {searchQuery.length > 0
                  ? "Try a different search term"
                  : "Check back later for new shops"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
