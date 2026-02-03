import { View, Text, ActivityIndicator, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT, Polyline, Circle } from "react-native-maps";
import WebViewMap, { MarkerData } from "@/shared/components/maps/WebViewMap";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { useFindShop } from "../hooks";
import { ShopWithLocation } from "../types";
import {
  ShopCard,
  ShopPopupMinimized,
  ShopPopupExpanded,
  DirectionsPanelMinimized,
  DirectionsPanelExpanded,
  RadiusControl,
  CenterLocationButton,
  ViewModeToggle,
} from "../components";

export default function FindShopScreen() {
  const {
    mapRef,
    webViewMapRef,
    isAndroid,
    isLoading,
    locationLoading,
    filteredShops,
    shopsInRadius,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedShop,
    userLocation,
    initialMapRegion,
    isGeocoding,
    showDirections,
    routeCoordinates,
    isLoadingRoute,
    routeDistance,
    routeDuration,
    isDirectionsPanelMinimized,
    setIsDirectionsPanelMinimized,
    isShopPopupMinimized,
    setIsShopPopupMinimized,
    radiusMiles,
    handleMarkerPress,
    handleWebViewMarkerPress,
    handleShopCardPress,
    centerOnUserLocation,
    openDirections,
    closeDirections,
    viewShop,
    increaseRadius,
    decreaseRadius,
    clearSelectedShop,
    milesToMeters,
    metersToMiles,
    formatDuration,
  } = useFindShop();


  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 px-4 pb-4 bg-zinc-950 border-b border-zinc-900">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold">Find Shop</Text>
            <Text className="text-zinc-500 text-sm mt-0.5">
              Discover repair shops near you
            </Text>
          </View>
          <ViewModeToggle
            viewMode={viewMode}
            onMapPress={() => setViewMode("map")}
            onListPress={() => setViewMode("list")}
          />
        </View>
      </View>

      {/* Geocoding Overlay */}
      {isGeocoding && (
        <View className="absolute inset-0 bg-black/60 z-50 items-center justify-center">
          <View className="bg-zinc-900 rounded-3xl p-8 items-center mx-8 border border-zinc-800">
            <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center mb-4">
              <ActivityIndicator size="large" color="#FFCC00" />
            </View>
            <Text className="text-white text-lg font-semibold">Finding Location</Text>
            <Text className="text-zinc-500 text-sm mt-2 text-center">
              Looking up the shop address...
            </Text>
          </View>
        </View>
      )}

      {/* Loading State */}
      {isLoading || locationLoading ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-[#FFCC00]/10 items-center justify-center mb-6">
            <ActivityIndicator size="large" color="#FFCC00" />
          </View>
          <Text className="text-white text-lg font-semibold">
            {locationLoading ? "Getting Your Location" : "Loading Shops"}
          </Text>
          <Text className="text-zinc-500 text-sm text-center mt-2">
            {locationLoading
              ? "Please wait while we find your location..."
              : "Fetching nearby repair shops..."}
          </Text>
        </View>
      ) : !initialMapRegion ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-zinc-900 items-center justify-center mb-6">
            <Ionicons name="location-outline" size={48} color="#FFCC00" />
          </View>
          <Text className="text-white text-xl font-semibold text-center">
            Location Access Required
          </Text>
          <Text className="text-zinc-500 text-sm text-center mt-3 leading-5">
            Please enable location access in your device settings to discover repair shops near you.
          </Text>
          <Pressable className="mt-6 bg-[#FFCC00] px-6 py-3 rounded-xl">
            <Text className="text-black font-semibold">Open Settings</Text>
          </Pressable>
        </View>
      ) : viewMode === "map" ? (
        /* Map View */
        <View className="flex-1">
          {isAndroid ? (
            <WebViewMap
              ref={webViewMapRef}
              style={{ flex: 1 }}
              initialRegion={initialMapRegion || undefined}
              showsUserLocation={true}
              userLocation={userLocation}
              markers={filteredShops
                .filter((shop: ShopWithLocation) => shop.hasValidLocation)
                .map((shop: ShopWithLocation): MarkerData => ({
                  id: shop.shopId,
                  coordinate: { latitude: shop.lat!, longitude: shop.lng! },
                  title: shop.name,
                  description: shop.address,
                  isSelected: selectedShop?.shopId === shop.shopId,
                }))}
              circles={
                userLocation
                  ? [
                      {
                        center: {
                          latitude: userLocation.latitude,
                          longitude: userLocation.longitude,
                        },
                        radius: milesToMeters(radiusMiles),
                        strokeColor: "rgba(255, 204, 0, 0.8)",
                        strokeWidth: 2,
                        fillColor: "rgba(255, 204, 0, 0.1)",
                      },
                    ]
                  : []
              }
              polylines={
                showDirections && routeCoordinates.length > 0
                  ? [
                      {
                        coordinates: routeCoordinates,
                        strokeColor: "#FFCC00",
                        strokeWidth: 5,
                      },
                    ]
                  : []
              }
              onMarkerPress={handleWebViewMarkerPress}
              onMapPress={clearSelectedShop}
            />
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_DEFAULT}
              initialRegion={initialMapRegion}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {userLocation && (
                <Circle
                  center={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
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
                      className={`w-11 h-11 rounded-full items-center justify-center ${
                        selectedShop?.shopId === shop.shopId
                          ? "bg-[#FFCC00]"
                          : "bg-zinc-900 border-2 border-[#FFCC00]"
                      }`}
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 5,
                      }}
                    >
                      <Ionicons
                        name="storefront"
                        size={20}
                        color={selectedShop?.shopId === shop.shopId ? "#000" : "#FFCC00"}
                      />
                    </View>
                  </Marker>
                ))}

              {showDirections && routeCoordinates.length > 0 && (
                <Polyline coordinates={routeCoordinates} strokeColor="#FFCC00" strokeWidth={5} />
              )}
            </MapView>
          )}

          <CenterLocationButton onPress={centerOnUserLocation} />

          {/* Directions Panel */}
          {showDirections && selectedShop && isDirectionsPanelMinimized && (
            <DirectionsPanelMinimized
              shop={selectedShop}
              routeDistance={routeDistance}
              routeDuration={routeDuration}
              onExpand={() => setIsDirectionsPanelMinimized(false)}
              metersToMiles={metersToMiles}
              formatDuration={formatDuration}
            />
          )}

          {showDirections && selectedShop && !isDirectionsPanelMinimized && (
            <DirectionsPanelExpanded
              shop={selectedShop}
              routeDistance={routeDistance}
              routeDuration={routeDuration}
              isLoadingRoute={isLoadingRoute}
              routeCoordinatesLength={routeCoordinates.length}
              onMinimize={() => setIsDirectionsPanelMinimized(true)}
              onClose={closeDirections}
              metersToMiles={metersToMiles}
              formatDuration={formatDuration}
            />
          )}

          {/* Shop Popup */}
          {selectedShop && !showDirections && (
            isShopPopupMinimized ? (
              <ShopPopupMinimized
                shop={selectedShop}
                onExpand={() => setIsShopPopupMinimized(false)}
              />
            ) : (
              <ShopPopupExpanded
                shop={selectedShop}
                onMinimize={() => setIsShopPopupMinimized(true)}
                onClose={clearSelectedShop}
                onViewShop={() => viewShop(selectedShop)}
                onDirections={() => openDirections(selectedShop)}
              />
            )
          )}

          <RadiusControl
            radiusMiles={radiusMiles}
            shopsInRadius={shopsInRadius}
            onIncrease={increaseRadius}
            onDecrease={decreaseRadius}
          />
        </View>
      ) : (
        /* List View */
        <FlatList
          data={filteredShops}
          keyExtractor={(item) => item.shopId}
          renderItem={({ item }) => (
            <ShopCard shop={item} onPress={() => handleShopCardPress(item)} />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="mb-4">
              {/* Search Input */}
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or address..."
              />

              {/* Search Results Count */}
              {searchQuery.length > 0 && (
                <View className="flex-row items-center mt-4 bg-zinc-900/50 rounded-xl px-3 py-2">
                  <Ionicons name="search" size={16} color="#71717a" />
                  <Text className="text-zinc-400 text-sm ml-2">
                    {filteredShops.length} result{filteredShops.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </Text>
                  <Pressable onPress={() => setSearchQuery("")} className="ml-auto">
                    <Ionicons name="close-circle" size={18} color="#71717a" />
                  </Pressable>
                </View>
              )}

              {/* Section Title */}
              <Text className="text-zinc-500 text-xs font-semibold mt-4 mb-2">
                {searchQuery ? "SEARCH RESULTS" : "ALL SHOPS"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-12 px-8">
              <View className="w-20 h-20 rounded-full bg-zinc-900 items-center justify-center mb-4">
                <Ionicons
                  name={searchQuery.length > 0 ? "search" : "storefront-outline"}
                  size={36}
                  color="#71717a"
                />
              </View>
              <Text className="text-white text-lg font-semibold text-center">
                {searchQuery.length > 0 ? "No Shops Found" : "No Shops Available"}
              </Text>
              <Text className="text-zinc-500 text-sm text-center mt-2 leading-5">
                {searchQuery.length > 0
                  ? `We couldn't find any shops matching "${searchQuery}". Try a different search term.`
                  : "There are no repair shops available at the moment. Check back later for new listings."}
              </Text>
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  className="mt-4 bg-zinc-800 px-5 py-2.5 rounded-xl"
                >
                  <Text className="text-white font-medium">Clear Search</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}
