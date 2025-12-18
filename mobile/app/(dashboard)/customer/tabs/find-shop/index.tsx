import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
  Linking,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useShops } from "@/hooks";
import { ShopData } from "@/interfaces/shop.interface";
import { useState, useEffect, useMemo, useRef } from "react";
import MapView, { Marker, Region, PROVIDER_DEFAULT, Polyline, LatLng, Circle } from "react-native-maps";
import * as Location from "expo-location";
import {
  fetchRoute,
  metersToMiles,
  milesToMeters,
  formatDuration,
} from "@/providers/RouteProvider";

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
  const [geocodedShops, setGeocodedShops] = useState<Record<string, { lat: number; lng: number }>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isDirectionsPanelMinimized, setIsDirectionsPanelMinimized] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(1); // Default 1 miles radius

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

  // Geocode an address to get coordinates
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return {
          lat: results[0].latitude,
          lng: results[0].longitude,
        };
      }
    } catch (error) {
      console.log("Geocoding error for address:", address, error);
    }
    return null;
  };

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
        // Get location from shop's location object or geocoded cache
        const shopLocation = shop.location;
        const geocoded = geocodedShops[shop.shopId];

        let lat = shopLocation?.lat ? parseFloat(shopLocation.lat) : undefined;
        let lng = shopLocation?.lng ? parseFloat(shopLocation.lng) : undefined;

        // Use geocoded coordinates if available and original coords are missing
        if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && geocoded) {
          lat = geocoded.lat;
          lng = geocoded.lng;
        }

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
  }, [shops, userLocation, geocodedShops]);

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

  // Animate to pending region when map is ready
  useEffect(() => {
    if (pendingRegion && viewMode === "map" && mapRef.current) {
      // Small delay to ensure map is fully rendered
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(pendingRegion, 300);
        }
        setPendingRegion(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pendingRegion, viewMode]);

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

  // Helper to set pending region and switch to map view
  const navigateToShopOnMap = (lat: number, lng: number, shop: ShopWithLocation) => {
    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    setSelectedShop(shop);

    // If already in map view and map is ready, animate directly
    if (viewMode === "map" && mapRef.current) {
      mapRef.current.animateToRegion(region, 300);
    } else {
      // Switch to map view and set pending region for animation
      setPendingRegion(region);
      setViewMode("map");
    }
  };

  // Handle shop card press
  const handleShopCardPress = async (item: ShopWithLocation) => {
    // If shop already has valid location, navigate directly
    if (item.hasValidLocation && item.lat && item.lng) {
      navigateToShopOnMap(item.lat, item.lng, item);
      return;
    }

    // Try to geocode the address if no coordinates
    if (!item.address) {
      Alert.alert(
        "Location Unavailable",
        `${item.name || "This shop"} doesn't have an address to locate.`,
        [{ text: "OK" }]
      );
      return;
    }

    // Check if already geocoded
    if (geocodedShops[item.shopId]) {
      const coords = geocodedShops[item.shopId];
      const updatedShop = { ...item, lat: coords.lat, lng: coords.lng, hasValidLocation: true };
      navigateToShopOnMap(coords.lat, coords.lng, updatedShop);
      return;
    }

    // Geocode the address
    setIsGeocoding(true);
    const fullAddress = item.location?.city && item.location?.state
      ? `${item.address}, ${item.location.city}, ${item.location.state}`
      : item.address;

    const coords = await geocodeAddress(fullAddress);
    setIsGeocoding(false);

    if (coords) {
      // Cache the geocoded result
      setGeocodedShops((prev) => ({
        ...prev,
        [item.shopId]: coords,
      }));

      const updatedShop = { ...item, lat: coords.lat, lng: coords.lng, hasValidLocation: true };
      navigateToShopOnMap(coords.lat, coords.lng, updatedShop);
    } else {
      Alert.alert(
        "Location Not Found",
        `Could not find the location for ${item.name || "this shop"}. The address may be incomplete or invalid.`,
        [{ text: "OK" }]
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

  // Show in-app directions to shop
  const openDirections = async (shop: ShopWithLocation) => {
    if (!shop.lat || !shop.lng) {
      Alert.alert("Location Unavailable", "Cannot get directions without coordinates.");
      return;
    }

    if (!userLocation) {
      Alert.alert("Location Unavailable", "Your location is not available. Please enable location services.");
      return;
    }

    // Show directions mode and loading state
    setShowDirections(true);
    setIsLoadingRoute(true);
    setRouteCoordinates([]);

    // Fit map to show both user location and shop
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
          { latitude: shop.lat, longitude: shop.lng },
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        }
      );
    }

    // Fetch actual route from OpenRouteService
    const route = await fetchRoute(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      shop.lat,
      shop.lng
    );

    setIsLoadingRoute(false);

    if (route) {
      setRouteCoordinates(route.coordinates);
      setRouteDistance(route.distance);
      setRouteDuration(route.duration);
    } else {
      // Fallback to straight line if route fetch fails
      setRouteCoordinates([
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        { latitude: shop.lat, longitude: shop.lng },
      ]);
      // Use the calculated straight-line distance as fallback
      setRouteDistance(null);
      setRouteDuration(null);
    }
  };

  // Close directions mode
  const closeDirections = () => {
    setShowDirections(false);
    setRouteCoordinates([]);
    setRouteDistance(null);
    setRouteDuration(null);
    setIsDirectionsPanelMinimized(false);
  };

  // Open phone dialer
  const openPhoneDialer = (shop: ShopWithLocation) => {
    const phoneNumber = shop.phone;
    if (!phoneNumber) {
      Alert.alert("Phone Unavailable", "This shop doesn't have a phone number listed.");
      return;
    }

    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Cannot Make Call", "Your device doesn't support phone calls.");
      }
    });
  };

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
          <Pressable
            onPress={() => openPhoneDialer(shop)}
            className="flex-1 bg-zinc-800 py-3 rounded-full flex-row items-center justify-center"
          >
            <Ionicons name="call" size={18} color="#FFCC00" />
            <Text className="text-[#FFCC00] font-semibold ml-2">Call</Text>
          </Pressable>
          <Pressable
            onPress={() => openDirections(shop)}
            className="flex-1 bg-[#FFCC00] py-3 rounded-full flex-row items-center justify-center"
          >
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
      <View className="pt-16 px-4 pb-4 bg-zinc-950 z-10">
        <View className="flex-row justify-between items-center">
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
      </View>

      {/* Geocoding Overlay */}
      {isGeocoding && (
        <View className="absolute inset-0 bg-black/50 z-50 items-center justify-center">
          <View className="bg-zinc-900 rounded-2xl p-6 items-center">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-white mt-3">Finding location...</Text>
          </View>
        </View>
      )}

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
            {/* Dynamic radius circle around user location */}
            {userLocation && (
              <Circle
                center={{
                  latitude: userLocation.coords.latitude,
                  longitude: userLocation.coords.longitude,
                }}
                radius={milesToMeters(radiusMiles)}
                strokeColor="rgba(255, 204, 0, 0.8)"
                strokeWidth={2}
                fillColor="rgba(255, 204, 0, 0.1)"
              />
            )}

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

            {/* Directions route line */}
            {showDirections && routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#FFCC00"
                strokeWidth={5}
              />
            )}
          </MapView>

          {/* Center on user location button */}
          <Pressable
            onPress={centerOnUserLocation}
            className="absolute right-4 bottom-12 bg-zinc-900 w-12 h-12 rounded-full items-center justify-center border border-zinc-700"
          >
            <Ionicons name="locate" size={24} color="#FFCC00" />
          </Pressable>

          {/* Directions Floating Button (Minimized) */}
          {showDirections && selectedShop && isDirectionsPanelMinimized && (
            <Pressable
              onPress={() => setIsDirectionsPanelMinimized(false)}
              className="absolute bottom-24 mx-20 bg-[#FFCC00] rounded-2xl px-4 py-3 flex-row items-center"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}
            >
              <View className="bg-black/20 w-10 h-10 rounded-full items-center justify-center mr-3">
                <Ionicons name="navigate" size={20} color="#000" />
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-black font-bold" numberOfLines={1}>
                  {selectedShop.name || "Navigation"}
                </Text>
                <Text className="text-black/70 text-sm">
                  {routeDistance
                    ? `${metersToMiles(routeDistance).toFixed(1)} mi`
                    : selectedShop.distance
                      ? `${selectedShop.distance.toFixed(1)} mi`
                      : ""
                  }
                  {routeDuration ? ` • ${formatDuration(routeDuration)}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-up" size={20} color="#000" />
            </Pressable>
          )}

          {/* Directions Panel (Expanded) */}
          {showDirections && selectedShop && !isDirectionsPanelMinimized && (
            <View className="absolute bottom-24 left-5 right-5">
              <View className="bg-zinc-900 rounded-2xl p-4 border border-[#FFCC00]">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <View className="bg-[#FFCC00] w-8 h-8 rounded-full items-center justify-center mr-2">
                      <Ionicons name="navigate" size={16} color="#000" />
                    </View>
                    <Text className="text-[#FFCC00] font-semibold">Navigation</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setIsDirectionsPanelMinimized(true)}
                      className="bg-zinc-800 p-2 rounded-full"
                    >
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      onPress={closeDirections}
                      className="bg-zinc-800 px-3 py-1.5 rounded-full"
                    >
                      <Text className="text-gray-300 text-sm">Exit</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Destination Info */}
                <View className="bg-zinc-800 rounded-xl p-3">
                  <Text className="text-gray-400 text-xs mb-1">Destination</Text>
                  <Text className="text-white font-semibold" numberOfLines={1}>
                    {selectedShop.name || "Unknown Shop"}
                  </Text>
                  <Text className="text-gray-400 text-sm mt-1" numberOfLines={1}>
                    {selectedShop.address || "No address"}
                  </Text>
                </View>

                {/* Route Info */}
                {isLoadingRoute ? (
                  <View className="flex-row items-center justify-center mt-3 bg-zinc-800 py-4 rounded-xl">
                    <ActivityIndicator size="small" color="#FFCC00" />
                    <Text className="text-gray-400 ml-2">Calculating route...</Text>
                  </View>
                ) : (
                  <View className="flex-row mt-3 gap-2">
                    {/* Distance */}
                    <View className="flex-1 bg-[#FFCC00]/20 py-3 rounded-xl items-center">
                      <Ionicons name="speedometer-outline" size={20} color="#FFCC00" />
                      <Text className="text-[#FFCC00] text-lg font-bold mt-1">
                        {routeDistance
                          ? `${metersToMiles(routeDistance).toFixed(1)} mi`
                          : selectedShop.distance
                            ? `${selectedShop.distance.toFixed(1)} mi`
                            : "N/A"
                        }
                      </Text>
                      <Text className="text-gray-400 text-xs">Distance</Text>
                    </View>
                    {/* Duration */}
                    <View className="flex-1 bg-[#FFCC00]/20 py-3 rounded-xl items-center">
                      <Ionicons name="time-outline" size={20} color="#FFCC00" />
                      <Text className="text-[#FFCC00] text-lg font-bold mt-1">
                        {routeDuration ? formatDuration(routeDuration) : "N/A"}
                      </Text>
                      <Text className="text-gray-400 text-xs">Est. Time</Text>
                    </View>
                  </View>
                )}

                {/* Hint */}
                <Text className="text-gray-500 text-xs text-center mt-3">
                  {routeCoordinates.length > 2
                    ? "Follow the yellow route on the map"
                    : "Route shown as direct path"
                  }
                </Text>
              </View>
            </View>
          )}

          {/* Selected shop popup (hidden when showing directions) */}
          {selectedShop && !showDirections && <ShopPopup shop={selectedShop} />}

          {/* Shop count and radius control */}
          <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between">
            {/* Shop count badge */}
            <View className="bg-zinc-900/90 px-3 py-2 rounded-full">
              <Text className="text-white text-sm font-medium">
                {filteredShops.filter((s: ShopWithLocation) => s.hasValidLocation && s.distance !== undefined && s.distance <= radiusMiles).length} shops within {radiusMiles} mi
              </Text>
            </View>

            {/* Radius control */}
            <View className="bg-zinc-900/90 rounded-full flex-row items-center">
              <Pressable
                onPress={() => setRadiusMiles(Math.max(1, radiusMiles - 1))}
                className="px-3 py-2"
              >
                <Ionicons name="remove" size={18} color="#FFCC00" />
              </Pressable>
              <View className="px-2 py-2 border-x border-zinc-700">
                <Text className="text-[#FFCC00] text-sm font-bold min-w-[40px] text-center">
                  {radiusMiles} mi
                </Text>
              </View>
              <Pressable
                onPress={() => setRadiusMiles(Math.min(20, radiusMiles + 1))}
                className="px-3 py-2"
              >
                <Ionicons name="add" size={18} color="#FFCC00" />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* List View */
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.shopId}
          renderItem={renderShopCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="mb-4">
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
                  {filteredShops.length} shop{filteredShops.length !== 1 ? "s" : ""} found
                </Text>
              )}
            </View>
          }
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
